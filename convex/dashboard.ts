// Staff dashboard backend (T19). Thin wrappers over engine/dashboard.ts.
// Every function requires the staff PIN (STAFF_PIN env) and fails closed.
// Never returns donor emails.
import { ConvexError, v } from "convex/values";
import type { GenericId } from "convex/values";
import { buildDonors, buildExpenses, buildOverview, periodsEnding, validateExpense } from "../engine/dashboard";
import type { DashDonor, DashExpense, DashOverview } from "../engine/types";
import { mutation, query } from "./lib/builders";
import type { MutationCtx, QueryCtx } from "./lib/builders";
import { staffPinMatches } from "./lib/env";
import { toDonation, toDonor, toExpense, toImpactLog } from "./lib/mappers";
import { vCharityId } from "./lib/validators";

function requireStaff(pin: string): void {
  if (!staffPinMatches(pin)) throw new ConvexError("unauthorized");
}

async function storageUrl(ctx: QueryCtx, storageId: string | null): Promise<string | null> {
  if (!storageId) return null;
  return await ctx.storage.getUrl(storageId as GenericId<"_storage">);
}

export const overview = query({
  args: { pin: v.string(), charityId: vCharityId, days: v.optional(v.number()) },
  handler: async (ctx, { pin, charityId, days }): Promise<DashOverview> => {
    requireStaff(pin);
    const now = Date.now();
    const { period, prevPeriod } = periodsEnding(now, days);
    const donations = (
      await ctx.db
        .query("donations")
        .withIndex("by_charity_createdAt", (q) => q.eq("charityId", charityId))
        .collect()
    ).map(toDonation);
    const logs = (
      await ctx.db
        .query("impactLogs")
        .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId).gte("loggedAt", period.from))
        .collect()
    ).map(toImpactLog);
    const expenses = (
      await ctx.db
        .query("expenses")
        .withIndex("by_charity_date", (q) => q.eq("charityId", charityId).gte("date", period.from))
        .collect()
    ).map(toExpense);
    const photoUrlByLogId: Record<string, string> = {};
    for (const l of logs) {
      const url = await storageUrl(ctx, l.photoStorageId);
      if (url) photoUrlByLogId[l.id] = url;
    }
    return buildOverview({ charityId, period, prevPeriod, donations, logs, expenses, photoUrlByLogId, now });
  },
});

export const donors = query({
  args: { pin: v.string(), charityId: vCharityId },
  handler: async (ctx, { pin, charityId }): Promise<DashDonor[]> => {
    requireStaff(pin);
    const now = Date.now();
    const { period } = periodsEnding(now);
    const donations = (
      await ctx.db
        .query("donations")
        .withIndex("by_charity_createdAt", (q) => q.eq("charityId", charityId))
        .collect()
    ).map(toDonation);
    const donorRows = (await ctx.db.query("donors").collect()).map((d) => toDonor(d)); // email stripped
    return buildDonors({ charityId, donors: donorRows, donations, period, now });
  },
});

export const expenses = query({
  args: { pin: v.string(), charityId: vCharityId, days: v.optional(v.number()) },
  handler: async (ctx, { pin, charityId, days }): Promise<DashExpense[]> => {
    requireStaff(pin);
    const { period } = periodsEnding(Date.now(), days);
    const rows = (
      await ctx.db
        .query("expenses")
        .withIndex("by_charity_date", (q) => q.eq("charityId", charityId).gte("date", period.from))
        .collect()
    ).map(toExpense);
    const receiptUrlById: Record<string, string> = {};
    for (const e of rows) {
      const url = await storageUrl(ctx, e.receiptStorageId);
      if (url) receiptUrlById[e.id] = url;
    }
    return buildExpenses(rows, receiptUrlById);
  },
});

function newExpenseKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "exp_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const addExpense = mutation({
  args: {
    pin: v.string(),
    charityId: vCharityId,
    date: v.number(),
    amountCents: v.number(),
    category: v.string(),
    note: v.optional(v.string()),
    receiptStorageId: v.optional(v.id("_storage")),
  },
  handler: async (
    ctx: MutationCtx,
    args,
  ): Promise<{ ok: true; id: string } | { ok: false; error: string }> => {
    requireStaff(args.pin);
    const now = Date.now();
    const checked = validateExpense(
      { date: args.date, amountCents: args.amountCents, category: args.category, note: args.note },
      now,
    );
    if (!checked.ok) return checked;
    const key = newExpenseKey();
    await ctx.db.insert("expenses", {
      key,
      charityId: args.charityId,
      date: checked.value.date,
      amountCents: checked.value.amountCents,
      category: checked.value.category,
      note: checked.value.note,
      receiptStorageId: args.receiptStorageId ?? null,
      createdAt: now,
    });
    return { ok: true, id: key };
  },
});

export const markThanked = mutation({
  args: { pin: v.string(), charityId: vCharityId, donorId: v.string() },
  handler: async (ctx, { pin, charityId, donorId }): Promise<{ ok: true } | { ok: false; error: string }> => {
    requireStaff(pin);
    const gift = await ctx.db
      .query("donations")
      .withIndex("by_donor", (q) => q.eq("donorId", donorId))
      .filter((q) => q.eq(q.field("charityId"), charityId))
      .first();
    if (!gift) return { ok: false, error: "No gift from this donor to this charity." };
    const donor = await ctx.db
      .query("donors")
      .withIndex("by_key", (q) => q.eq("key", donorId))
      .unique();
    if (!donor) return { ok: false, error: "Donor not found." };
    await ctx.db.patch(donor._id, { thankedAt: Date.now() });
    return { ok: true };
  },
});

export const generateReceiptUploadUrl = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }): Promise<string> => {
    requireStaff(pin);
    return await ctx.storage.generateUploadUrl();
  },
});
