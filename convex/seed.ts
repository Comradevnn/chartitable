import { internalMutationGeneric } from "convex/server"; // can switch to ./_generated/server after the lead runs `npx convex dev`
import type { GenericDataModel, GenericMutationCtx } from "convex/server";
import { v } from "convex/values";
import type { GenericId } from "convex/values";
import { buildSeed, planUpserts } from "../seed/data";

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
      donors: await upsertTable(ctx, "donors", seed.donors, (d) => ({
        firstName: d.firstName,
        email: d.email,
        hideFromTopDonors: d.hideFromTopDonors ?? false,
      })),
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
