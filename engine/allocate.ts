// Proportional, time-windowed allocation engine (T5). Pure TS, no Convex imports.
//
// Allocation rule (honesty rule D1: these are proportional estimates, never traced dollars):
// - Only logs with window.from <= loggedAt <= window.to are allocated.
// - For a log L, eligible donations are those with the same charityId as L and
//   window.from <= createdAt <= L.loggedAt. A gift made after a log never gets credit for it.
// - A donor's share of L = (sum of that donor's eligible amountCents) / (sum of all eligible amountCents).
//   One Allocation per (donor, log) with share > 0.
// - estimatedQuantity = share * L.count * attributableFraction (default 1, clamped to [0, 1]; NaN throws).
// - A log with no eligible donations yields no allocations. Donations with amountCents <= 0 are ignored.
// - isEstimate is always true. Output is sorted by loggedAt asc, logId asc, donorId asc.
// - Inputs are never mutated.

import type { Allocation, AllocateOptions, Donation, ImpactLog, TimeWindow } from "./types";

const EPSILON = 1e-9;

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function allocate(
  donations: Donation[],
  logs: ImpactLog[],
  window: TimeWindow,
  opts: AllocateOptions = {},
): Allocation[] {
  const rawFraction = opts.attributableFraction ?? 1;
  if (Number.isNaN(rawFraction)) {
    throw new Error("attributableFraction must not be NaN");
  }
  const fraction = Math.min(1, Math.max(0, rawFraction));

  const validDonations = donations.filter(
    (d) => d.amountCents > 0 && d.createdAt >= window.from,
  );
  const logsInWindow = logs.filter(
    (l) => l.loggedAt >= window.from && l.loggedAt <= window.to,
  );

  const out: Allocation[] = [];
  for (const log of logsInWindow) {
    const byDonor = new Map<string, number>();
    let total = 0;
    for (const d of validDonations) {
      if (d.charityId !== log.charityId || d.createdAt > log.loggedAt) continue;
      byDonor.set(d.donorId, (byDonor.get(d.donorId) ?? 0) + d.amountCents);
      total += d.amountCents;
    }
    if (total <= 0) continue;
    for (const [donorId, cents] of byDonor) {
      const share = cents / total;
      if (!(share > 0)) continue;
      out.push({
        donorId,
        charityId: log.charityId,
        logId: log.id,
        kind: log.kind,
        unit: log.unit,
        loggedAt: log.loggedAt,
        share,
        estimatedQuantity: share * log.count * fraction,
        isEstimate: true,
      });
    }
  }

  out.sort(
    (a, b) =>
      a.loggedAt - b.loggedAt ||
      compareStrings(a.logId, b.logId) ||
      compareStrings(a.donorId, b.donorId),
  );
  return out;
}

/**
 * Round an estimate DOWN so we never overstate (D1).
 * value < 1 -> 0 (thin data: say less); 1..<100 -> floor; >= 100 -> floor to a multiple of 5.
 * Negative, NaN, or non-finite -> 0. A 1e-9 epsilon absorbs float error (0.1 * 30 is 3, not 2)
 * while never exceeding the input by more than 1e-9.
 */
export function roundEstimate(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const v = value + EPSILON;
  if (v < 1) return 0;
  if (v < 100) return Math.floor(v);
  return Math.floor(v / 5) * 5;
}
