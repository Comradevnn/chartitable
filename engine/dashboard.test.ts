import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import {
  buildDonors,
  buildExpenses,
  buildOverview,
  costPerMeal,
  donorStatus,
  periodsEnding,
  topDonors,
  validateExpense,
} from "./dashboard";
import { DAY_MS as DAY } from "./config";
import type { Donation, Donor, Expense, ImpactLog } from "./types";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const { period, prevPeriod } = periodsEnding(NOW);

const gift = (id: string, donorId: string, cents: number, daysAgo: number, charityId: Donation["charityId"] = "demo-pantry-a"): Donation => ({
  id,
  donorId,
  charityId,
  amountCents: cents,
  createdAt: NOW - daysAgo * DAY,
  testMode: true,
});

describe("periodsEnding", () => {
  it("builds the last 30 days and the 30 before, without overlap", () => {
    expect(period).toEqual({ from: NOW - 30 * DAY, to: NOW, label: "Last 30 days" });
    expect(prevPeriod.to).toBe(period.from - 1);
    expect(prevPeriod.from).toBe(NOW - 60 * DAY);
  });
  it("honors days and sanitizes bad input", () => {
    expect(periodsEnding(NOW, 7).period.label).toBe("Last 7 days");
    expect(periodsEnding(NOW, -3).period.label).toBe("Last 30 days");
    expect(periodsEnding(NOW, Number.NaN).period.label).toBe("Last 30 days");
    expect(periodsEnding(NOW, 99999).period.label).toBe("Last 365 days");
  });
});

describe("donorStatus", () => {
  const old = (daysAgoLast: number) => [gift("a", "d", 1000, 200), gift("b", "d", 1000, daysAgoLast)];
  it("applies the 45 / 90 day boundaries", () => {
    expect(donorStatus(old(45), period, NOW)).toBe("active");
    expect(donorStatus(old(46), period, NOW)).toBe("at_risk");
    expect(donorStatus(old(90), period, NOW)).toBe("at_risk");
    expect(donorStatus(old(91), period, NOW)).toBe("lapsed");
  });
  it("is new when the first-ever gift is at/after period.from", () => {
    expect(donorStatus([gift("a", "d", 1000, 5)], period, NOW)).toBe("new");
    expect(donorStatus([{ ...gift("a", "d", 1000, 0), createdAt: period.from }], period, NOW)).toBe("new");
    expect(donorStatus([gift("a", "d", 1000, 30.01), gift("b", "d", 1000, 2)], period, NOW)).toBe("active");
  });
});

describe("costPerMeal", () => {
  it("is null at zero meals, always an estimate with its formula", () => {
    const c = costPerMeal(5000, 0);
    expect(c.value).toBeNull();
    expect(c.isEstimate).toBe(true);
    expect(c.formula).toBe("Expenses ÷ meals served in this period (estimate)");
    expect(costPerMeal(5000, -1).value).toBeNull();
  });
  it("rounds to whole cents", () => {
    expect(costPerMeal(1000, 3).value).toBe(333);
    expect(costPerMeal(2000, 3).value).toBe(667);
    expect(costPerMeal(8000, 80)).toMatchObject({ value: 100, isEstimate: true });
  });
});

describe("buildOverview (small fixture)", () => {
  const donations: Donation[] = [
    gift("g1", "d1", 1000, 100),
    gift("g2", "d1", 2000, 10), // d1 returning, active
    gift("g3", "d2", 1500, 100), // d2 lapsed
    gift("g4", "d3", 4000, 50), // d3 at_risk, prev period
    gift("g5", "d4", 3000, 5), // d4 new
    gift("g6", "d5", 9900, 3, "demo-pantry-b"), // other charity: ignored
  ];
  const log = (id: string, kind: ImpactLog["kind"], count: number, daysAgo: number, note: string | null = null): ImpactLog => ({
    id,
    charityId: "demo-pantry-a",
    kind,
    count,
    unit: kind,
    note,
    photoStorageId: null,
    loggedAt: NOW - daysAgo * DAY,
  });
  const logs = [
    log("l1", "meals", 80, 2, "Busy day"),
    log("l2", "produce", 100, 1),
    log("l3", "meals", 40, 40), // outside period
    { ...log("l4", "meals", 999, 1), charityId: "demo-pantry-b" as const },
  ];
  const expense = (id: string, cents: number, daysAgo: number): Expense => ({
    id,
    charityId: "demo-pantry-a",
    date: NOW - daysAgo * DAY,
    amountCents: cents,
    category: "food",
    note: null,
    receiptStorageId: null,
    createdAt: NOW,
  });
  const o = buildOverview({
    charityId: "demo-pantry-a",
    period,
    prevPeriod,
    donations,
    logs,
    expenses: [expense("e1", 8000, 3), expense("e2", 5000, 45)],
    photoUrlByLogId: { l1: "https://example.test/p.jpg" },
    now: NOW,
  });
  it("sums raised in this and the previous period", () => {
    expect(o.totalRaised).toBe(5000);
    expect(o.prevPeriodRaised).toBe(4000);
    expect(o.period.label).toBe("Last 30 days");
  });
  it("counts donors", () => {
    expect(o.donorCounts).toEqual({ total: 4, new: 1, returning: 1, lapsed: 1 });
  });
  it("counts only meals logs in the period, and computes the estimate", () => {
    expect(o.mealsServed).toBe(80);
    expect(o.expensesTotal).toBe(8000);
    expect(o.costPerMeal).toEqual({ value: 100, isEstimate: true, formula: "Expenses ÷ meals served in this period (estimate)" });
  });
  it("lists recent updates newest first with optional fields only when present", () => {
    expect(o.recentUpdates.map((u) => u.id)).toEqual(["l2", "l1"]);
    expect(o.recentUpdates[0]).not.toHaveProperty("note");
    expect(o.recentUpdates[0]).not.toHaveProperty("photoUrl");
    expect(o.recentUpdates[1]).toMatchObject({ note: "Busy day", photoUrl: "https://example.test/p.jpg" });
  });
  it("limits recent updates to 10", () => {
    const many = Array.from({ length: 15 }, (_, i) => log(`m${i}`, "meals", 1, 1 + i * 0.1));
    const r = buildOverview({ charityId: "demo-pantry-a", period, prevPeriod, donations: [], logs: many, expenses: [], photoUrlByLogId: {}, now: NOW });
    expect(r.recentUpdates.length).toBe(10);
    expect(r.mealsServed).toBe(15);
    expect(r.costPerMeal.value).toBe(0); // no expenses logged: 0 ÷ 15 meals
  });
});

describe("buildOverview (seed)", () => {
  const seed = buildSeed(NOW);
  for (const charityId of ["demo-pantry-a", "demo-pantry-b"] as const) {
    it(`is consistent for ${charityId}`, () => {
      const o = buildOverview({
        charityId,
        period,
        prevPeriod,
        donations: seed.donations,
        logs: seed.impactLogs,
        expenses: seed.expenses,
        photoUrlByLogId: {},
        now: NOW,
      });
      // Persona/at-risk donors (a14..a16) and a few earlier gifts sit outside the period.
      const all = seed.donations.filter((d) => d.charityId === charityId);
      const mine = all.filter((d) => d.createdAt >= period.from && d.createdAt <= period.to);
      const prev = all.filter((d) => d.createdAt >= prevPeriod.from && d.createdAt <= prevPeriod.to);
      expect(o.totalRaised).toBe(mine.reduce((s, d) => s + d.amountCents, 0));
      expect(o.prevPeriodRaised).toBe(prev.reduce((s, d) => s + d.amountCents, 0));
      expect(o.donorCounts.total).toBe(new Set(all.map((d) => d.donorId)).size);
      // new = first gift in the period; returning = gave before the period and again in it (Jonas, Omar at A; Lena, Nadia, Ines at B).
      const firstAt = new Map<string, number>();
      for (const d of all) firstAt.set(d.donorId, Math.min(firstAt.get(d.donorId) ?? Infinity, d.createdAt));
      const inPeriodDonors = new Set(mine.map((d) => d.donorId));
      const fresh = [...inPeriodDonors].filter((id) => firstAt.get(id)! >= period.from);
      expect(o.donorCounts.new).toBe(fresh.length);
      expect(o.donorCounts.returning).toBe(inPeriodDonors.size - fresh.length);
      expect(o.donorCounts.returning).toBe(charityId === "demo-pantry-a" ? 2 : 3);
      // Hollis (A, 120 days) and Juno (B, 150 days) are the lapsed donors; Bram (B, 60 days) is at risk, not lapsed.
      expect(o.donorCounts.lapsed).toBe(1);
      const meals = seed.impactLogs.filter((l) => l.charityId === charityId && l.kind === "meals");
      expect(o.mealsServed).toBe(meals.reduce((s, l) => s + l.count, 0));
      expect(o.expensesTotal).toBe(seed.expenses.filter((e) => e.charityId === charityId).reduce((s, e) => s + e.amountCents, 0));
      expect(o.costPerMeal.isEstimate).toBe(true);
      expect(o.costPerMeal.value).toBeGreaterThan(0);
      expect(o.recentUpdates.length).toBe(10);
    });
  }
});

describe("buildDonors / topDonors", () => {
  const seed = buildSeed(NOW);
  const list = buildDonors({ charityId: "demo-pantry-a", donors: seed.donors, donations: seed.donations, period, now: NOW });
  it("includes only donors with gifts to that charity, sorted by total desc then id", () => {
    const expected = new Set(seed.donations.filter((d) => d.charityId === "demo-pantry-a").map((d) => d.donorId));
    expect(new Set(list.map((d) => d.id))).toEqual(expected);
    expect(list.some((d) => d.id === "donor_a12")).toBe(false); // gave only to pantry B
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1]!;
      const b = list[i]!;
      expect(a.totalGiven > b.totalGiven || (a.totalGiven === b.totalGiven && a.id < b.id)).toBe(true);
    }
  });
  it("never leaks an email", () => {
    const donors: Donor[] = seed.donors.map((d) => ({ ...d, email: "someone@example.test" }));
    const l = buildDonors({ charityId: "demo-pantry-a", donors, donations: seed.donations, period, now: NOW });
    expect(JSON.stringify(l)).not.toContain("@");
  });
  it("computes totals and uses Anonymous for missing names", () => {
    const l = buildDonors({
      charityId: "demo-pantry-a",
      donors: [{ id: "x", firstName: null, email: null, thankedAt: 123 }],
      donations: [gift("g1", "x", 1000, 3), gift("g2", "x", 500, 1)],
      period,
      now: NOW,
    });
    expect(l[0]).toMatchObject({ displayName: "Anonymous", totalGiven: 1500, giftCount: 2, status: "new", thankedAt: 123, hideFromTopDonors: false });
    expect(l[0]!.firstGiftAt).toBeLessThan(l[0]!.lastGiftAt);
  });
  it("shows a donor who opted out of public lists as Anonymous", () => {
    const l = buildDonors({
      charityId: "demo-pantry-a",
      donors: [{ id: "h", firstName: "Nadia", email: null, hideFromTopDonors: true }],
      donations: [gift("g1", "h", 1000, 3)],
      period,
      now: NOW,
    });
    expect(l[0]).toMatchObject({ displayName: "Anonymous", hideFromTopDonors: true });
    expect(JSON.stringify(l)).not.toContain("Nadia");
  });
  it("topDonors excludes hidden donors and keeps order", () => {
    const hidden = list.find((d) => d.id === "donor_a07");
    expect(hidden?.hideFromTopDonors).toBe(true);
    const top = topDonors(list, 100);
    expect(top.some((d) => d.hideFromTopDonors)).toBe(false);
    expect(top.length).toBe(list.length - 1);
    expect(top.map((d) => d.id)).toEqual(list.filter((d) => !d.hideFromTopDonors).map((d) => d.id));
    expect(topDonors(list, 2).length).toBe(2);
  });
});

describe("buildExpenses", () => {
  it("is newest first, maps amount, and omits null note / missing receipt", () => {
    const seed = buildSeed(NOW);
    const mine = seed.expenses.filter((e) => e.charityId === "demo-pantry-a");
    const out = buildExpenses(mine, { [mine[0]!.id]: "https://example.test/r.jpg" });
    for (let i = 1; i < out.length; i++) expect(out[i - 1]!.date).toBeGreaterThanOrEqual(out[i]!.date);
    const first = out.find((e) => e.id === mine[0]!.id)!;
    expect(first.receiptPhotoUrl).toBe("https://example.test/r.jpg");
    expect(first.amount).toBe(mine[0]!.amountCents);
    const bare = buildExpenses([{ ...mine[0]!, note: null }], {})[0]!;
    expect(bare).not.toHaveProperty("note");
    expect(bare).not.toHaveProperty("receiptPhotoUrl");
  });
});

describe("validateExpense", () => {
  const ok = { date: NOW - DAY, amountCents: 1250, category: "food", note: "  Groceries  " };
  it("accepts a valid expense and normalizes the note", () => {
    expect(validateExpense(ok, NOW)).toEqual({ ok: true, value: { date: NOW - DAY, amountCents: 1250, category: "food", note: "Groceries" } });
    expect(validateExpense({ ...ok, note: "   " }, NOW)).toMatchObject({ ok: true, value: { note: null } });
    expect(validateExpense({ ...ok, note: undefined }, NOW)).toMatchObject({ ok: true, value: { note: null } });
    expect(validateExpense({ ...ok, amountCents: 10_000_000 }, NOW).ok).toBe(true);
  });
  it("rejects bad input", () => {
    for (const amountCents of [0, -5, 1.5, 10_000_001, "12", Number.NaN]) {
      expect(validateExpense({ ...ok, amountCents }, NOW).ok).toBe(false);
    }
    expect(validateExpense({ ...ok, category: "snacks" }, NOW).ok).toBe(false);
    expect(validateExpense({ ...ok, category: 5 }, NOW).ok).toBe(false);
    expect(validateExpense({ ...ok, note: "x".repeat(201) }, NOW).ok).toBe(false);
    expect(validateExpense({ ...ok, note: "x".repeat(200) }, NOW).ok).toBe(true);
    expect(validateExpense({ ...ok, date: NOW - 730 * DAY }, NOW).ok).toBe(false);
    expect(validateExpense({ ...ok, date: NOW + 730 * DAY }, NOW).ok).toBe(false);
    expect(validateExpense({ ...ok, date: Number.NaN }, NOW).ok).toBe(false);
    expect(validateExpense({ ...ok, date: Infinity }, NOW).ok).toBe(false);
  });
});
