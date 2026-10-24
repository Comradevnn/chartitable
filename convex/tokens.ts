// Donor token tooling (D6). For the lead/QA:
//   npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'
// The token is returned to the caller only; it is never logged.
import { v } from "convex/values";
import { DEFAULT_TOKEN_TTL_MS, signToken } from "../engine/token";
import { internal, internalAction, internalQuery } from "./lib/builders";
import { tokenSecret } from "./lib/env";
import { vCharityId } from "./lib/validators";

/** charity.siteUrl if both the donor and the charity rows exist. */
export const siteFor = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, args): Promise<string | null> => {
    const charity = await ctx.db.query("charities").withIndex("by_key", (q) => q.eq("key", args.charityId)).unique();
    const donor = await ctx.db.query("donors").withIndex("by_key", (q) => q.eq("key", args.donorId)).unique();
    return charity && donor ? charity.siteUrl : null;
  },
});

export const issue = internalAction({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, args): Promise<{ link: string } | { error: "unavailable" | "not_found" }> => {
    try {
      const secret = tokenSecret();
      if (!secret) return { error: "unavailable" };
      const siteUrl: string | null = await ctx.runQuery(internal.tokens.siteFor, args);
      if (!siteUrl) return { error: "not_found" };
      const token = await signToken(
        { donorId: args.donorId, charityId: args.charityId, exp: Date.now() + DEFAULT_TOKEN_TTL_MS },
        secret,
      );
      const link = new URL(siteUrl);
      link.searchParams.set("ct", token);
      return { link: link.toString() };
    } catch {
      return { error: "unavailable" };
    }
  },
});
