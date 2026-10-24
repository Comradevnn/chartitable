// allocations:recompute — rewrites stored allocations for one charity (window ending now).
// Scheduled after donations:create and impact:log. Donor-facing reads compute on the fly
// (convex/context.ts), so this table only feeds staff/dashboard summaries.
import { v } from "convex/values";
import { allocate } from "../engine/allocate";
import { windowEnding } from "../engine/config";
import { internalMutation } from "./lib/builders";
import { toDonation, toImpactLog } from "./lib/mappers";
import { vCharityId } from "./lib/validators";

export const recompute = internalMutation({
  args: { charityId: vCharityId },
  handler: async (ctx, { charityId }) => {
    const window = windowEnding(Date.now());
    const donations = (
      await ctx.db
        .query("donations")
        .withIndex("by_charity_createdAt", (q) => q.eq("charityId", charityId).gte("createdAt", window.from))
        .collect()
    ).map(toDonation);
    const logs = (
      await ctx.db
        .query("impactLogs")
        .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId).gte("loggedAt", window.from))
        .collect()
    ).map(toImpactLog);
    const next = allocate(donations, logs, window);

    const old = await ctx.db.query("allocations").filter((q) => q.eq(q.field("charityId"), charityId)).collect();
    for (const row of old) await ctx.db.delete(row._id);
    for (const a of next) await ctx.db.insert("allocations", a);
    return { count: next.length };
  },
});
