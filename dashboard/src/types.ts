// Data contract from docs/DASHBOARD_SPEC.md. Keep stable; ask via PROGRESS.md Blockers before changing.
export type Money = number; // integer cents

export type DashOverview = {
  period: { from: number; to: number; label: string };
  totalRaised: Money;
  prevPeriodRaised: Money;
  donorCounts: { total: number; new: number; returning: number; lapsed: number };
  mealsServed: number; // record
  expensesTotal: Money;
  costPerMeal: { value: Money | null; isEstimate: true; formula: string };
  recentUpdates: { id: string; kind: string; count: number; unit: string; note?: string; photoUrl?: string; loggedAt: number }[];
};

export type DonorStatus = "new" | "active" | "at_risk" | "lapsed";

export type DashDonor = {
  id: string;
  displayName: string | "Anonymous";
  hideFromTopDonors: boolean;
  totalGiven: Money;
  giftCount: number;
  firstGiftAt: number;
  lastGiftAt: number;
  status: DonorStatus;
  thankedAt: number | null;
};

export type ExpenseCategory = "food" | "transport" | "facility" | "supplies" | "staff" | "other";

export type DashExpense = {
  id: string;
  date: number;
  amount: Money;
  category: ExpenseCategory;
  note?: string;
  receiptPhotoUrl?: string;
};

/** Proposed (not in the v0 contract): see PROGRESS.md Blockers, `dashboard:donorDetail`. */
export type DonorDetail = {
  gifts: { at: number; amountCents: Money; label: string }[];
  preview: {
    story: string; // what the donor currently sees; template or guard-checked narrative
    records: { text: string; dateLabel: string }[]; // logged facts
    estimates: { text: string }[]; // always contains "about"
  };
};

export type NewExpense = Omit<DashExpense, "id">;
