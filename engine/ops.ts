// Ops/health report assembly (T23). Pure TS, no Convex imports.
//
// The Convex wrapper (convex/ops.ts) gathers raw rows; these functions only shape them. Reports carry
// counts, timestamps and enum strings only: no emails, names, donor ids, tokens or note text.
import type { RecipientDecision } from "./milestones";
import { DONOR_STATES } from "./types";
import type { DonorState } from "./types";

export const HOUR_MS = 60 * 60 * 1000;
/** Every count in a report is capped here, so a runaway table can never make a read unbounded. */
export const COUNT_CAP = 1000;

export type NarrativeOutcome = "claude" | "rejected" | "error";
export type NarrativeSource = "claude" | "template";
export type EmailStatus = "sent" | "skipped_not_allowlisted" | "skipped_no_email" | "skipped_rate_limited" | "failed";

/** Counts of visits by donor state shown; "unknown" covers rows with no (or an unrecognised) state. */
export type VisitStateCounts = Record<DonorState | "unknown", number>;

export const VISIT_WINDOW_MS = 24 * HOUR_MS;
/** Upper bound on visit rows scanned for the state counts. */
export const VISIT_SCAN_CAP = 2000;

/** Zero-filled counts for all six states plus "unknown". Pure; takes no ids, only state strings. */
export function countVisitStates(rows: { state?: string | null }[]): VisitStateCounts {
  const out = { unknown: 0 } as VisitStateCounts;
  for (const s of DONOR_STATES) out[s] = 0;
  for (const r of rows) {
    const st = r.state;
    if (typeof st === "string" && (DONOR_STATES as readonly string[]).includes(st)) out[st as DonorState]++;
    else out.unknown++;
  }
  return out;
}

export interface HealthReport {
  narrative: {
    lastCallAt: number | null;
    lastCallOutcome: NarrativeOutcome | null;
    lastSource: NarrativeSource | null;
    lastGuardReasonCount: number | null;
    callsLastHour: number;
    maxPerHour: number;
    minIntervalMs: number;
  };
  milestones: {
    configured: boolean;
    lastRun: {
      at: number;
      smokeSkipped: boolean;
      checked: number;
      sent: number;
      skipped: number;
      failed: number;
    } | null;
  };
  email: { lastStatus: EmailStatus | null; lastAt: number | null; sentTotal: number };
  seed: { charities: number; donors: number; donations: number; impactLogs: number; expenses: number }; // capped at 1000
  smoke: { donors: number; impactLogs: number };
  /** Visits in the last 24 h by donor state shown (counts only, scan capped at VISIT_SCAN_CAP rows). */
  visitStates: VisitStateCounts;
  generatedAt: number;
}

export interface HealthInput {
  now: number;
  /** Newest narrativeCalls row, if any. */
  latestCall: { at: number; outcome: NarrativeOutcome } | null;
  /** `at` of narrativeCalls rows at or after now - 1h (the caller may pre-filter; this re-filters). */
  recentCallAts: number[];
  /** Newest narratives row, if any. */
  latestNarrative: { source: NarrativeSource; guardReasonCount: number } | null;
  maxPerHour: number;
  minIntervalMs: number;
  configured: boolean;
  lastRun: NonNullable<HealthReport["milestones"]["lastRun"]> | null;
  /** Newest milestoneEmails row, if any (sentAt = attempt time). */
  latestEmail: { status: EmailStatus; sentAt: number } | null;
  sentTotal: number;
  seedCounts: HealthReport["seed"];
  smokeCounts: HealthReport["smoke"];
  /** Counts of visits in the last 24 h by state; the caller pre-filters by time. */
  visitStates: VisitStateCounts;
}

const cap = (n: number): number => Math.max(0, Math.min(COUNT_CAP, Math.floor(n)));

export function buildHealth(i: HealthInput): HealthReport {
  const hourAgo = i.now - HOUR_MS;
  return {
    narrative: {
      lastCallAt: i.latestCall ? i.latestCall.at : null,
      lastCallOutcome: i.latestCall ? i.latestCall.outcome : null,
      lastSource: i.latestNarrative ? i.latestNarrative.source : null,
      lastGuardReasonCount: i.latestNarrative ? i.latestNarrative.guardReasonCount : null,
      callsLastHour: cap(i.recentCallAts.filter((at) => at >= hourAgo && at <= i.now).length),
      maxPerHour: i.maxPerHour,
      minIntervalMs: i.minIntervalMs,
    },
    milestones: {
      configured: i.configured,
      lastRun: i.lastRun ? { ...i.lastRun } : null,
    },
    email: {
      lastStatus: i.latestEmail ? i.latestEmail.status : null,
      lastAt: i.latestEmail ? i.latestEmail.sentAt : null,
      sentTotal: cap(i.sentTotal),
    },
    seed: {
      charities: cap(i.seedCounts.charities),
      donors: cap(i.seedCounts.donors),
      donations: cap(i.seedCounts.donations),
      impactLogs: cap(i.seedCounts.impactLogs),
      expenses: cap(i.seedCounts.expenses),
    },
    smoke: { donors: cap(i.smokeCounts.donors), impactLogs: cap(i.smokeCounts.impactLogs) },
    visitStates: Object.fromEntries(
      (Object.keys(countVisitStates([])) as (DonorState | "unknown")[]).map((k) => [k, cap(i.visitStates[k] ?? 0)]),
    ) as VisitStateCounts,
    generatedAt: i.now,
  };
}

export interface DryRunReport {
  configured: boolean;
  candidates: number;
  nothingToAnnounce: number;
  wouldSend: number;
  skippedNoEmail: number;
  skippedNotAllowlisted: number;
  skippedRateLimited: number;
  /** "send" decisions whose address is not on the allowlist. Must be 0 by construction. */
  nonAllowlistedWouldSend: number;
}

export interface DryRunInput {
  configured: boolean;
  allowlist: Set<string>;
  /** One entry per candidate donor+charity. `email` is used for the allowlist assertion only and never returned. */
  items: { outcome: "nothing" | RecipientDecision; email: string | null }[];
}

export function tallyDryRun(i: DryRunInput): DryRunReport {
  const r: DryRunReport = {
    configured: i.configured,
    candidates: i.items.length,
    nothingToAnnounce: 0,
    wouldSend: 0,
    skippedNoEmail: 0,
    skippedNotAllowlisted: 0,
    skippedRateLimited: 0,
    nonAllowlistedWouldSend: 0,
  };
  for (const item of i.items) {
    switch (item.outcome) {
      case "nothing":
        r.nothingToAnnounce++;
        break;
      case "send":
        r.wouldSend++;
        if (!i.allowlist.has((item.email ?? "").trim().toLowerCase())) r.nonAllowlistedWouldSend++;
        break;
      case "skipped_no_email":
        r.skippedNoEmail++;
        break;
      case "skipped_not_allowlisted":
        r.skippedNotAllowlisted++;
        break;
      case "skipped_rate_limited":
        r.skippedRateLimited++;
        break;
    }
  }
  return r;
}
