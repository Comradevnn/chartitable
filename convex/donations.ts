// Hosted test-mode donate flow (D10). Thin wrapper: validation lives in engine/donate.ts.
// Never log inputs or tokens. Always creates a NEW donor row (never looked up by email).
import { v } from "convex/values";
import { redirectUrl, validateDonation } from "../engine/donate";
import type { DonateError } from "../engine/donate";
import { DEFAULT_TOKEN_TTL_MS, signToken } from "../engine/token";
import { internal, mutation, query } from "./lib/builders";
import { tokenSecret } from "./lib/env";
import { vCharityId } from "./lib/validators";

function randomKey(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return `${prefix}${hex}`;
}

export const create = mutation({
  args: {
    charityId: vCharityId,
    amountCents: v.number(),
    firstName: v.optional(v.string()),
    email: v.optional(v.string()),
    hideFromTopDonors: v.optional(v.boolean()),
    smoke: v.optional(v.boolean()), // tags the donor row so seed:cleanSmoke can remove it
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: DonateError | "unavailable" }> => {
    const parsed = validateDonation(args);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const d = parsed.value;

    const secret = tokenSecret();
    if (!secret) return { ok: false, error: "unavailable" };

    const charity = await ctx.db
      .query("charities")
      .withIndex("by_key", (q) => q.eq("key", d.charityId))
      .unique();
    if (!charity) return { ok: false, error: "charity" };

    const now = Date.now();
    const donorKey = randomKey("donor_");
    await ctx.db.insert("donors", {
      key: donorKey,
      firstName: d.firstName,
      email: d.email,
      hideFromTopDonors: d.hideFromTopDonors,
      ...(args.smoke ? { smoke: true } : {}),
    });
    await ctx.db.insert("donations", {
      key: randomKey("don_"),
      donorId: donorKey,
      charityId: d.charityId,
      amountCents: d.amountCents,
      createdAt: now,
      testMode: true,
    });
    await ctx.scheduler.runAfter(0, internal.allocations.recompute, { charityId: d.charityId });

    const token = await signToken(
      { donorId: donorKey, charityId: d.charityId, exp: now + DEFAULT_TOKEN_TTL_MS },
      secret,
    );
    return { ok: true, redirectUrl: redirectUrl(charity.siteUrl, token) };
  },
});

export const charityInfo = query({
  args: { charityId: vCharityId },
  handler: async (ctx, { charityId }): Promise<{ name: string } | null> => {
    const c = await ctx.db
      .query("charities")
      .withIndex("by_key", (q) => q.eq("key", charityId))
      .unique();
    return c ? { name: c.name } : null;
  },
});
