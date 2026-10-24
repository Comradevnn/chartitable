// Loads everything the engine needs for one donor at one charity (FactsInput minus lastVisitAt).
// Shared by narrative (T6b), donor-view (T7b) and milestones (T9). Email is never returned.
import { v } from "convex/values";
import { allocate } from "../engine/allocate";
import { windowEnding } from "../engine/config";
import type { Allocation, Charity, Donation, Donor, ImpactLog, TimeWindow } from "../engine/types";
import { internalQuery } from "./lib/builders";
import type { QueryCtx } from "./lib/builders";
import { toCharity, toDonation, toDonor, toImpactLog } from "./lib/mappers";
import { vCharityId } from "./lib/validators";

export interface DonorContext {
  charity: Charity;
  donor: Donor; // email always null here
  donations: Donation[]; // ALL donations to this charity in the window (allocation needs them)
  logs: ImpactLog[]; // this charity's logs in the window
  allocations: Allocation[]; // this donor's allocations only
  window: TimeWindow;
  photos: { logId: string; url: string }[];
  /** v2: this donor's donations at this charity, all-time (bounded), newest-inserted first. */
  ownGifts: Donation[];
  /** v2: this donor's visits at this charity in the last 30 days (bounded count). */
  visitsInLast30Days: number;
  /** v2: createdAt of the newest stored narrative for donor+charity (any factsHash), else null. */
  narrativeAt: number | null;
}

const OWN_GIFTS_READ_MAX = 300;
const VISITS_READ_MAX = 200;
const NEWEST_LOGS_READ = 20;
const THIRTY_DAYS_MS = 30 * 86_400_000;

/** This donor's donations at this charity, all-time. Bounded; newest inserted first. */
export async function loadOwnGifts(ctx: QueryCtx, donorId: string, charityId: Charity["id"]): Promise<Donation[]> {
  const rows = await ctx.db.query("donations").withIndex("by_donor", (q) => q.eq("donorId", donorId)).order("desc").take(OWN_GIFTS_READ_MAX);
  return rows.filter((d) => d.charityId === charityId).map(toDonation);
}

/**
 * The three parts of `rev` (engine computeRev). ONE helper so /donor-view and /donor-pulse agree.
 * Tie rules match buildDonorView: newest log = larger loggedAt then larger key; newest gift =
 * larger createdAt then larger key. `ownGifts` may be passed to avoid a second read.
 */
export async function loadRevParts(
  ctx: QueryCtx,
  donorId: string,
  charityId: Charity["id"],
  now: number,
  ownGifts?: Donation[],
): Promise<{ newestLogId: string | null; narrativeAt: number | null; newestGiftId: string | null }> {
  const window = windowEnding(now);
  const top = await ctx.db
    .query("impactLogs")
    .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId).gte("loggedAt", window.from).lte("loggedAt", window.to))
    .order("desc")
    .take(NEWEST_LOGS_READ);
  let newestLog: { key: string; loggedAt: number } | null = null;
  for (const l of top) {
    if (!newestLog || l.loggedAt > newestLog.loggedAt || (l.loggedAt === newestLog.loggedAt && l.key > newestLog.key)) {
      newestLog = l;
    }
  }

  const newestNarrative = await ctx.db
    .query("narratives")
    .withIndex("by_donor_charity_createdAt", (q) => q.eq("donorId", donorId).eq("charityId", charityId))
    .order("desc")
    .first();

  const gifts = ownGifts ?? (await loadOwnGifts(ctx, donorId, charityId));
  let newestGift: Donation | null = null;
  for (const g of gifts) {
    if (!newestGift || g.createdAt > newestGift.createdAt || (g.createdAt === newestGift.createdAt && g.id > newestGift.id)) {
      newestGift = g;
    }
  }

  return {
    newestLogId: newestLog ? newestLog.key : null,
    narrativeAt: newestNarrative ? newestNarrative.createdAt : null,
    newestGiftId: newestGift ? newestGift.id : null,
  };
}

export async function loadDonorContext(
  ctx: QueryCtx,
  donorId: string,
  charityId: Charity["id"],
  now: number,
): Promise<DonorContext | null> {
  const charityDoc = await ctx.db.query("charities").withIndex("by_key", (q) => q.eq("key", charityId)).unique();
  const donorDoc = await ctx.db.query("donors").withIndex("by_key", (q) => q.eq("key", donorId)).unique();
  if (!charityDoc || !donorDoc) return null;

  const window = windowEnding(now);
  const donations = (
    await ctx.db
      .query("donations")
      .withIndex("by_charity_createdAt", (q) => q.eq("charityId", charityId).gte("createdAt", window.from).lte("createdAt", window.to))
      .collect()
  ).map(toDonation);
  const logDocs = await ctx.db
    .query("impactLogs")
    .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId).gte("loggedAt", window.from).lte("loggedAt", window.to))
    .collect();
  const logs = logDocs.map(toImpactLog);
  const allocations = allocate(donations, logs, window).filter((a) => a.donorId === donorId);

  const assetBase = process.env.ASSET_BASE_URL?.replace(/\/+$/, "");
  const photos: { logId: string; url: string }[] = [];
  for (const d of logDocs) {
    const url = d.photoStorageId
      ? await ctx.storage.getUrl(d.photoStorageId)
      : d.photoPath && assetBase
        ? `${assetBase}/${d.photoPath}`
        : null;
    if (url) photos.push({ logId: d.key, url });
  }

  const ownGifts = await loadOwnGifts(ctx, donorId, charityId);
  const visitRows = await ctx.db
    .query("visits")
    .withIndex("by_donor_charity_at", (q) => q.eq("donorId", donorId).eq("charityId", charityId).gte("at", now - THIRTY_DAYS_MS))
    .take(VISITS_READ_MAX);
  const { narrativeAt } = await loadRevParts(ctx, donorId, charityId, now, ownGifts);

  return {
    charity: toCharity(charityDoc),
    donor: toDonor(donorDoc),
    donations,
    logs,
    allocations,
    window,
    photos,
    ownGifts,
    visitsInLast30Days: visitRows.length,
    narrativeAt,
  };
}

/** Rev parts only, for GET /donor-pulse. Null when the donor or charity does not exist. Nothing else leaves. */
export const revParts = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: async (ctx, args): Promise<{ newestLogId: string | null; narrativeAt: number | null; newestGiftId: string | null } | null> => {
    const charityDoc = await ctx.db.query("charities").withIndex("by_key", (q) => q.eq("key", args.charityId)).unique();
    const donorDoc = await ctx.db.query("donors").withIndex("by_key", (q) => q.eq("key", args.donorId)).unique();
    if (!charityDoc || !donorDoc) return null;
    return loadRevParts(ctx, args.donorId, args.charityId, args.now);
  },
});

export const forDonor = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: (ctx, args) => loadDonorContext(ctx, args.donorId, args.charityId, args.now),
});
