// Milestone check + "See where your donation has gone" email (T9). Thin Convex wrapper around
// engine/milestones.ts and engine/email.ts. Logs nothing (no emails, tokens, or bodies).
// Email goes only to DEMO_INBOXES (D4); a failure here never blocks anything else.
import { v } from "convex/values";
import { CHARITY_IDS } from "../engine/types";
import type { CharityId, NarrativeResult } from "../engine/types";
import { windowEnding } from "../engine/config";
import { buildFacts } from "../engine/facts";
import { buildMilestoneEmail, decideRecipient, estimateTotals, planMilestones } from "../engine/milestones";
import { DEFAULT_TOKEN_TTL_MS, signToken } from "../engine/token";
import type { DonorContext } from "./context";
import { internal, internalAction, internalMutation, internalQuery } from "./lib/builders";
import { demoInboxes, tokenSecret } from "./lib/env";
import { vCharityId } from "./lib/validators";

const vKind = v.union(v.literal("meals"), v.literal("produce"), v.literal("volunteer_shifts"));
const vStatus = v.union(
  v.literal("sent"),
  v.literal("skipped_not_allowlisted"),
  v.literal("skipped_no_email"),
  v.literal("skipped_rate_limited"),
  v.literal("failed"),
);

export const firedFor = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, args): Promise<{ thresholdIds: string[]; lastSentAt: number | null }> => {
    const rows = await ctx.db
      .query("milestoneEmails")
      .withIndex("by_donor_charity", (q) => q.eq("donorId", args.donorId).eq("charityId", args.charityId))
      .collect();
    let lastSentAt: number | null = null;
    for (const r of rows) {
      if (r.status === "sent" && (lastSentAt === null || r.sentAt > lastSentAt)) lastSentAt = r.sentAt;
    }
    return { thresholdIds: rows.map((r) => r.thresholdId), lastSentAt };
  },
});

/** Inserts a row per hit unless one already exists. Returns the thresholdIds actually inserted. */
export const claim = internalMutation({
  args: {
    donorId: v.string(),
    charityId: vCharityId,
    hits: v.array(v.object({ kind: vKind, threshold: v.number(), thresholdId: v.string() })),
    status: vStatus,
    now: v.number(),
  },
  handler: async (ctx, args): Promise<string[]> => {
    const inserted: string[] = [];
    for (const hit of args.hits) {
      const existing = await ctx.db
        .query("milestoneEmails")
        .withIndex("by_donor_charity_threshold", (q) =>
          q.eq("donorId", args.donorId).eq("charityId", args.charityId).eq("thresholdId", hit.thresholdId),
        )
        .first();
      if (existing) continue;
      await ctx.db.insert("milestoneEmails", {
        donorId: args.donorId,
        charityId: args.charityId,
        kind: hit.kind,
        threshold: hit.threshold,
        thresholdId: hit.thresholdId,
        status: args.status,
        sentAt: args.now,
      });
      inserted.push(hit.thresholdId);
    }
    return inserted;
  },
});

export const setStatus = internalMutation({
  args: { donorId: v.string(), charityId: vCharityId, thresholdId: v.string(), status: vStatus },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("milestoneEmails")
      .withIndex("by_donor_charity_threshold", (q) =>
        q.eq("donorId", args.donorId).eq("charityId", args.charityId).eq("thresholdId", args.thresholdId),
      )
      .first();
    if (row) await ctx.db.patch(row._id, { status: args.status });
  },
});

/** Distinct donors with at least one donation in the window, per charity. Email is internal-only. */
export const candidates = internalQuery({
  args: { now: v.number() },
  handler: async (ctx, args): Promise<{ donorId: string; charityId: CharityId; email: string | null }[]> => {
    const window = windowEnding(args.now);
    const out: { donorId: string; charityId: CharityId; email: string | null }[] = [];
    for (const charityId of CHARITY_IDS) {
      const donations = await ctx.db
        .query("donations")
        .withIndex("by_charity_createdAt", (q) =>
          q.eq("charityId", charityId).gte("createdAt", window.from).lte("createdAt", window.to),
        )
        .collect();
      for (const donorId of new Set(donations.map((d) => d.donorId))) {
        const donor = await ctx.db.query("donors").withIndex("by_key", (q) => q.eq("key", donorId)).unique();
        out.push({ donorId, charityId, email: donor ? donor.email : null });
      }
    }
    return out;
  },
});

export const check = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; sent: number; skipped: number; failed: number }> => {
    const now = Date.now();
    const counts = { checked: 0, sent: 0, skipped: 0, failed: 0 };
    const cands: { donorId: string; charityId: CharityId; email: string | null }[] = await ctx.runQuery(
      internal.milestones.candidates,
      { now },
    );
    const allowlist = demoInboxes();
    // Not configured yet → do nothing (and mark nothing), so thresholds aren't burned before the demo.
    if (!process.env.RESEND_API_KEY || allowlist.size === 0) return counts;

    for (const c of cands) {
      counts.checked++;
      let claimedIds: string[] = [];
      try {
        const dctx: DonorContext | null = await ctx.runQuery(internal.context.forDonor, {
          donorId: c.donorId,
          charityId: c.charityId,
          now,
        });
        if (!dctx) continue;
        const fired: { thresholdIds: string[]; lastSentAt: number | null } = await ctx.runQuery(
          internal.milestones.firedFor,
          { donorId: c.donorId, charityId: c.charityId },
        );
        const plan = planMilestones({
          totals: estimateTotals(dctx.allocations),
          fired: new Set(fired.thresholdIds),
        });
        if (plan.toMark.length === 0 || plan.announce === null) continue;

        const decision = decideRecipient({ email: c.email, allowlist, lastSentAt: fired.lastSentAt, now });
        if (decision !== "send") {
          await ctx.runMutation(internal.milestones.claim, {
            donorId: c.donorId,
            charityId: c.charityId,
            hits: plan.toMark,
            status: decision,
            now,
          });
          counts.skipped++;
          continue;
        }

        // Provisional "sent" claim: a concurrent run loses the insert race and stops here.
        claimedIds = await ctx.runMutation(internal.milestones.claim, {
          donorId: c.donorId,
          charityId: c.charityId,
          hits: plan.toMark,
          status: "sent",
          now,
        });
        if (!claimedIds.includes(plan.announce.thresholdId)) {
          claimedIds = [];
          continue;
        }
        const markClaimed = async (status: "failed" | "skipped_not_allowlisted") => {
          for (const thresholdId of claimedIds) {
            await ctx.runMutation(internal.milestones.setStatus, {
              donorId: c.donorId,
              charityId: c.charityId,
              thresholdId,
              status,
            });
          }
        };

        const narrative: NarrativeResult | null = await ctx.runAction(internal.narrative.getOrGenerate, {
          donorId: c.donorId,
          charityId: c.charityId,
        });
        const secret = tokenSecret();
        if (!narrative || secret === null || c.email === null) {
          await markClaimed("failed");
          counts.failed++;
          continue;
        }

        const facts = buildFacts({
          charity: dctx.charity,
          donor: dctx.donor,
          donations: dctx.donations,
          logs: dctx.logs,
          allocations: dctx.allocations,
          window: dctx.window,
          lastVisitAt: null,
        });
        const token = await signToken(
          { donorId: c.donorId, charityId: c.charityId, exp: now + DEFAULT_TOKEN_TTL_MS },
          secret,
        );
        const url = new URL(dctx.charity.siteUrl);
        url.search = "";
        url.searchParams.set("ct", token);
        const email = buildMilestoneEmail({ facts, narrative, link: url.toString(), hit: plan.announce });

        const res: { ok: true; id: string | null } | { ok: false; reason: "not_allowlisted" | "no_key" | "failed" } =
          await ctx.runAction(internal.email.sendMilestone, {
            to: c.email,
            subject: email.subject,
            text: email.text,
            html: email.html,
          });
        if (res.ok) {
          counts.sent++;
        } else if (res.reason === "not_allowlisted") {
          await markClaimed("skipped_not_allowlisted");
          counts.skipped++;
        } else {
          await markClaimed("failed");
          counts.failed++;
        }
      } catch {
        // One donor's failure never stops the run. Mark anything we provisionally claimed.
        counts.failed++;
        for (const thresholdId of claimedIds) {
          try {
            await ctx.runMutation(internal.milestones.setStatus, {
              donorId: c.donorId,
              charityId: c.charityId,
              thresholdId,
              status: "failed",
            });
          } catch {
            // best effort
          }
        }
      }
    }
    return counts;
  },
});

/** Demo helper: set a donor's email only if it is on the DEMO_INBOXES allowlist (D4). */
export const setDemoEmail = internalMutation({
  args: { donorId: v.string(), email: v.string() },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const email = args.email.trim().toLowerCase();
    if (!demoInboxes().has(email)) return { ok: false };
    const donor = await ctx.db.query("donors").withIndex("by_key", (q) => q.eq("key", args.donorId)).unique();
    if (!donor) return { ok: false };
    await ctx.db.patch(donor._id, { email });
    return { ok: true };
  },
});
