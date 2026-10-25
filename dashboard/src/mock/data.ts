// DEMO DATA (fictional). Swap for Convex queries behind ../data.ts. No real people or organizations.
import type { DashDonor, DashExpense, DashOverview, DonorDetail } from "../types";

export const NOW = Date.UTC(2026, 9, 24, 19); // Sat Oct 24, 2026 noon PT
const D = 86_400_000;
const ago = (days: number) => NOW - days * D;

export const charityName = "Demo Pantry (fictional)";

export const donors: DashDonor[] = [
  { id: "d1", displayName: "Mira Okafor", hideFromTopDonors: false, totalGiven: 15000, giftCount: 5, firstGiftAt: ago(160), lastGiftAt: ago(9), status: "active", thankedAt: ago(8) },
  { id: "d2", displayName: "Tomas Reyes", hideFromTopDonors: false, totalGiven: 12500, giftCount: 3, firstGiftAt: ago(120), lastGiftAt: ago(21), status: "active", thankedAt: null },
  { id: "d3", displayName: "Anonymous", hideFromTopDonors: true, totalGiven: 10000, giftCount: 2, firstGiftAt: ago(200), lastGiftAt: ago(70), status: "at_risk", thankedAt: ago(68) },
  { id: "d4", displayName: "Priya Nandakumar", hideFromTopDonors: false, totalGiven: 7500, giftCount: 3, firstGiftAt: ago(95), lastGiftAt: ago(40), status: "active", thankedAt: ago(39) },
  { id: "d5", displayName: "Jonas Eklund", hideFromTopDonors: false, totalGiven: 5000, giftCount: 2, firstGiftAt: ago(150), lastGiftAt: ago(104), status: "lapsed", thankedAt: ago(103) },
  { id: "d6", displayName: "Lena Whitcombe", hideFromTopDonors: false, totalGiven: 2500, giftCount: 1, firstGiftAt: ago(3), lastGiftAt: ago(3), status: "new", thankedAt: null },
  { id: "d7", displayName: "Dev Malhotra", hideFromTopDonors: false, totalGiven: 2500, giftCount: 1, firstGiftAt: ago(6), lastGiftAt: ago(6), status: "new", thankedAt: null },
  { id: "d8", displayName: "Anonymous", hideFromTopDonors: true, totalGiven: 2000, giftCount: 1, firstGiftAt: ago(55), lastGiftAt: ago(55), status: "at_risk", thankedAt: null },
];

export const expenses: DashExpense[] = [
  { id: "e1", date: ago(2), amount: 21400, category: "food", note: "Rice, beans, canned tomatoes" },
  { id: "e2", date: ago(6), amount: 6800, category: "transport", note: "Van fuel, two pickup runs" },
  { id: "e3", date: ago(9), amount: 12000, category: "facility", note: "Cold storage rental, October" },
  { id: "e4", date: ago(13), amount: 4350, category: "supplies", note: "Bags and gloves" },
  { id: "e5", date: ago(17), amount: 18950, category: "food", note: "Produce and eggs" },
  { id: "e6", date: ago(24), amount: 15000, category: "staff", note: "Volunteer coordinator stipend" },
  { id: "e7", date: ago(27), amount: 2500, category: "other", note: "Printing for flyers" },
];

/** Mock donor detail. Gift dates are spread evenly between first and last gift; real data comes from Convex. */
export function donorDetail(id: string): DonorDetail | null {
  const d = donors.find((x) => x.id === id);
  if (!d) return null;
  const n = d.giftCount;
  const each = Math.round(d.totalGiven / n);
  const gifts = Array.from({ length: n }, (_, i) => ({
    at: n === 1 ? d.firstGiftAt : Math.round(d.firstGiftAt + ((d.lastGiftAt - d.firstGiftAt) * i) / (n - 1)),
    amountCents: i === n - 1 ? d.totalGiven - each * (n - 1) : each,
    label: "Gift",
  })).reverse();
  const pool = donors.reduce((s, x) => s + x.totalGiven, 0);
  const shareMeals = Math.round((d.totalGiven / pool) * mealsServed);
  const first = d.hideFromTopDonors || d.displayName === "Anonymous" ? "friend" : d.displayName.split(" ")[0];
  return {
    gifts,
    preview: {
      story: `${first}, thank you for your ${n === 1 ? "gift" : "gifts"}. Gifts are pooled, so your share of what the pantry logged is an estimate.`,
      records: overviewRecords.slice(0, 2),
      estimates: [{ text: `about ${shareMeals} meals (estimate, your proportional share of pooled gifts)` }],
    },
  };
}

const overviewRecords = [
  { text: "86 meals", dateLabel: "Wed, Oct 21" },
  { text: "11 volunteer shifts", dateLabel: "Thu, Oct 16" },
];

const mealsServed = 520;
const periodFrom = ago(30);

/**
 * The demo overview for a given ledger. Expenses in the period and cost per meal are worked out from `rows`, so the
 * overview moves with Add expense / Remove / Undo. Same window as the period label (the last 30 days; the demo "now"
 * is fixed, so nothing logged is ever after it) and same formula: expenses in the period ÷ meals served, rounded to cents.
 */
export function overviewFor(rows: DashExpense[]): DashOverview {
  const expensesTotal = rows.filter((e) => e.date >= periodFrom).reduce((s, e) => s + e.amount, 0);
  return {
    period: { from: periodFrom, to: NOW, label: "Last 30 days" },
    totalRaised: 24500,
    prevPeriodRaised: 19000,
    donorCounts: { total: donors.length, new: 2, returning: 5, lapsed: 1 }, // returning = active + at risk, so the parts sum to the total
    mealsServed,
    expensesTotal,
    costPerMeal: {
      value: Math.round(expensesTotal / mealsServed),
      isEstimate: true,
      formula: "Expenses in the period ($" + (expensesTotal / 100).toFixed(2) + ") ÷ meals served logged by staff (" + mealsServed + ")",
    },
    recentUpdates: [
      { id: "u1", kind: "meals", count: 86, unit: "meals", note: "Hot supper in the side room.", loggedAt: ago(3) },
      { id: "u2", kind: "produce", count: 140, unit: "pounds of produce", note: "Apples and squash from the Saturday farm drop.", loggedAt: ago(7) },
      { id: "u3", kind: "volunteer_shifts", count: 11, unit: "volunteer shifts", note: "Evening restock crew.", loggedAt: ago(8) },
      { id: "u4", kind: "meals", count: 94, unit: "meals", loggedAt: ago(10) },
      { id: "u5", kind: "meals", count: 78, unit: "meals", loggedAt: ago(14) },
    ],
  };
}
