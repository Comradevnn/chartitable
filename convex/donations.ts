// Hosted test-mode donate flow (D10). Thin wrapper: validation lives in engine/donate.ts.
// Never log inputs or tokens. Creates a NEW donor row (never looked up by email) unless a valid
// ct token for this charity names an existing donor, which is then credited instead (T31).
import { v } from "convex/values";
import { DONATIONS_MAX_PER_HOUR } from "../engine/config";
import { CHARITY_IDS } from "../engine/types";
import { boundedToken, chooseDonor, keepAllowlistedEmail, redirectUrl, validateDonation } from "../engine/donate";
import type { DonateError } from "../engine/donate";
import { dateLabel } from "../engine/facts";
import { DEFAULT_TOKEN_TTL_MS, signToken, verifyToken } from "../engine/token";
import { action, internal, internalQuery, mutation, query } from "./lib/builders";
import { demoInboxes, tokenSecret } from "./lib/env";
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
    token: v.optional(v.string()), // returning donor: credit THIS donor instead of creating a new one
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
    // Public endpoint: cap test donations per hour so a script can't flood rows or dilute shares.
    let lastHour = 0;
    for (const id of CHARITY_IDS) {
      const rows = await ctx.db
        .query("donations")
        .withIndex("by_charity_createdAt", (q) => q.eq("charityId", id).gte("createdAt", now - 60 * 60 * 1000))
        .take(DONATIONS_MAX_PER_HOUR);
      lastHour += rows.length;
    }
    if (lastHour >= DONATIONS_MAX_PER_HOUR) return { ok: false, error: "unavailable" };

    // Returning donor: a token that verifies for THIS charity and names an existing donor row.
    let donorKey: string | null = null;
    const presented = boundedToken(args.token);
    if (presented) {
      const verified = await verifyToken(presented, secret, now);
      const tokenOk = verified.ok && verified.payload.charityId === d.charityId;
      const claimed = tokenOk ? verified.payload.donorId : null;
      const row = claimed
        ? await ctx.db
            .query("donors")
            .withIndex("by_key", (q) => q.eq("key", claimed))
            .unique()
        : null;
      if (claimed && chooseDonor({ tokenOk, donorExists: row !== null }) === "existing") donorKey = claimed;
    }
    if (donorKey === null) {
      donorKey = randomKey("donor_");
      await ctx.db.insert("donors", {
        key: donorKey,
        firstName: d.firstName,
        email: keepAllowlistedEmail(d.email, demoInboxes()), // D4: never store addresses we may not email
        hideFromTopDonors: d.hideFromTopDonors,
        ...(args.smoke ? { smoke: true } : {}),
      });
    }
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

const PREFILL_TIME_ZONE = "America/Los_Angeles"; // same default as engine/facts.ts

/** Newest gift of one donor at one charity. Internal: only `prefill` calls it after verifying a token. */
export const lastGiftFor = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId },
  handler: async (ctx, { donorId, charityId }): Promise<{ amountCents: number; createdAt: number } | null> => {
    const rows = await ctx.db
      .query("donations")
      .withIndex("by_donor", (q) => q.eq("donorId", donorId))
      .order("desc")
      .take(50);
    const row = rows.find((r) => r.charityId === charityId);
    return row ? { amountCents: row.amountCents, createdAt: row.createdAt } : null;
  },
});

/**
 * Donate page prefill for a returning donor. Returns only the last gift (amount + date label);
 * never the donor id, name or email. Any problem returns { ok: false }. Never logs the token.
 */
export const prefill = action({
  args: { token: v.string(), charityId: vCharityId },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; lastGiftDollars: number; lastGiftDateLabel: string } | { ok: false }> => {
    try {
      const token = boundedToken(args.token);
      const secret = tokenSecret();
      if (!token || !secret) return { ok: false };
      const verified = await verifyToken(token, secret, Date.now());
      if (!verified.ok || verified.payload.charityId !== args.charityId) return { ok: false };
      const gift: { amountCents: number; createdAt: number } | null = await ctx.runQuery(
        internal.donations.lastGiftFor,
        { donorId: verified.payload.donorId, charityId: args.charityId },
      );
      if (!gift) return { ok: false };
      return {
        ok: true,
        lastGiftDollars: Math.round(gift.amountCents / 100),
        lastGiftDateLabel: dateLabel(gift.createdAt, PREFILL_TIME_ZONE),
      };
    } catch {
      return { ok: false };
    }
  },
});
