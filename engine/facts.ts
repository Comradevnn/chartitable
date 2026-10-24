// Facts payload builder (T6a). Pure TS, no Convex imports.
//
// DonorFacts is the ONLY data Claude ever sees (D8). Everything here is a whitelist:
// no email, no donorId, nothing about any other donor. Records (what the charity logged)
// and estimates (this donor's proportional share, D1) are kept separate and labeled.

import { roundEstimate } from "./allocate";
import type {
  Allocation,
  Charity,
  Donation,
  DonationFact,
  Donor,
  DonorFacts,
  EstimateFact,
  ImpactLog,
  RecordFact,
  TimeWindow,
} from "./types";

export interface FactsInput {
  charity: Charity;
  donor: Donor;
  donations: Donation[];
  logs: ImpactLog[];
  allocations: Allocation[];
  window: TimeWindow;
  lastVisitAt: number | null;
  timeZone?: string; // default "America/Los_Angeles"
}

const DEFAULT_TIME_ZONE = "America/Los_Angeles";

function dateLabel(ms: number, timeZone: string): string {
  // e.g. "Tue, Oct 20"
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date(ms));
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toRecordFact(log: ImpactLog, timeZone: string): RecordFact {
  return {
    logId: log.id,
    kind: log.kind,
    count: log.count,
    unit: log.unit,
    dateLabel: dateLabel(log.loggedAt, timeZone),
    note: log.note,
    hasPhoto: log.photoStorageId != null,
  };
}

/** Sum a donor's allocations per (kind, unit), round down, drop zeros, stable order. */
function toEstimates(allocations: Allocation[]): EstimateFact[] {
  const sums = new Map<string, { kind: Allocation["kind"]; unit: string; total: number }>();
  for (const a of allocations) {
    const key = `${a.kind}\u0000${a.unit}`;
    const cur = sums.get(key);
    if (cur) cur.total += a.estimatedQuantity;
    else sums.set(key, { kind: a.kind, unit: a.unit, total: a.estimatedQuantity });
  }
  const out: EstimateFact[] = [];
  for (const { kind, unit, total } of sums.values()) {
    const approxQuantity = roundEstimate(total);
    if (approxQuantity > 0) out.push({ kind, unit, approxQuantity, marker: "about" });
  }
  out.sort((a, b) => cmp(a.kind, b.kind) || cmp(a.unit, b.unit));
  return out;
}

export function buildFacts(input: FactsInput): DonorFacts {
  const { charity, donor, window, lastVisitAt } = input;
  const timeZone = input.timeZone ?? DEFAULT_TIME_ZONE;
  const inWindow = (t: number) => t >= window.from && t <= window.to;

  // Defensive filters: only THIS donor's gifts/allocations to THIS charity.
  const myDonations = input.donations
    .filter((d) => d.donorId === donor.id && d.charityId === charity.id && inWindow(d.createdAt))
    .sort((a, b) => a.createdAt - b.createdAt || cmp(a.id, b.id));
  const donations: DonationFact[] = myDonations.map((d) => ({
    amountDollars: d.amountCents / 100,
    dateLabel: dateLabel(d.createdAt, timeZone),
  }));
  const totalGivenDollars = myDonations.reduce((s, d) => s + d.amountCents, 0) / 100;

  const logs = input.logs
    .filter((l) => l.charityId === charity.id && inWindow(l.loggedAt))
    .sort((a, b) => a.loggedAt - b.loggedAt || cmp(a.id, b.id));
  const records = logs.map((l) => toRecordFact(l, timeZone));

  const myAllocations = input.allocations.filter(
    (a) => a.donorId === donor.id && a.charityId === charity.id && inWindow(a.loggedAt),
  );
  const estimates = toEstimates(myAllocations);

  const sinceLastVisit =
    lastVisitAt == null
      ? null
      : {
          sinceDateLabel: dateLabel(lastVisitAt, timeZone),
          records: logs.filter((l) => l.loggedAt > lastVisitAt).map((l) => toRecordFact(l, timeZone)),
          estimates: toEstimates(myAllocations.filter((a) => a.loggedAt > lastVisitAt)),
        };

  const firstName = donor.firstName?.trim() || null;

  return {
    charityName: charity.name,
    donorFirstName: firstName,
    donations,
    totalGivenDollars,
    records,
    estimates,
    sinceLastVisit,
    thinData: estimates.length === 0 || records.length < 2,
  };
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as object).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

/** SHA-256 hex over canonical (sorted-key) JSON. Stable for equal facts; cache key for narratives. */
export async function hashFacts(facts: DonorFacts): Promise<string> {
  const json = JSON.stringify(canonicalize(facts));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
