// Pure dashboard logic (T19). No Convex imports. Money is integer cents.
// Honesty: cost per meal is always an estimate with its formula; meals served is a record.
import { ACTIVE_WITHIN_DAYS, DAY_MS, LAPSED_AFTER_DAYS } from "./config";
import { EXPENSE_CATEGORIES } from "./types";
import type {
  CharityId,
  DashDonor,
  DashExpense,
  DashOverview,
  Donation,
  Donor,
  DonorStatus,
  Expense,
  ExpenseCategory,
  ImpactLog,
} from "./types";

export interface Period {
  from: number; // inclusive
  to: number; // inclusive
  label: string;
}

export const COST_PER_MEAL_FORMULA = "Expenses ÷ meals served in this period (estimate)";
export const MAX_EXPENSE_CENTS = 10_000_000;
export const MAX_EXPENSE_NOTE_CHARS = 200;
const MAX_PERIOD_DAYS = 365;
const RECENT_UPDATES_LIMIT = 10;

/** The `days` ending at `now`, and the same-length period immediately before it (no overlap). */
export function periodsEnding(now: number, days: number = 30): { period: Period; prevPeriod: Period } {
  const d = Number.isFinite(days) && days >= 1 ? Math.min(Math.floor(days), MAX_PERIOD_DAYS) : 30;
  const from = now - d * DAY_MS;
  return {
    period: { from, to: now, label: `Last ${d} days` },
    prevPeriod: { from: from - d * DAY_MS, to: from - 1, label: `Previous ${d} days` },
  };
}

const inPeriod = (t: number, p: { from: number; to: number }) => t >= p.from && t <= p.to;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/**
 * new = first-ever gift to this charity is at/after period.from.
 * Otherwise by days since the last gift as of `now`: <= 45 active, <= 90 at_risk, > 90 lapsed.
 * A donor with no gifts has nothing recent, so reads as lapsed (callers never list them).
 */
export function donorStatus(giftsToCharity: Donation[], period: Period, now: number): DonorStatus {
  if (giftsToCharity.length === 0) return "lapsed";
  let first = Infinity;
  let last = -Infinity;
  for (const g of giftsToCharity) {
    if (g.createdAt < first) first = g.createdAt;
    if (g.createdAt > last) last = g.createdAt;
  }
  if (first >= period.from) return "new";
  const daysSince = (now - last) / DAY_MS;
  if (daysSince <= ACTIVE_WITHIN_DAYS) return "active";
  if (daysSince <= LAPSED_AFTER_DAYS) return "at_risk";
  return "lapsed";
}

export function costPerMeal(expensesCents: number, meals: number): DashOverview["costPerMeal"] {
  return {
    value: meals > 0 ? Math.round(expensesCents / meals) : null,
    isEstimate: true,
    formula: COST_PER_MEAL_FORMULA,
  };
}

function groupByDonor(donations: Donation[]): Map<string, Donation[]> {
  const map = new Map<string, Donation[]>();
  for (const d of donations) {
    const list = map.get(d.donorId);
    if (list) list.push(d);
    else map.set(d.donorId, [d]);
  }
  return map;
}

export function buildOverview(i: {
  charityId: CharityId;
  period: Period;
  prevPeriod: Period;
  donations: Donation[];
  logs: ImpactLog[];
  expenses: Expense[];
  photoUrlByLogId: Record<string, string>;
  now: number;
}): DashOverview {
  const { charityId, period, prevPeriod, now } = i;
  const gifts = i.donations.filter((d) => d.charityId === charityId);

  const totalRaised = sum(gifts.filter((d) => inPeriod(d.createdAt, period)).map((d) => d.amountCents));
  const prevPeriodRaised = sum(gifts.filter((d) => inPeriod(d.createdAt, prevPeriod)).map((d) => d.amountCents));

  // Donor counts consider only gifts made at or before the period end.
  const byDonor = groupByDonor(gifts.filter((d) => d.createdAt <= period.to));
  const counts = { total: byDonor.size, new: 0, returning: 0, lapsed: 0 };
  for (const list of byDonor.values()) {
    const status = donorStatus(list, period, now);
    if (status === "new") counts.new += 1;
    if (status === "lapsed") counts.lapsed += 1;
    const first = Math.min(...list.map((g) => g.createdAt));
    if (first < period.from && list.some((g) => inPeriod(g.createdAt, period))) counts.returning += 1;
  }

  const logsInPeriod = i.logs.filter((l) => l.charityId === charityId && inPeriod(l.loggedAt, period));
  const mealsServed = sum(logsInPeriod.filter((l) => l.kind === "meals").map((l) => l.count));
  const expensesTotal = sum(
    i.expenses.filter((e) => e.charityId === charityId && inPeriod(e.date, period)).map((e) => e.amountCents),
  );

  const recentUpdates = [...logsInPeriod]
    .sort((a, b) => b.loggedAt - a.loggedAt || a.id.localeCompare(b.id))
    .slice(0, RECENT_UPDATES_LIMIT)
    .map((l) => {
      const u: DashOverview["recentUpdates"][number] = {
        id: l.id,
        kind: l.kind,
        count: l.count,
        unit: l.unit,
        loggedAt: l.loggedAt,
      };
      if (l.note !== null) u.note = l.note;
      const photoUrl = i.photoUrlByLogId[l.id];
      if (photoUrl) u.photoUrl = photoUrl;
      return u;
    });

  return {
    period: { from: period.from, to: period.to, label: period.label },
    totalRaised,
    prevPeriodRaised,
    donorCounts: counts,
    mealsServed,
    expensesTotal,
    costPerMeal: costPerMeal(expensesTotal, mealsServed),
    recentUpdates,
  };
}

/** Donors with at least one gift to this charity. Never includes email. */
export function buildDonors(i: {
  charityId: CharityId;
  donors: Donor[];
  donations: Donation[];
  period: Period;
  now: number;
}): DashDonor[] {
  const byDonor = groupByDonor(i.donations.filter((d) => d.charityId === i.charityId));
  const out: DashDonor[] = [];
  for (const donor of i.donors) {
    const gifts = byDonor.get(donor.id);
    if (!gifts || gifts.length === 0) continue;
    out.push({
      id: donor.id,
      displayName: donor.hideFromTopDonors ? "Anonymous" : (donor.firstName ?? "Anonymous"), // "Don't list me publicly"
      hideFromTopDonors: donor.hideFromTopDonors ?? false,
      totalGiven: sum(gifts.map((g) => g.amountCents)),
      giftCount: gifts.length,
      firstGiftAt: Math.min(...gifts.map((g) => g.createdAt)),
      lastGiftAt: Math.max(...gifts.map((g) => g.createdAt)),
      status: donorStatus(gifts, i.period, i.now),
      thankedAt: donor.thankedAt ?? null,
    });
  }
  return out.sort((a, b) => b.totalGiven - a.totalGiven || a.id.localeCompare(b.id));
}

/** Top-donor list: hidden donors are excluded, input order kept. */
export function topDonors(list: DashDonor[], n: number): DashDonor[] {
  return list.filter((d) => !d.hideFromTopDonors).slice(0, Math.max(0, n));
}

export function buildExpenses(expenses: Expense[], receiptUrlById: Record<string, string>): DashExpense[] {
  return [...expenses]
    .sort((a, b) => b.date - a.date || a.id.localeCompare(b.id))
    .map((e) => {
      const x: DashExpense = { id: e.id, date: e.date, amount: e.amountCents, category: e.category };
      if (e.note !== null) x.note = e.note;
      const url = receiptUrlById[e.id];
      if (url) x.receiptPhotoUrl = url;
      return x;
    });
}

export function validateExpense(
  i: { date: unknown; amountCents: unknown; category: unknown; note?: unknown },
  now: number,
):
  | { ok: true; value: { date: number; amountCents: number; category: ExpenseCategory; note: string | null } }
  | { ok: false; error: string } {
  const { date, amountCents, category } = i;
  if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Amount must be a positive whole number of cents." };
  }
  if (amountCents > MAX_EXPENSE_CENTS) {
    return { ok: false, error: "Amount is too large (maximum $100,000)." };
  }
  if (typeof date !== "number" || !Number.isFinite(date) || Math.abs(date - now) > 365 * DAY_MS) {
    return { ok: false, error: "Date must be within one year of today." };
  }
  if (typeof category !== "string" || !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: false, error: "Unknown category." };
  }
  let note: string | null = null;
  if (i.note !== undefined && i.note !== null) {
    if (typeof i.note !== "string") return { ok: false, error: "Note must be text." };
    const trimmed = i.note.trim();
    if (trimmed.length > MAX_EXPENSE_NOTE_CHARS) {
      return { ok: false, error: `Note must be ${MAX_EXPENSE_NOTE_CHARS} characters or fewer.` };
    }
    note = trimmed === "" ? null : trimmed;
  }
  return { ok: true, value: { date, amountCents, category: category as ExpenseCategory, note } };
}
