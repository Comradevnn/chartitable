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

  return { charity: toCharity(charityDoc), donor: toDonor(donorDoc), donations, logs, allocations, window, photos };
}

export const forDonor = internalQuery({
  args: { donorId: v.string(), charityId: vCharityId, now: v.number() },
  handler: (ctx, args) => loadDonorContext(ctx, args.donorId, args.charityId, args.now),
});
