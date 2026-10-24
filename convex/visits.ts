// Visit log + per-donor rate limit for GET /donor-view (§15). Ids only.
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { DONOR_VIEW_MAX_PER_MINUTE } from "../engine/config";
import { internalMutation, internalQuery } from "./lib/builders";
import { vCharityId } from "./lib/validators";

export const record = internalMutation({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: async (ctx, args): Promise<{ limited: boolean; previousVisitAt: number | null; visitId: Id<"visits"> | null }> => {
    const recent = await ctx.db
      .query("visits")
      .withIndex("by_donor_charity_at", (q) =>
        q.eq("donorId", args.donorId).eq("charityId", args.charityId).gt("at", args.now - 60_000),
      )
      .take(DONOR_VIEW_MAX_PER_MINUTE + 1);
    if (recent.length >= DONOR_VIEW_MAX_PER_MINUTE) return { limited: true, previousVisitAt: null, visitId: null };

    const newest = await ctx.db
      .query("visits")
      .withIndex("by_donor_charity_at", (q) => q.eq("donorId", args.donorId).eq("charityId", args.charityId))
      .order("desc")
      .first();
    const visitId = await ctx.db.insert("visits", { donorId: args.donorId, charityId: args.charityId, at: args.now });
    return { limited: false, previousVisitAt: newest ? newest.at : null, visitId };
  },
});

const vDonorState = v.union(
  v.literal("just_gave"),
  v.literal("news"),
  v.literal("first_impact"),
  v.literal("repeat"),
  v.literal("lapsed"),
  v.literal("returning"),
);

/** Stores the donor state shown on a visit. Best-effort: the caller ignores failures. */
export const setState = internalMutation({
  args: { id: v.id("visits"), state: vDonorState },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { state: args.state });
  },
});

/**
 * peek=1: the visit BEFORE the newest one. The newest visit is this page's own load (recorded by the
 * first, non-peek request), so the one before it is the "previous visit". Inserts nothing.
 * `now` is passed in (no wall clock in queries); rows after it are ignored.
 */
export const previousForPeek = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: async (ctx, args): Promise<number | null> => {
    const rows = await ctx.db
      .query("visits")
      .withIndex("by_donor_charity_at", (q) =>
        q.eq("donorId", args.donorId).eq("charityId", args.charityId).lte("at", args.now),
      )
      .order("desc")
      .take(2);
    return rows.length >= 2 ? rows[1]!.at : null;
  },
});
