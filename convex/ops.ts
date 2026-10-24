// Ops helpers for the e2e smoke script and the hidden staff health page (T23).
// Public functions are PIN-gated and return counts, timestamps and enum strings only: never emails,
// first names, donor ids, tokens or note text. Queries take `now` as an arg (no wall clock in queries).
import { ConvexError, v } from "convex/values";
import { NARRATIVE_MAX_PER_HOUR, NARRATIVE_MIN_INTERVAL_MS } from "../engine/config";
import { buildHealth, COUNT_CAP, countVisitStates, HOUR_MS, tallyDryRun, VISIT_SCAN_CAP, VISIT_WINDOW_MS } from "../engine/ops";
import type { DryRunReport, HealthReport } from "../engine/ops";
import { decideRecipient, estimateTotals, planMilestones } from "../engine/milestones";
import type { RecipientDecision } from "../engine/milestones";
import { loadDonorContext } from "./context";
import { internalMutation, internalQuery, query } from "./lib/builders";
import type { QueryCtx } from "./lib/builders";
import { demoInboxes, intEnv, staffPinMatches } from "./lib/env";
import { loadCandidates, loadFired } from "./milestones";

const KEEP_RUNS = 20;

function requireStaff(pin: string): void {
  if (!staffPinMatches(pin)) throw new ConvexError("unauthorized");
}

/** True while any smoke-test impact log exists; the milestone check skips entirely then. */
export const smokeActive = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const row = await ctx.db.query("impactLogs").withIndex("by_smoke", (q) => q.eq("smoke", true)).first();
    return row !== null;
  },
});

/** Stores one milestone-check run and keeps only the newest KEEP_RUNS. */
export const recordMilestoneRun = internalMutation({
  args: {
    at: v.number(),
    configured: v.boolean(),
    smokeSkipped: v.boolean(),
    checked: v.number(),
    sent: v.number(),
    skipped: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, args): Promise<null> => {
    await ctx.db.insert("opsRuns", { kind: "milestones", ...args });
    const rows = await ctx.db
      .query("opsRuns")
      .withIndex("by_kind_at", (q) => q.eq("kind", "milestones"))
      .order("desc")
      .take(KEEP_RUNS + 50);
    for (const row of rows.slice(KEEP_RUNS)) await ctx.db.delete(row._id);
    return null;
  },
});

export const health = query({
  args: { pin: v.string(), now: v.number() },
  handler: async (ctx, { pin, now }): Promise<HealthReport> => {
    requireStaff(pin);
    const take = COUNT_CAP + 1;

    const latestCall = await ctx.db.query("narrativeCalls").withIndex("by_at").order("desc").first();
    const recentCalls = await ctx.db
      .query("narrativeCalls")
      .withIndex("by_at", (q) => q.gte("at", now - HOUR_MS))
      .take(take);
    const latestNarrative = await ctx.db.query("narratives").order("desc").first();
    const lastRun = await ctx.db
      .query("opsRuns")
      .withIndex("by_kind_at", (q) => q.eq("kind", "milestones"))
      .order("desc")
      .first();
    const latestEmail = await ctx.db.query("milestoneEmails").order("desc").first();
    const emailRows = await ctx.db.query("milestoneEmails").take(take);

    // Newest visits first (by creation time), bounded scan; rows older than 24 h are not counted. States only, no donor ids.
    const visitRows = await ctx.db.query("visits").order("desc").take(VISIT_SCAN_CAP);
    const visitStateRows: { state?: string }[] = [];
    for (const r of visitRows) {
      if (r.at < now - VISIT_WINDOW_MS) continue;
      visitStateRows.push({ state: r.state });
    }

    return buildHealth({
      now,
      visitStates: countVisitStates(visitStateRows),
      latestCall: latestCall ? { at: latestCall.at, outcome: latestCall.outcome } : null,
      recentCallAts: recentCalls.map((r) => r.at),
      latestNarrative: latestNarrative
        ? { source: latestNarrative.source, guardReasonCount: latestNarrative.guardReasons.length }
        : null,
      maxPerHour: intEnv("NARRATIVE_MAX_PER_HOUR", NARRATIVE_MAX_PER_HOUR),
      minIntervalMs: intEnv("NARRATIVE_MIN_INTERVAL_MS", NARRATIVE_MIN_INTERVAL_MS),
      configured: !!process.env.RESEND_API_KEY && demoInboxes().size > 0,
      lastRun: lastRun
        ? {
            at: lastRun.at,
            smokeSkipped: lastRun.smokeSkipped,
            checked: lastRun.checked,
            sent: lastRun.sent,
            skipped: lastRun.skipped,
            failed: lastRun.failed,
          }
        : null,
      latestEmail: latestEmail ? { status: latestEmail.status, sentAt: latestEmail.sentAt } : null,
      sentTotal: emailRows.filter((r) => r.status === "sent").length,
      seedCounts: {
        charities: (await ctx.db.query("charities").take(take)).length,
        donors: (await ctx.db.query("donors").take(take)).length,
        donations: (await ctx.db.query("donations").take(take)).length,
        impactLogs: (await ctx.db.query("impactLogs").take(take)).length,
        expenses: (await ctx.db.query("expenses").take(take)).length,
      },
      smokeCounts: {
        donors: (await ctx.db.query("donors").withIndex("by_smoke", (q) => q.eq("smoke", true)).take(take)).length,
        impactLogs: (await ctx.db.query("impactLogs").withIndex("by_smoke", (q) => q.eq("smoke", true)).take(take)).length,
      },
    });
  },
});

/** Mirrors milestones.check without any writes: what a run would do right now. Never returns emails. */
async function dryRun(ctx: QueryCtx, now: number): Promise<DryRunReport> {
  const allowlist = demoInboxes();
  const items: { outcome: "nothing" | RecipientDecision; email: string | null }[] = [];
  for (const c of await loadCandidates(ctx, now)) {
    const dctx = await loadDonorContext(ctx, c.donorId, c.charityId, now);
    if (!dctx) {
      items.push({ outcome: "nothing", email: c.email });
      continue;
    }
    const fired = await loadFired(ctx, c.donorId, c.charityId);
    const plan = planMilestones({ totals: estimateTotals(dctx.allocations), fired: new Set(fired.thresholdIds) });
    if (plan.toMark.length === 0 || plan.announce === null) {
      items.push({ outcome: "nothing", email: c.email });
      continue;
    }
    items.push({
      outcome: decideRecipient({ email: c.email, allowlist, lastSentAt: fired.lastSentAt, now }),
      email: c.email,
    });
  }
  return tallyDryRun({ configured: !!process.env.RESEND_API_KEY && allowlist.size > 0, allowlist, items });
}

export const milestoneDryRun = query({
  args: { pin: v.string(), now: v.number() },
  handler: async (ctx, { pin, now }): Promise<DryRunReport> => {
    requireStaff(pin);
    return await dryRun(ctx, now);
  },
});
