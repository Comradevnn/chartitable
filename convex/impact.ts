// Staff update API (T4). Every function is gated by the shared STAFF_PIN.
// Notes are shown verbatim to donors: validated in engine/impact.ts. Never returns donor data
// beyond a count.
import { ConvexError, v } from "convex/values";
import { allocate } from "../engine/allocate";
import { windowEnding } from "../engine/config";
import { validateImpactLog } from "../engine/impact";
import { internal, mutation, query } from "./lib/builders";
import { staffPinMatches } from "./lib/env";
import { toDonation, toImpactLog } from "./lib/mappers";
import { vCharityId } from "./lib/validators";

function requireStaff(pin: string): void {
  if (!staffPinMatches(pin)) throw new ConvexError("unauthorized");
}

function newLogKey(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return "log_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const generateUploadUrl = mutation({
  args: { pin: v.string() },
  handler: async (ctx, { pin }): Promise<string> => {
    requireStaff(pin);
    return await ctx.storage.generateUploadUrl();
  },
});

export const log = mutation({
  args: {
    pin: v.string(),
    charityId: vCharityId,
    kind: v.string(),
    count: v.number(),
    note: v.optional(v.string()),
    photoStorageId: v.optional(v.id("_storage")),
    smoke: v.optional(v.boolean()), // tags the log so seed:cleanSmoke can remove it
  },
  handler: async (
    ctx,
    { pin, charityId, kind, count, note, photoStorageId, smoke },
  ): Promise<{ ok: true; logId: string; donorsCredited: number } | { ok: false; error: "kind" | "count" | "note" }> => {
    requireStaff(pin);
    const checked = validateImpactLog({ kind, count, note });
    if (!checked.ok) return { ok: false, error: checked.error };
    const { value } = checked;

    const now = Date.now();
    const key = newLogKey();
    await ctx.db.insert("impactLogs", {
      key,
      charityId,
      kind: value.kind,
      count: value.count,
      unit: value.unit,
      note: value.note,
      photoStorageId: photoStorageId ?? null,
      photoPath: null,
      loggedAt: now,
      ...(smoke ? { smoke: true } : {}),
    });

    const window = windowEnding(now);
    const donations = (
      await ctx.db
        .query("donations")
        .withIndex("by_charity_createdAt", (q) => q.eq("charityId", charityId).gte("createdAt", window.from))
        .collect()
    ).map(toDonation);
    const newLog = toImpactLog({
      _id: "" as never,
      _creationTime: now,
      key,
      charityId,
      kind: value.kind,
      count: value.count,
      unit: value.unit,
      note: value.note,
      photoStorageId: photoStorageId ?? null,
      photoPath: null,
      loggedAt: now,
    });
    const donorsCredited = new Set(allocate(donations, [newLog], window).map((a) => a.donorId)).size;

    await ctx.scheduler.runAfter(0, internal.allocations.recompute, { charityId });
    // Don't wait up to 5 min for the cron: a staff update is what crosses milestones (§16 demo step 2→3).
    await ctx.scheduler.runAfter(0, internal.milestones.check, {});
    return { ok: true, logId: key, donorsCredited };
  },
});

export const recent = query({
  args: { pin: v.string(), charityId: vCharityId },
  handler: async (ctx, { pin, charityId }) => {
    requireStaff(pin);
    const rows = await ctx.db
      .query("impactLogs")
      .withIndex("by_charity_loggedAt", (q) => q.eq("charityId", charityId))
      .order("desc")
      .take(10);
    return rows.map((r) => ({
      id: r.key,
      kind: r.kind,
      count: r.count,
      unit: r.unit,
      note: r.note,
      hasPhoto: r.photoStorageId !== null || r.photoPath !== null,
      loggedAt: r.loggedAt,
    }));
  },
});
