import { internalMutationGeneric } from "convex/server"; // can switch to ./_generated/server after the lead runs `npx convex dev`
import type { GenericDataModel, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { GenericId } from "convex/values";
import { CHARITY_IDS } from "../engine/types";
import { buildSeed, planUpserts } from "../seed/data";
import { internal, internalMutation } from "./lib/builders";

type Counts = { inserted: number; updated: number };

// Upsert rows by `key` (engine id). Reads existing keys once, then patches or inserts.
async function upsertTable<T extends { id: string }>(
  ctx: GenericMutationCtx<GenericDataModel>,
  table: string,
  rows: readonly T[],
  toDoc: (row: T) => Record<string, unknown>,
  insertOnly: Record<string, unknown> = {}, // fields set on insert, never overwritten on re-seed
): Promise<Counts> {
  const existing = await ctx.db.query(table).collect();
  const idByKey = new Map<string, GenericId<string>>(existing.map((d) => [String(d.key), d._id as GenericId<string>]));
  const plan = planUpserts(new Set(idByKey.keys()), rows);
  for (const row of plan.insert) await ctx.db.insert(table, { key: row.id, ...toDoc(row), ...insertOnly });
  for (const row of plan.update) {
    const docId = idByKey.get(row.id);
    if (docId) await ctx.db.patch(docId, { key: row.id, ...toDoc(row) });
  }
  return { inserted: plan.insert.length, updated: plan.update.length };
}

export const load = internalMutationGeneric({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const seed = buildSeed(args.now ?? Date.now());
    return {
      charities: await upsertTable(ctx, "charities", seed.charities, (c) => ({
        name: c.name,
        siteUrl: c.siteUrl,
        fictional: true,
      })),
      // email is insert-only so re-seeding keeps the demo inbox set by milestones:setDemoEmail.
      donors: await upsertTable(
        ctx,
        "donors",
        seed.donors,
        (d) => ({ firstName: d.firstName, hideFromTopDonors: d.hideFromTopDonors ?? false }),
        { email: null },
      ),
      donations: await upsertTable(ctx, "donations", seed.donations, (d) => ({
        donorId: d.donorId,
        charityId: d.charityId,
        amountCents: d.amountCents,
        createdAt: d.createdAt,
        testMode: true,
      })),
      // photoStorageId is insert-only so re-seeding keeps photos staff uploaded.
      impactLogs: await upsertTable(
        ctx,
        "impactLogs",
        seed.impactLogs,
        (l) => ({
          charityId: l.charityId,
          kind: l.kind,
          count: l.count,
          unit: l.unit,
          note: l.note,
          photoPath: l.photoPath,
          loggedAt: l.loggedAt,
        }),
        { photoStorageId: null },
      ),
      // receiptStorageId is insert-only so re-seeding keeps receipts staff uploaded.
      expenses: await upsertTable(
        ctx,
        "expenses",
        seed.expenses,
        (e) => ({
          charityId: e.charityId,
          date: e.date,
          amountCents: e.amountCents,
          category: e.category,
          note: e.note,
          createdAt: e.createdAt,
        }),
        { receiptStorageId: null },
      ),
    };
  },
});

/**
 * Removes everything the e2e smoke script created: rows tagged `smoke: true` (donors, impact logs)
 * plus their dependents. Rows without the tag are never touched. Idempotent; bounded per run, so
 * run it again if counts come back at the batch size.
 */
export const cleanSmoke = internalMutation({
  args: {},
  handler: async (ctx) => {
    const batch = 500;
    const counts = {
      donors: 0,
      donations: 0,
      impactLogs: 0,
      visits: 0,
      narratives: 0,
      narrativeCalls: 0,
      milestoneEmails: 0,
      allocations: 0,
    };

    const donors = await ctx.db.query("donors").withIndex("by_smoke", (q) => q.eq("smoke", true)).take(batch);
    for (const donor of donors) {
      const donations = await ctx.db.query("donations").withIndex("by_donor", (q) => q.eq("donorId", donor.key)).take(batch);
      for (const row of donations) await ctx.db.delete(row._id);
      counts.donations += donations.length;

      for (const charityId of CHARITY_IDS) {
        const visits = await ctx.db
          .query("visits")
          .withIndex("by_donor_charity_at", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
          .take(batch);
        for (const row of visits) await ctx.db.delete(row._id);
        counts.visits += visits.length;

        const narratives = await ctx.db
          .query("narratives")
          .withIndex("by_donor_charity_hash", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
          .take(batch);
        for (const row of narratives) await ctx.db.delete(row._id);
        counts.narratives += narratives.length;

        const calls = await ctx.db
          .query("narrativeCalls")
          .withIndex("by_donor_charity_at", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
          .take(batch);
        for (const row of calls) await ctx.db.delete(row._id);
        counts.narrativeCalls += calls.length;

        const emails = await ctx.db
          .query("milestoneEmails")
          .withIndex("by_donor_charity", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
          .take(batch);
        for (const row of emails) await ctx.db.delete(row._id);
        counts.milestoneEmails += emails.length;

        const allocations = await ctx.db
          .query("allocations")
          .withIndex("by_donor_charity", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
          .take(batch);
        for (const row of allocations) await ctx.db.delete(row._id);
        counts.allocations += allocations.length;
      }
      await ctx.db.delete(donor._id);
      counts.donors++;
    }

    const logs = await ctx.db.query("impactLogs").withIndex("by_smoke", (q) => q.eq("smoke", true)).take(batch);
    for (const log of logs) {
      const allocations = await ctx.db.query("allocations").withIndex("by_log", (q) => q.eq("logId", log.key)).take(batch);
      for (const row of allocations) await ctx.db.delete(row._id);
      counts.allocations += allocations.length;
      if (log.photoStorageId) {
        try {
          await ctx.storage.delete(log.photoStorageId);
        } catch {
          // already gone; the log still gets removed
        }
      }
      await ctx.db.delete(log._id);
      counts.impactLogs++;
    }

    // Stored allocations were derived from the rows just removed; rebuild them for the real data.
    for (const charityId of CHARITY_IDS) await ctx.scheduler.runAfter(0, internal.allocations.recompute, { charityId });
    return counts;
  },
});

/**
 * Rehearsal reset (demo-day): removes every donor, donation and impact log that is not from the
 * seed (donate-page gifts, staff updates, smoke rows) with their dependents, and clears fired
 * milestones so the 25-meal email can fire again. Seed rows, the demo inbox and seed visits stay.
 * Run `seed:load` afterwards to re-anchor dates to now. Requires { confirm: "reset-demo" }.
 */
export const resetDemo = internalMutation({
  args: { confirm: v.literal("reset-demo") },
  handler: async (ctx) => {
    const seed = buildSeed(Date.now());
    const seedDonors = new Set(seed.donors.map((d) => d.id));
    const seedDonations = new Set(seed.donations.map((d) => d.id));
    const seedLogs = new Set(seed.impactLogs.map((l) => l.id));
    const batch = 500;
    const counts = { donors: 0, donations: 0, impactLogs: 0, milestoneEmails: 0, dependents: 0 };

    for (const d of await ctx.db.query("donations").take(batch * 4)) {
      if (seedDonations.has(d.key)) continue;
      await ctx.db.delete(d._id);
      counts.donations++;
    }
    for (const donor of await ctx.db.query("donors").take(batch)) {
      if (seedDonors.has(donor.key)) continue;
      for (const charityId of CHARITY_IDS) {
        for (const table of ["visits", "narrativeCalls"] as const) {
          const rows = await ctx.db
            .query(table)
            .withIndex("by_donor_charity_at", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
            .take(batch);
          for (const row of rows) await ctx.db.delete(row._id);
          counts.dependents += rows.length;
        }
        const narratives = await ctx.db
          .query("narratives")
          .withIndex("by_donor_charity_hash", (q) => q.eq("donorId", donor.key).eq("charityId", charityId))
          .take(batch);
        for (const row of narratives) await ctx.db.delete(row._id);
        counts.dependents += narratives.length;
      }
      await ctx.db.delete(donor._id);
      counts.donors++;
    }
    for (const log of await ctx.db.query("impactLogs").take(batch)) {
      if (seedLogs.has(log.key)) continue;
      if (log.photoStorageId) {
        try {
          await ctx.storage.delete(log.photoStorageId);
        } catch {
          // already gone; the log still gets removed
        }
      }
      await ctx.db.delete(log._id);
      counts.impactLogs++;
    }
    for (const row of await ctx.db.query("milestoneEmails").take(batch)) {
      await ctx.db.delete(row._id);
      counts.milestoneEmails++;
    }
    for (const charityId of CHARITY_IDS) await ctx.scheduler.runAfter(0, internal.allocations.recompute, { charityId });
    return counts;
  },
});
