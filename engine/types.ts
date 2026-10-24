// Shared contract between lanes. Owned by the orchestrator — lanes import, never edit.
// If you need a change, report it; the orchestrator changes this file and logs it.
//
// Conventions:
// - All timestamps are milliseconds since epoch (UTC).
// - Money is integer cents in storage; facts for Claude carry whole dollars.
// - All charities and donors are fictional (D5).

export const CHARITY_IDS = ["demo-pantry-a", "demo-pantry-b"] as const;
export type CharityId = (typeof CHARITY_IDS)[number];

export interface Charity {
  id: CharityId;
  name: string; // invented display name
  siteUrl: string; // where the donate page redirects back to
  fictional: true;
}

export interface Donor {
  id: string; // opaque, e.g. "donor_7f3a"; never derived from name/email
  firstName: string | null; // display only
  email: string | null; // demo inboxes only (D4); never in URLs or API responses
  hideFromTopDonors?: boolean; // "Don't list me publicly" (dashboard top-donor lists)
  thankedAt?: number | null; // staff marked as thanked (dashboard)
}

export interface Donation {
  id: string;
  donorId: string;
  charityId: CharityId;
  amountCents: number; // positive integer
  createdAt: number;
  testMode: true;
}

export type ImpactKind = "meals" | "produce" | "volunteer_shifts";

/** A fact the charity's staff logged. This is a record, never an estimate. */
export interface ImpactLog {
  id: string;
  charityId: CharityId;
  kind: ImpactKind;
  count: number; // e.g. 80
  unit: string; // e.g. "meals", "pounds of produce", "volunteer shifts"
  note: string | null; // staff free text, shown verbatim
  photoStorageId: string | null;
  loggedAt: number;
}

export interface TimeWindow {
  from: number; // inclusive
  to: number; // inclusive
}

/** One donor's proportional share of one log. Always an estimate (D1). */
export interface Allocation {
  donorId: string;
  charityId: CharityId;
  logId: string;
  kind: ImpactKind;
  unit: string;
  loggedAt: number;
  share: number; // 0..1 of this log's output attributed to this donor
  estimatedQuantity: number; // unrounded: share * log.count * attributableFraction
  isEstimate: true;
}

export interface AllocateOptions {
  /** Fraction of a log's output attributable to tracked donations (0..1). Default 1. */
  attributableFraction?: number;
}

// ---- Facts payload: the ONLY data Claude sees (D8) ----

export interface RecordFact {
  logId: string;
  kind: ImpactKind;
  count: number;
  unit: string;
  dateLabel: string; // preformatted, e.g. "Tue, Oct 20"
  note: string | null;
  hasPhoto: boolean;
}

export interface EstimateFact {
  kind: ImpactKind;
  unit: string;
  approxQuantity: number; // already passed through roundEstimate(); never overstated
  marker: "about"; // narration must carry "about"/"estimate"
}

export interface DonationFact {
  amountDollars: number;
  dateLabel: string;
}

export interface DonorFacts {
  charityName: string;
  donorFirstName: string | null;
  donations: DonationFact[]; // donor's own gifts (records)
  totalGivenDollars: number;
  records: RecordFact[]; // charity-wide logged facts in the window
  estimates: EstimateFact[]; // this donor's proportional share, aggregated by kind
  sinceLastVisit: {
    sinceDateLabel: string;
    records: RecordFact[];
    estimates: EstimateFact[];
  } | null;
  thinData: boolean; // true → say less
  /** v2: next-step kind chosen by the donor-state rule (engine/donor-state.ts); Claude writes only the text. */
  nextStepKind?: NextStepKind;
}

// ---- Donor state (contract v2, deterministic rules in engine/donor-state.ts) ----

/** Priority order: the first rule that matches wins. */
export const DONOR_STATES = ["just_gave", "news", "first_impact", "repeat", "lapsed", "returning"] as const;
export type DonorState = (typeof DONOR_STATES)[number];

export const DONOR_TRAITS = ["named", "has_photos", "regular"] as const;
export type DonorTrait = (typeof DONOR_TRAITS)[number];

export interface DonorProfile {
  state: DonorState;
  traits: DonorTrait[];
  gifts: DonationFact[]; // the donor's own gifts at this charity, all-time, newest first (records)
  giftCount: number;
}

// ---- Narrative ----

export type NextStepKind = "give_again" | "give_monthly" | "volunteer" | "share";

export interface NarrativeOutput {
  /** v2 (T30): number-free headline; checked by guard() like every other field. */
  headline?: string;
  story: string;
  nextStep: { kind: NextStepKind; text: string };
}

export type GuardResult = { ok: true } | { ok: false; reasons: string[] };

export interface NarrativeResult {
  output: NarrativeOutput;
  source: "claude" | "template";
  guardReasons: string[]; // why Claude output was rejected; empty if accepted or not tried
}

// ---- Tokens (D6) ----

export interface TokenPayload {
  donorId: string; // opaque id only
  charityId: CharityId;
  exp: number; // ms epoch
}

export type TokenVerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: "malformed" | "bad-signature" | "expired" };

// ---- GET /donor-view response (layer.js consumes it) ----
// Contract v2 fields are optional and additive: a v1 layer ignores them, and buildDonorView fills
// them from T24 on. GET /donor-view?peek=1 returns the same shape without recording a visit.

export type DonorView =
  | { recognized: false }
  | {
      recognized: true;
      hero: {
        firstName: string | null;
        story: string;
        source: "claude" | "template";
        headline?: string; // v2: number-free; deterministic per state, or Claude under the guard (T30)
        body?: string; // v2: story without a leading thank-you sentence
      };
      sinceLastVisit: { sinceDateLabel: string; records: RecordFact[]; estimates: EstimateFact[] } | null;
      nextStep: {
        kind: NextStepKind;
        text: string;
        href: string | null;
        label?: string; // v2: ≤ 4 words from a fixed table per kind
      };
      records: RecordFact[]; // render as .ct-record
      estimates: EstimateFact[]; // render as .ct-estimate with visible "about"/"estimate"
      photos: { logId: string; url: string }[];
      donor?: DonorProfile; // v2
      rev?: string; // v2: opaque change marker, compared against GET /donor-pulse
      live?: { pollMs: number } | null; // v2: null = don't poll
    };

/** GET /donor-pulse: cheap change check for live updates. Never records a visit. */
export type DonorPulse = { recognized: false } | { recognized: true; rev: string };

// ---- Expenses (T19 dashboard) ----

export const EXPENSE_CATEGORIES = ["food", "transport", "facility", "supplies", "staff", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  charityId: CharityId;
  date: number; // ms epoch of the expense
  amountCents: number; // positive integer
  category: ExpenseCategory;
  note: string | null;
  receiptStorageId: string | null;
  createdAt: number;
}

// ---- Dashboard data contract (docs/DASHBOARD_SPEC.md; Lane B builds against these) ----

export type Money = number; // integer cents

export interface DashOverview {
  period: { from: number; to: number; label: string };
  totalRaised: Money;
  prevPeriodRaised: Money;
  donorCounts: { total: number; new: number; returning: number; lapsed: number };
  mealsServed: number; // record: sum of impactLogs with kind "meals" in the period
  expensesTotal: Money;
  costPerMeal: { value: Money | null; isEstimate: true; formula: string }; // null if meals = 0
  recentUpdates: {
    id: string;
    kind: string;
    count: number;
    unit: string;
    note?: string;
    photoUrl?: string;
    loggedAt: number;
  }[];
}

export type DonorStatus = "new" | "active" | "at_risk" | "lapsed";

export interface DashDonor {
  id: string;
  displayName: string | "Anonymous";
  hideFromTopDonors: boolean;
  totalGiven: Money;
  giftCount: number;
  firstGiftAt: number;
  lastGiftAt: number;
  status: DonorStatus;
  thankedAt: number | null;
}

export interface DashExpense {
  id: string;
  date: number;
  amount: Money;
  category: ExpenseCategory;
  note?: string;
  receiptPhotoUrl?: string;
}

// ---- Milestones (T9) ----

export interface MilestoneHit {
  kind: ImpactKind;
  threshold: number;
  thresholdId: string; // e.g. "meals:25"; stored so each fires once per donor+charity
}
