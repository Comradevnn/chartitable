// Visit log + per-donor rate limit for GET /donor-view (§15). Ids only.
import { v } from "convex/values";
import { DONOR_VIEW_MAX_PER_MINUTE } from "../engine/config";
import { internalMutation } from "./lib/builders";
import { vCharityId } from "./lib/validators";

export const record = internalMutation({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: async (ctx, args): Promise<{ limited: boolean; previousVisitAt: number | null }> => {
    const recent = await ctx.db
      .query("visits")
      .withIndex("by_donor_charity_at", (q) =>
        q.eq("donorId", args.donorId).eq("charityId", args.charityId).gt("at", args.now - 60_000),
      )
      .take(DONOR_VIEW_MAX_PER_MINUTE + 1);
    if (recent.length >= DONOR_VIEW_MAX_PER_MINUTE) return { limited: true, previousVisitAt: null };

    const newest = await ctx.db
      .query("visits")
      .withIndex("by_donor_charity_at", (q) => q.eq("donorId", args.donorId).eq("charityId", args.charityId))
      .order("desc")
      .first();
    await ctx.db.insert("visits", { donorId: args.donorId, charityId: args.charityId, at: args.now });
    return { limited: false, previousVisitAt: newest ? newest.at : null };
  },
});
