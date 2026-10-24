// PIN-gated demo control backend (T33-T35). Thin Convex wrapper around engine/demo.ts.
// Every public function except `personas` is an action whose first step is the PIN gate (checkPin):
// wrong PINs are counted across the deployment and lock demo:* for a window.
// Returns counts, enums and short labels only: never tokens, emails, PINs, keys or donor names in errors.
// Email still goes only to DEMO_INBOXES (enforced again inside milestones.check and email.ts); payments are test mode only.
import { ConvexError, v } from "convex/values";
import { roundEstimate } from "../engine/allocate";
import { MILESTONE_THRESHOLDS, NARRATIVE_MAX_PER_HOUR, NARRATIVE_MIN_INTERVAL_MS } from "../engine/config";
import {
  buildReport,
  CHARITY_LABELS,
  donorPersonas,
  MILESTONE_RUN_STALE_MS,
  personaById,
  PERSONAS,
  PIN_LOCK_WINDOW_MS,
  PIN_MAX_FAILURES,
  pinLocked,
  presetById,
  probeFresh,
  publicPersonas,
  stagedVisitAt,
} from "../engine/demo";
import type { CheckId, CheckStatus, Persona, PreflightCheck, PreflightReport, PublicPersona } from "../engine/demo";
import { buildDonorView, narrativeFacts } from "../engine/donor-view";
import { hashFacts } from "../engine/facts";
import { estimateTotals, planMilestones } from "../engine/milestones";
import { runNarrative } from "../engine/narrative-run";
import { COUNT_CAP } from "../engine/ops";
import { templateFallback } from "../engine/template";
import { signToken } from "../engine/token";
import { CHARITY_IDS } from "../engine/types";
import type { CharityId, NarrativeResult } from "../engine/types";
import { buildSeed } from "../seed/data";
import type { DonorContext } from "./context";
import { action, internal, internalAction, internalMutation, internalQuery, query } from "./lib/builders";
import type { ActionCtx, MutationCtx } from "./lib/builders";
import { demoInboxes, intEnv, staffPinMatches, tokenSecret } from "./lib/env";
import { vCharityId } from "./lib/validators";
import { logImpact } from "./impact";
import type { LogImpactResult } from "./impact";
import { loadFired } from "./milestones";
import { makeCallModel } from "./narrative";

const MIN_MS = 60_000;
const VISIT_DELETE_BATCH = 200;
const PROBE_DONOR_ID = "demo_probe"; // narrativeCalls rows only; never a real donor
const PROBE_CHARITY_ID: CharityId = "demo-pantry-a";
const PROBE_HERO_DONOR_ID = "donor_a01";
const KEEP_PROBES = 10;

export interface WarmReport {
  total: number;
  claude: number;
  template: number;
  failed: number;
}

type PinResult = { ok: true } | { ok: false; locked: boolean };

// ---------- PIN gate ----------

/**
 * Counts wrong PINs deployment-wide. Returns (never throws) so the failure row commits.
 * Locked → the PIN is not even compared. Old failure rows are pruned (bounded).
 */
export const checkPin = internalMutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }): Promise<PinResult> => {
    const now = Date.now();
    const cutoff = now - PIN_LOCK_WINDOW_MS;

    const old = await ctx.db
      .query("pinFailures")
      .withIndex("by_scope_at", (q) => q.eq("scope", "demo").lte("at", cutoff))
      .take(50);
    for (const row of old) await ctx.db.delete(row._id);

    const recent = await ctx.db
      .query("pinFailures")
      .withIndex("by_scope_at", (q) => q.eq("scope", "demo").gt("at", cutoff))
      .take(PIN_MAX_FAILURES + 1);
    if (pinLocked(recent.map((r) => r.at), now)) return { ok: false, locked: true };

    if (!staffPinMatches(pin)) {
      await ctx.db.insert("pinFailures", { scope: "demo", at: now });
      return { ok: false, locked: false };
    }
    return { ok: true };
  },
});

async function gate(ctx: ActionCtx, pin: string): Promise<void> {
  const res: PinResult = await ctx.runMutation(internal.demo.checkPin, { pin });
  if (!res.ok) throw new ConvexError(res.locked ? "locked" : "unauthorized");
}

// ---------- staging ----------

/** Replace the persona's visits at its charity with at most one staged visit (see stagedVisitAt). */
async function stagePersona(ctx: MutationCtx, persona: Persona, now: number): Promise<boolean> {
  if (persona.donorId === null) return false;
  const donorId = persona.donorId;
  const charityId = persona.charityId;
  for (let round = 0; round < 5; round++) {
    const rows = await ctx.db
      .query("visits")
      .withIndex("by_donor_charity_at", (q) => q.eq("donorId", donorId).eq("charityId", charityId))
      .take(VISIT_DELETE_BATCH);
    for (const row of rows) await ctx.db.delete(row._id);
    if (rows.length < VISIT_DELETE_BATCH) break;
  }
  const newest = await ctx.db
    .query("impactLogs")
    .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId))
    .order("desc")
    .first();
  const at = stagedVisitAt(persona, now, newest ? newest.loggedAt : null);
  if (at === null) return false;
  await ctx.db.insert("visits", { donorId, charityId, at });
  return true;
}

export const stage = internalMutation({
  args: { personaId: v.string(), now: v.number() },
  handler: async (ctx, { personaId, now }): Promise<boolean> => {
    const persona = personaById(personaId);
    return persona ? await stagePersona(ctx, persona, now) : false;
  },
});

export const stageAll = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<number> => {
    let staged = 0;
    for (const persona of donorPersonas()) if (await stagePersona(ctx, persona, now)) staged++;
    return staged;
  },
});

export const charitySite = internalQuery({
  args: { charityId: vCharityId },
  handler: async (ctx, { charityId }): Promise<string | null> => {
    const row = await ctx.db.query("charities").withIndex("by_key", (q) => q.eq("key", charityId)).unique();
    return row ? row.siteUrl : null;
  },
});

// ---------- public: personas, link ----------

export const personas = query({
  args: {},
  handler: async (): Promise<PublicPersona[]> => publicPersonas(),
});

export const link = action({
  args: { pin: v.string(), personaId: v.string() },
  handler: async (
    ctx,
    { pin, personaId },
  ): Promise<{ ok: true; url: string } | { ok: false; error: "unknown_persona" | "unavailable" }> => {
    await gate(ctx, pin);
    const persona = personaById(personaId);
    if (!persona) return { ok: false, error: "unknown_persona" };
    try {
      if (persona.donorId === null) {
        // First-time visitor: an EMPTY ct tells the layer to forget any stored token.
        const siteUrl: string | null = await ctx.runQuery(internal.demo.charitySite, { charityId: persona.charityId });
        if (!siteUrl) return { ok: false, error: "unavailable" };
        const url = new URL(siteUrl);
        url.search = "";
        url.searchParams.set("ct", "");
        return { ok: true, url: url.toString() };
      }
      await ctx.runMutation(internal.demo.stage, { personaId: persona.id, now: Date.now() });
      const issued: { link: string } | { error: "unavailable" | "not_found" } = await ctx.runAction(
        internal.tokens.issue,
        { donorId: persona.donorId, charityId: persona.charityId },
      );
      return "link" in issued ? { ok: true, url: issued.link } : { ok: false, error: "unavailable" };
    } catch {
      return { ok: false, error: "unavailable" };
    }
  },
});

// ---------- warm ----------

async function runWarm(ctx: ActionCtx): Promise<WarmReport> {
  const list = donorPersonas();
  const outcomes = await Promise.all(
    list.map(async (p): Promise<"claude" | "template" | "failed"> => {
      try {
        // A template here usually means one guard rejection; warm ignores a stored template, so one
        // more call can upgrade it (the hourly cap still applies, the guard still decides).
        let res: NarrativeResult | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          res = await ctx.runAction(internal.narrative.getOrGenerate, {
            donorId: p.donorId,
            charityId: p.charityId,
            warm: true,
          });
          if (!res || res.source === "claude") break;
        }
        return res ? res.source : "failed";
      } catch {
        return "failed";
      }
    }),
  );
  return {
    total: list.length,
    claude: outcomes.filter((o) => o === "claude").length,
    template: outcomes.filter((o) => o === "template").length,
    failed: outcomes.filter((o) => o === "failed").length,
  };
}

export const warm = action({
  args: { pin: v.string() },
  handler: async (ctx, { pin }): Promise<WarmReport> => {
    await gate(ctx, pin);
    return await runWarm(ctx);
  },
});

// ---------- reset ----------

/** Deletes expenses that are not in the seed (their receipts too), then re-anchors derived allocations. */
export const pruneExpenses = internalMutation({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<number> => {
    const seedKeys = new Set(buildSeed(now).expenses.map((e) => e.id));
    const rows = await ctx.db.query("expenses").take(COUNT_CAP + 1);
    let removed = 0;
    for (const row of rows) {
      if (seedKeys.has(row.key)) continue;
      if (row.receiptStorageId) {
        try {
          await ctx.storage.delete(row.receiptStorageId);
        } catch {
          // already gone; the expense still gets removed
        }
      }
      await ctx.db.delete(row._id);
      removed++;
    }
    // resetDemo schedules its own recompute before seed:load re-anchors dates; run one more after.
    for (const charityId of CHARITY_IDS) await ctx.scheduler.runAfter(0, internal.allocations.recompute, { charityId });
    return removed;
  },
});

function firstAllowlisted(): string | null {
  const list = [...demoInboxes()].sort();
  return list.length > 0 ? list[0]! : null;
}

export const reset = action({
  args: { pin: v.string() },
  handler: async (
    ctx,
    { pin },
  ): Promise<{
    ok: true;
    removed: { donors: number; donations: number; impactLogs: number; milestoneEmails: number; dependents: number };
    expensesRemoved: number;
    emailSet: boolean;
    warm: WarmReport;
  }> => {
    await gate(ctx, pin);
    const now = Date.now();
    const removed: {
      donors: number;
      donations: number;
      impactLogs: number;
      milestoneEmails: number;
      dependents: number;
    } = await ctx.runMutation(internal.seed.resetDemo, { confirm: "reset-demo" });
    await ctx.runMutation(internal.seed.load, { now });
    const expensesRemoved: number = await ctx.runMutation(internal.demo.pruneExpenses, { now });

    // The hero gets the first (sorted) allowlisted address so the milestone email can go out.
    const inbox = firstAllowlisted();
    const emailPersonas = PERSONAS.filter((p) => p.email && p.donorId !== null);
    let emailSet = inbox !== null && emailPersonas.length > 0;
    for (const p of emailPersonas) {
      if (inbox === null) break;
      try {
        const res: { ok: boolean } = await ctx.runMutation(internal.milestones.setDemoEmail, {
          donorId: p.donorId,
          email: inbox,
        });
        if (!res.ok) emailSet = false;
      } catch {
        emailSet = false;
      }
    }

    await ctx.runMutation(internal.demo.stageAll, { now });
    const warmReport = await runWarm(ctx);
    return { ok: true, removed, expensesRemoved, emailSet, warm: warmReport };
  },
});

// ---------- post a staff update ----------

export const postPreset = internalMutation({
  args: {
    charityId: vCharityId,
    kind: v.string(),
    count: v.number(),
    note: v.string(),
    requestId: v.optional(v.string()),
    holdMilestoneCheck: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<LogImpactResult> => logImpact(ctx, args),
});

export const post = action({
  args: {
    pin: v.string(),
    charityId: vCharityId,
    preset: v.string(),
    requestId: v.optional(v.string()),
    holdEmail: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { pin, charityId, preset, requestId, holdEmail },
  ): Promise<
    | { ok: true; logId: string; donorsCredited: number; label: string }
    | { ok: false; error: "preset" | "kind" | "count" | "note" | "photo" | "request" }
  > => {
    await gate(ctx, pin);
    const p = presetById(preset);
    if (!p) return { ok: false, error: "preset" };
    const res: LogImpactResult = await ctx.runMutation(internal.demo.postPreset, {
      charityId,
      kind: p.kind,
      count: p.count,
      note: p.note,
      ...(requestId !== undefined ? { requestId } : {}),
      holdMilestoneCheck: holdEmail === true,
    });
    if (!res.ok) return { ok: false, error: res.error };
    // impact:log already warms recent visitors, but under the per-donor interval: right after a reset
    // that interval would leave an open persona tab on the template. Re-warm this charity's personas
    // (interval skipped, hourly cap and guard unchanged), hero first.
    const personasHere = donorPersonas()
      .filter((x) => x.charityId === charityId)
      .sort((a, b) => Number(b.hero) - Number(a.hero));
    for (const x of personasHere) {
      try {
        await ctx.scheduler.runAfter(0, internal.narrative.getOrGenerate, { donorId: x.donorId, charityId, warm: true });
      } catch {
        // best effort; the page still shows the template
      }
    }
    return { ok: true, logId: res.logId, donorsCredited: res.donorsCredited, label: p.label };
  },
});

// ---------- send the milestone email on demand ----------

type SendEmailStatus =
  | "sent"
  | "already_sent"
  | "not_crossed"
  | "not_configured"
  | "smoke_active"
  | "not_email_persona"
  | "no_email"
  | "failed"
  | "skipped";

/** Unsent milestone rows for a donor+charity: removed so a threshold can fire again now that the email exists. */
export const clearUnsentMilestones = internalMutation({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, args): Promise<number> => {
    const rows = await ctx.db
      .query("milestoneEmails")
      .withIndex("by_donor_charity", (q) => q.eq("donorId", args.donorId).eq("charityId", args.charityId))
      .take(100);
    let removed = 0;
    for (const row of rows) {
      if (row.status === "sent") continue;
      await ctx.db.delete(row._id);
      removed++;
    }
    return removed;
  },
});

export const milestoneRows = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, args): Promise<{ status: string; sentAt: number }[]> => {
    const rows = await ctx.db
      .query("milestoneEmails")
      .withIndex("by_donor_charity", (q) => q.eq("donorId", args.donorId).eq("charityId", args.charityId))
      .take(100);
    return rows.map((r) => ({ status: r.status, sentAt: r.sentAt }));
  },
});

export const sendEmail = action({
  args: { pin: v.string(), personaId: v.string() },
  handler: async (
    ctx,
    { pin, personaId },
  ): Promise<{ ok: boolean; status: SendEmailStatus; detail: string; sentAt?: number }> => {
    await gate(ctx, pin);
    const reply = (status: SendEmailStatus, detail: string, sentAt?: number) => ({
      ok: status === "sent" || status === "already_sent",
      status,
      detail,
      ...(sentAt !== undefined ? { sentAt } : {}),
    });

    const persona = personaById(personaId);
    if (!persona || !persona.email || persona.donorId === null) {
      return reply("not_email_persona", "This persona does not receive the milestone email.");
    }
    const donorId = persona.donorId;
    const charityId = persona.charityId;

    const allowlist = demoInboxes();
    if (!process.env.RESEND_API_KEY || allowlist.size === 0) {
      return reply("not_configured", "Email is not configured (set RESEND_API_KEY and DEMO_INBOXES).");
    }
    const smoke: boolean = await ctx.runQuery(internal.ops.smokeActive, {});
    if (smoke) return reply("smoke_active", "Smoke-test rows exist; milestone emails are skipped until they are cleaned.");

    try {
      const inbox = firstAllowlisted();
      const set: { ok: boolean } = inbox
        ? await ctx.runMutation(internal.milestones.setDemoEmail, { donorId, email: inbox })
        : { ok: false };
      if (!set.ok) return reply("no_email", "The donor has no allowed demo inbox yet. Click Reset.");

      const now = Date.now();
      const dctx: DonorContext | null = await ctx.runQuery(internal.context.forDonor, { donorId, charityId, now });
      if (!dctx) return reply("failed", "Donor data unavailable.");

      const totals = estimateTotals(dctx.allocations);
      const plan = planMilestones({ totals, fired: new Set<string>() });
      if (plan.announce === null) {
        const preset = presetById("meals80");
        return reply(
          "not_crossed",
          `About ${roundEstimate(totals.meals)} meals so far (estimate). The first email goes out at ${MILESTONE_THRESHOLDS.meals[0]} meals.` +
            (preset ? ` Post '${preset.label}' on ${CHARITY_LABELS[charityId]} first.` : ""),
        );
      }

      const fired: { thresholdIds: string[]; lastSentAt: number | null } = await ctx.runQuery(
        internal.milestones.firedFor,
        { donorId, charityId },
      );
      if (fired.lastSentAt !== null) return reply("already_sent", "Already sent. Reset to send again.", fired.lastSentAt);

      // Rows from earlier checks (made before the email existed) would block the threshold from firing.
      await ctx.runMutation(internal.demo.clearUnsentMilestones, { donorId, charityId });
      await ctx.runAction(internal.milestones.check, {});

      const rows: { status: string; sentAt: number }[] = await ctx.runQuery(internal.demo.milestoneRows, {
        donorId,
        charityId,
      });
      const sent = rows.filter((r) => r.status === "sent").sort((a, b) => b.sentAt - a.sentAt)[0];
      if (sent) return reply("sent", "Sent to the demo inbox.", sent.sentAt);
      const newest = [...rows].sort((a, b) => b.sentAt - a.sentAt)[0];
      if (!newest) return reply("failed", "The milestone check did not pick this donor up.");
      if (newest.status.startsWith("skipped")) return reply("skipped", `Skipped: ${newest.status}.`);
      return reply("failed", "The send failed. Check the email settings.");
    } catch {
      return reply("failed", "Something went wrong sending the email.");
    }
  },
});

// ---------- preflight ----------

interface PreflightState {
  site: { charities: number; donors: number; donations: number; impactLogs: number; expenses: number };
  seedComplete: boolean;
  extra: { donors: number; donations: number; impactLogs: number; expenses: number; smokeRows: number };
  newestLogAt: Record<CharityId, number | null>;
  cinderwellSiteUrl: string | null;
  heroEmailAllowlisted: boolean;
  heroSentAt: number | null;
  lastMilestoneRun: { at: number; smokeSkipped: boolean } | null;
  newestProbe: { at: number; source: "claude" | "template"; outcome: string; latencyMs: number } | null;
}

/** All preflight database reads in one bounded query. `now` is passed in (no wall clock in queries). */
export const preflightState = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }): Promise<PreflightState> => {
    const seed = buildSeed(now);
    const take = COUNT_CAP + 1;
    const charities = await ctx.db.query("charities").take(20);
    const donors = await ctx.db.query("donors").take(take);
    const donations = await ctx.db.query("donations").take(take * 2);
    const logs = await ctx.db.query("impactLogs").take(take);
    const expenses = await ctx.db.query("expenses").take(take);

    const keys = (rows: { key: string }[]) => new Set(rows.map((r) => r.key));
    const hasAll = (have: Set<string>, ids: string[]) => ids.every((id) => have.has(id));
    const seedComplete =
      charities.length === 2 &&
      hasAll(keys(charities), seed.charities.map((c) => c.id)) &&
      hasAll(keys(donors), seed.donors.map((d) => d.id)) &&
      hasAll(keys(donations), seed.donations.map((d) => d.id)) &&
      hasAll(keys(logs), seed.impactLogs.map((l) => l.id)) &&
      hasAll(keys(expenses), seed.expenses.map((e) => e.id));

    const notSeed = (rows: { key: string }[], ids: { id: string }[]) => {
      const seedIds = new Set(ids.map((i) => i.id));
      return rows.filter((r) => !seedIds.has(r.key)).length;
    };
    const smokeDonors = await ctx.db.query("donors").withIndex("by_smoke", (q) => q.eq("smoke", true)).take(51);
    const smokeLogs = await ctx.db.query("impactLogs").withIndex("by_smoke", (q) => q.eq("smoke", true)).take(51);

    const newestLogAt = {} as Record<CharityId, number | null>;
    for (const charityId of CHARITY_IDS) {
      const row = await ctx.db
        .query("impactLogs")
        .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId))
        .order("desc")
        .first();
      newestLogAt[charityId] = row ? row.loggedAt : null;
    }

    const hero = PERSONAS.find((p) => p.hero && p.email && p.donorId !== null) ?? null;
    let heroEmailAllowlisted = false;
    let heroSentAt: number | null = null;
    if (hero && hero.donorId !== null) {
      const heroId = hero.donorId;
      const donor = await ctx.db.query("donors").withIndex("by_key", (q) => q.eq("key", heroId)).unique();
      heroEmailAllowlisted = !!donor && !!donor.email && demoInboxes().has(donor.email.trim().toLowerCase());
      heroSentAt = (await loadFired(ctx, heroId, hero.charityId)).lastSentAt;
    }

    const run = await ctx.db
      .query("opsRuns")
      .withIndex("by_kind_at", (q) => q.eq("kind", "milestones"))
      .order("desc")
      .first();
    const probe = await ctx.db.query("demoProbes").withIndex("by_at").order("desc").first();
    const cinderwell = charities.find((c) => c.key === "demo-pantry-a");

    return {
      site: {
        charities: charities.length,
        donors: donors.length,
        donations: donations.length,
        impactLogs: logs.length,
        expenses: expenses.length,
      },
      seedComplete,
      extra: {
        donors: notSeed(donors, seed.donors),
        donations: notSeed(donations, seed.donations),
        impactLogs: notSeed(logs, seed.impactLogs),
        expenses: notSeed(expenses, seed.expenses),
        smokeRows: smokeDonors.length + smokeLogs.length,
      },
      newestLogAt,
      cinderwellSiteUrl: cinderwell ? cinderwell.siteUrl : null,
      heroEmailAllowlisted,
      heroSentAt,
      lastMilestoneRun: run ? { at: run.at, smokeSkipped: run.smokeSkipped } : null,
      newestProbe: probe ? { at: probe.at, source: probe.source, outcome: probe.outcome, latencyMs: probe.latencyMs } : null,
    };
  },
});

export const recordProbe = internalMutation({
  args: {
    at: v.number(),
    source: v.union(v.literal("claude"), v.literal("template")),
    outcome: v.string(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args): Promise<null> => {
    await ctx.db.insert("demoProbes", args);
    const rows = await ctx.db.query("demoProbes").withIndex("by_at").order("desc").take(KEEP_PROBES + 50);
    for (const row of rows.slice(KEEP_PROBES)) await ctx.db.delete(row._id);
    return null;
  },
});

type ProbeResult = { at: number; source: "claude" | "template"; outcome: string; latencyMs: number };

/** One live, guarded Claude call for the hero's facts. Stores no narrative; counts toward the hourly cap only. */
export const runProbe = internalAction({
  args: {},
  handler: async (ctx): Promise<ProbeResult> => {
    const now = Date.now();
    const finish = async (source: "claude" | "template", outcome: string, latencyMs: number): Promise<ProbeResult> => {
      const result: ProbeResult = { at: now, source, outcome, latencyMs };
      await ctx.runMutation(internal.demo.recordProbe, result);
      return result;
    };
    const dctx: DonorContext | null = await ctx.runQuery(internal.context.forDonor, {
      donorId: PROBE_HERO_DONOR_ID,
      charityId: PROBE_CHARITY_ID,
      now,
    });
    if (!dctx) return await finish("template", "error", 0);

    const facts = narrativeFacts(dctx);
    const stats: { callsInLastHour: number; lastCallAtForDonor: number | null } = await ctx.runQuery(
      internal.narrative.callStats,
      { donorId: PROBE_DONOR_ID, charityId: PROBE_CHARITY_ID, now },
    );
    const apiKey = process.env.ANTHROPIC_API_KEY;
    // One retry after a guard rejection: the guard is strict by design (a stray capitalized word
    // fails it), so a single rejection is normal and says nothing about Claude being up.
    let out: Awaited<ReturnType<typeof runNarrative>> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      out = await runNarrative({
        facts,
        now: Date.now(),
        cached: null,
        caps: {
          ...stats,
          callsInLastHour: stats.callsInLastHour + attempt,
          maxPerHour: intEnv("NARRATIVE_MAX_PER_HOUR", NARRATIVE_MAX_PER_HOUR),
          minIntervalMs: attempt === 0 ? intEnv("NARRATIVE_MIN_INTERVAL_MS", NARRATIVE_MIN_INTERVAL_MS) : 0,
        },
        callModel: apiKey ? makeCallModel(apiKey) : null,
      });
      if (out.called && (out.outcome === "claude" || out.outcome === "rejected" || out.outcome === "error")) {
        await ctx.runMutation(internal.narrative.recordCall, {
          donorId: PROBE_DONOR_ID,
          charityId: PROBE_CHARITY_ID,
          at: Date.now(),
          outcome: out.outcome,
          latencyMs: out.latencyMs,
        });
      }
      if (out.outcome !== "rejected") break;
    }
    return await finish(out!.result.source, out!.outcome, out!.latencyMs);
  },
});

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function minutesAgo(at: number, now: number): number {
  return Math.max(0, Math.round((now - at) / MIN_MS));
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

interface CheckOutcome {
  status: CheckStatus;
  detail: string;
}

async function runCheck(id: CheckId, label: string, fn: () => Promise<CheckOutcome>): Promise<PreflightCheck> {
  try {
    return { id, label, ...(await fn()) };
  } catch {
    return { id, label, status: "red", detail: "Check failed" };
  }
}

export const preflight = action({
  args: { pin: v.string() },
  handler: async (ctx, { pin }): Promise<PreflightReport> => {
    await gate(ctx, pin);
    const now = Date.now();

    const statePromise: Promise<PreflightState> = ctx.runQuery(internal.demo.preflightState, { now });
    // Donor contexts feed both the warm check and the predicted persona states.
    const contextsPromise: Promise<{ persona: Persona & { donorId: string }; dctx: DonorContext | null }[]> =
      Promise.all(
        donorPersonas().map(async (persona) => {
          const dctx: DonorContext | null = await ctx.runQuery(internal.context.forDonor, {
            donorId: persona.donorId,
            charityId: persona.charityId,
            now,
          });
          return { persona, dctx };
        }),
      );
    // Dependents await these; this keeps a failed read from surfacing as an unhandled rejection.
    statePromise.catch(() => undefined);
    contextsPromise.catch(() => undefined);

    const convexCheck = runCheck("convex", "Backend", async () => ({
      status: "green",
      detail: (process.env.CONVEX_CLOUD_URL ?? "").includes("acoustic-donkey-399") ? "Reachable (dev)" : "Reachable",
    }));

    const configCheck = runCheck("config", "Configuration", async () => {
      if (!tokenSecret()) return { status: "red", detail: "TOKEN_SECRET missing or too short" };
      const missing = ["DONATE_PAGE_URL", "ASSET_BASE_URL"].filter((name) => !process.env[name]);
      if (missing.length > 0) return { status: "amber", detail: `Missing: ${missing.join(", ")}` };
      return { status: "green", detail: "TOKEN_SECRET, DONATE_PAGE_URL, ASSET_BASE_URL set" };
    });

    const anthropicCheck = runCheck("anthropic", "Claude key", async () =>
      process.env.ANTHROPIC_API_KEY
        ? { status: "green", detail: "ANTHROPIC_API_KEY set" }
        : { status: "amber", detail: "No key: template stories only" },
    );

    const probeCheck = runCheck("claude_probe", "Claude story test", async () => {
      const state = await statePromise;
      let probe: ProbeResult;
      if (state.newestProbe && probeFresh(state.newestProbe.at, now)) probe = state.newestProbe;
      else probe = await ctx.runAction(internal.demo.runProbe, {});
      if (probe.source === "claude") {
        return { status: "green", detail: `Claude passed the guard (${(probe.latencyMs / 1000).toFixed(1)} s)` };
      }
      return { status: "amber", detail: `Template fallback (${probe.outcome}); the demo still works` };
    });

    const warmCheck = runCheck("warm", "First views ready", async () => {
      const contexts = await contextsPromise;
      let claude = 0;
      for (const { persona, dctx } of contexts) {
        if (!dctx) continue;
        const factsHash = await hashFacts(narrativeFacts(dctx));
        const hit: NarrativeResult | null = await ctx.runQuery(internal.narrative.cached, {
          donorId: persona.donorId,
          charityId: persona.charityId,
          factsHash,
        });
        if (hit && hit.source === "claude") claude++;
      }
      const total = contexts.length;
      return claude === total
        ? { status: "green", detail: `${total} of ${total} first views are Claude stories` }
        : { status: "amber", detail: `${claude} of ${total} ready; click Warm` };
    });

    const emailCheck = runCheck("email", "Milestone email", async () => {
      const state = await statePromise;
      const hero = PERSONAS.find((p) => p.hero && p.email) ?? null;
      const heroName = hero ? hero.label.split(" · ")[0]! : "the hero";
      if (!process.env.RESEND_API_KEY || demoInboxes().size === 0) {
        return { status: "amber", detail: "Email step unavailable (set RESEND_API_KEY and DEMO_INBOXES)" };
      }
      if (!state.heroEmailAllowlisted) return { status: "amber", detail: "Hero inbox not set: click Reset" };
      if (state.heroSentAt !== null) {
        return { status: "amber", detail: `Already sent ${minutesAgo(state.heroSentAt, now)} min ago; reset to send again` };
      }
      return { status: "green", detail: `Ready: sends when ${heroName} crosses ${MILESTONE_THRESHOLDS.meals[0]} meals` };
    });

    const seedCheck = runCheck("seed", "Seed data", async () => {
      const state = await statePromise;
      if (!state.seedComplete) return { status: "red", detail: "Seed missing: click Reset" };
      const seed = buildSeed(now);
      return {
        status: "green",
        detail: `${state.site.charities} charities, ${seed.donors.length} donors, ${seed.impactLogs.length} logs`,
      };
    });

    const canonicalCheck = runCheck("canonical", "Start state", async () => {
      const { extra } = await statePromise;
      const parts: string[] = [];
      if (extra.impactLogs > 0) parts.push(plural(extra.impactLogs, "staff update", "staff updates"));
      if (extra.donations > 0) parts.push(plural(extra.donations, "gift", "gifts"));
      if (extra.donors > 0) parts.push(plural(extra.donors, "new donor", "new donors"));
      if (extra.expenses > 0) parts.push(plural(extra.expenses, "expense", "expenses"));
      if (extra.smokeRows > 0) parts.push(plural(extra.smokeRows, "smoke row", "smoke rows") + " (milestone emails are skipped while they exist)");
      if (parts.length === 0) return { status: "green", detail: "Canonical start state" };
      return { status: "amber", detail: `Changed since reset: ${parts.join(", ")}` };
    });

    const milestonesCheck = runCheck("milestones", "Milestone check", async () => {
      const { lastMilestoneRun } = await statePromise;
      if (!lastMilestoneRun) return { status: "amber", detail: "No milestone check has run yet" };
      const mins = minutesAgo(lastMilestoneRun.at, now);
      if (now - lastMilestoneRun.at > MILESTONE_RUN_STALE_MS) {
        return { status: "amber", detail: `Last check ${mins} min ago; the 5-minute cron looks stalled` };
      }
      if (lastMilestoneRun.smokeSkipped) return { status: "amber", detail: `Last check ${mins} min ago, skipped (smoke rows exist)` };
      return { status: "green", detail: `Last check ${mins} min ago` };
    });

    const layerCheck = runCheck("layer", "Layer on the site", async () => {
      const { cinderwellSiteUrl } = await statePromise;
      const siteHostUrl = process.env.CONVEX_SITE_URL;
      if (!cinderwellSiteUrl) return { status: "red", detail: "Not reachable" };
      if (!siteHostUrl) return { status: "amber", detail: "Backend URL unknown" };
      let res: Response;
      let body: string;
      try {
        res = await fetchWithTimeout(`${new URL(cinderwellSiteUrl).origin}/layer.js`, { method: "GET" }, 8000);
        if (res.status !== 200) return { status: "red", detail: `Not reachable (HTTP ${res.status})` };
        body = await res.text();
      } catch {
        return { status: "red", detail: "Not reachable" };
      }
      const kb = (body.length / 1024).toFixed(1);
      return body.includes(new URL(siteHostUrl).host)
        ? { status: "green", detail: `Served, points at this backend (${kb} KB)` }
        : { status: "red", detail: "Stub build: redeploy the site" };
    });

    const linksCheck = runCheck("links", "Persona links", async () => {
      const contexts = await contextsPromise;
      const state = await statePromise;
      const secret = tokenSecret();
      const base = process.env.CONVEX_SITE_URL;
      if (!secret || !base) return { status: "red", detail: "Cannot sign persona links" };

      const recognized = await Promise.all(
        contexts.map(async ({ persona }) => {
          try {
            const token = await signToken({ donorId: persona.donorId, charityId: persona.charityId, exp: now + 10 * MIN_MS }, secret);
            const res = await fetchWithTimeout(
              `${base.replace(/\/+$/, "")}/donor-pulse?charity=${persona.charityId}`,
              { method: "GET", headers: { Authorization: `Bearer ${token}` } },
              8000,
            );
            const json = (await res.json()) as { recognized?: unknown };
            return json.recognized === true;
          } catch {
            return false;
          }
        }),
      );
      const bad = recognized.filter((ok) => !ok).length;
      if (bad > 0) return { status: "red", detail: `${plural(bad, "persona link", "persona links")} not recognized` };

      // Pure prediction of the state each persona shows right now (like /donor-view, template story, staged visit).
      const drift: string[] = [];
      for (const { persona, dctx } of contexts) {
        if (!dctx) continue;
        const narrative: NarrativeResult = { output: templateFallback(narrativeFacts(dctx)), source: "template", guardReasons: [] };
        const view = buildDonorView({
          context: dctx,
          previousVisitAt: stagedVisitAt(persona, now, state.newestLogAt[persona.charityId]),
          narrative,
          donateHref: null,
          ownGifts: dctx.ownGifts,
          visitsInLast30Days: dctx.visitsInLast30Days,
          narrativeAt: dctx.narrativeAt,
        });
        const shown = view.recognized && view.donor ? view.donor.state : null;
        if (shown !== null && shown !== persona.state) drift.push(`${persona.id} now shows ${shown}`);
      }
      if (drift.length > 0) {
        const more = drift.length > 3 ? ` (+${drift.length - 3} more)` : "";
        return { status: "amber", detail: `${drift.slice(0, 3).join(", ")}${more} (data changed since reset); reset to restore` };
      }
      return { status: "green", detail: `All ${recognized.length} persona links recognized` };
    });

    // Report order follows CheckId; the checks themselves ran in parallel.
    const checks = await Promise.all([
      convexCheck,
      configCheck,
      anthropicCheck,
      probeCheck,
      warmCheck,
      emailCheck,
      seedCheck,
      canonicalCheck,
      milestonesCheck,
      layerCheck,
      linksCheck,
    ]);
    return buildReport(now, checks);
  },
});
