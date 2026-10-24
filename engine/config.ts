// Shared defaults (orchestrator-owned). Spec: docs/PRODUCT_SPEC.md §3, §4, §7, §15.
// Runtime overrides come from Convex env vars where noted; these are the fallbacks.
import type { ImpactKind, TimeWindow } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Rolling allocation window (§3). Never shorter than the demo donor's gift age. */
export const WINDOW_DAYS = 30;
export function windowEnding(now: number, days: number = WINDOW_DAYS): TimeWindow {
  return { from: now - days * DAY_MS, to: now };
}

// Narrative (§4, D8)
export const NARRATIVE_MODEL = "claude-sonnet-5-5";
export const NARRATIVE_TIMEOUT_MS = 15_000;
export const NARRATIVE_MAX_PER_HOUR = 60; // env NARRATIVE_MAX_PER_HOUR
export const NARRATIVE_MIN_INTERVAL_MS = 60_000; // env NARRATIVE_MIN_INTERVAL_MS; per donor+charity

// Donor view (§15)
export const DONOR_VIEW_MAX_PER_MINUTE = 30;

// Donate page (§14)
export const DONATION_MIN_DOLLARS = 1;
export const DONATION_MAX_DOLLARS = 500;
export const DONATION_PRESETS_DOLLARS = [10, 25, 50] as const;
/** Public donate mutation: at most this many test donations per hour across the deployment (audit, Sat 2:45 AM). */
export const DONATIONS_MAX_PER_HOUR = 120;

// Milestones (§7, calibrated in §16)
export const MILESTONE_THRESHOLDS: Record<ImpactKind, readonly number[]> = {
  meals: [25, 50, 100, 250],
  produce: [100, 250, 500],
  volunteer_shifts: [3, 6, 12],
};
export const MILESTONE_EMAIL_MIN_GAP_MS = 7 * DAY_MS;

// Dashboard donor status (DASHBOARD_SPEC data contract)
export const ACTIVE_WITHIN_DAYS = 45;
export const LAPSED_AFTER_DAYS = 90;
