import { describe, expect, it } from "vitest";
import { PANTRY_A_EMPTY_DAY_BUCKET, SEED_NOTICE, buildSeed, planUpserts } from "./data";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const seed = buildSeed(NOW);
const bucket = (t: number) => Math.floor((NOW - t) / DAY);

describe("seed data", () => {
  it("is deterministic and relative to now", () => {
    expect(buildSeed(NOW)).toEqual(seed);
    const later = buildSeed(NOW + DAY);
    expect(later.donations.map((d) => d.createdAt)).toEqual(seed.donations.map((d) => d.createdAt + DAY));
    expect(later.impactLogs.map((l) => l.id)).toEqual(seed.impactLogs.map((l) => l.id));
    expect(later.expenses.map((e) => e.date)).toEqual(seed.expenses.map((e) => e.date + DAY));
  });

  it("has the expected shape and sizes", () => {
    expect(SEED_NOTICE).toMatch(/Fictional/);
    expect(seed.charities.map((c) => c.id)).toEqual(["demo-pantry-a", "demo-pantry-b"]);
    expect(seed.charities.every((c) => c.fictional)).toBe(true);
    expect(seed.donors.length).toBe(12);
    expect(seed.donations.length).toBe(25);
    for (const d of seed.donations) {
      expect(d.createdAt).toBeLessThanOrEqual(NOW);
      expect(d.createdAt).toBeGreaterThanOrEqual(NOW - 21 * DAY);
      expect(d.amountCents).toBeGreaterThanOrEqual(1000);
      expect(d.amountCents).toBeLessThanOrEqual(10000);
      expect(Number.isInteger(d.amountCents)).toBe(true);
      expect(d.testMode).toBe(true);
    }
    const buckets = new Set(seed.impactLogs.map((l) => bucket(l.loggedAt)));
    expect([...buckets].every((b) => b >= 0 && b <= 6)).toBe(true);
    expect(buckets.size).toBe(7);
    const kinds = new Set(seed.impactLogs.map((l) => l.kind));
    expect(kinds).toEqual(new Set(["meals", "produce", "volunteer_shifts"]));
    expect(seed.impactLogs.some((l) => l.photoPath)).toBe(true);
  });

  it("demo donor has a single $25 gift", () => {
    const gifts = seed.donations.filter((d) => d.donorId === "donor_a01");
    expect(gifts.map((g) => g.amountCents)).toEqual([2500]);
  });

  it("references existing donors and charities; ids are unique", () => {
    const donorIds = new Set(seed.donors.map((d) => d.id));
    const charityIds = new Set<string>(seed.charities.map((c) => c.id));
    for (const d of seed.donations) {
      expect(donorIds.has(d.donorId)).toBe(true);
      expect(charityIds.has(d.charityId)).toBe(true);
    }
    for (const l of seed.impactLogs) expect(charityIds.has(l.charityId)).toBe(true);
    for (const rows of [seed.charities, seed.donors, seed.donations, seed.impactLogs, seed.expenses]) {
      expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
    }
  });

  it("covers edge cases", () => {
    const windowStart = NOW - 7 * DAY;
    // a donor with gifts overall but zero in the latest 7-day window
    const zeroInWindow = seed.donors.filter((d) => {
      const gifts = seed.donations.filter((g) => g.donorId === d.id);
      return gifts.length > 0 && gifts.every((g) => g.createdAt < windowStart);
    });
    expect(zeroInWindow.length).toBeGreaterThanOrEqual(1);

    // a late donor: only gift lands after every log of that charity
    const late = seed.donors.filter((d) => {
      const gifts = seed.donations.filter((g) => g.donorId === d.id);
      if (gifts.length !== 1) return false;
      const g = gifts[0]!;
      return seed.impactLogs.filter((l) => l.charityId === g.charityId).every((l) => l.loggedAt < g.createdAt);
    });
    expect(late.map((d) => d.id)).toContain("donor_a12");

    // a pantry day with no logs for demo-pantry-a (but not for B)
    const days = (id: string) =>
      new Set(seed.impactLogs.filter((l) => l.charityId === id).map((l) => bucket(l.loggedAt)));
    expect(days("demo-pantry-a").has(PANTRY_A_EMPTY_DAY_BUCKET)).toBe(false);
    expect(days("demo-pantry-a").size).toBe(6);
    expect(days("demo-pantry-b").size).toBe(7);
  });

  it("contains no '@' anywhere except Donor.email (which is null)", () => {
    expect(seed.donors.every((d) => d.email === null)).toBe(true);
    const { donors, ...rest } = seed;
    expect(JSON.stringify(rest)).not.toContain("@");
    expect(JSON.stringify(donors.map(({ email: _e, ...d }) => d))).not.toContain("@");
  });

  it("has no real-org names and no personal data in log notes", () => {
    const text = JSON.stringify([seed.charities, seed.impactLogs.map((l) => l.note)]);
    expect(text).not.toMatch(/Feeding America|Second Harvest/i);
  });
});

describe("seed expenses", () => {
  it("has ~8 per charity with valid ids, categories, amounts, and dates", () => {
    const categories = new Set(["food", "transport", "facility", "supplies", "staff", "other"]);
    for (const id of ["demo-pantry-a", "demo-pantry-b"]) {
      expect(seed.expenses.filter((e) => e.charityId === id).length).toBe(8);
    }
    seed.expenses.forEach((e, i) => {
      expect(e.id).toBe(`exp_a${String(i + 1).padStart(3, "0")}`);
      expect(categories.has(e.category)).toBe(true);
      expect(Number.isInteger(e.amountCents) && e.amountCents > 0).toBe(true);
      expect(e.date).toBeLessThanOrEqual(NOW);
      expect(e.date).toBeGreaterThanOrEqual(NOW - 30 * DAY);
      expect(e.receiptStorageId).toBeNull();
    });
    expect(seed.expenses.some((e) => e.category === "other")).toBe(true);
  });

  it("hides exactly donor_a07 from top donors", () => {
    expect(seed.donors.filter((d) => d.hideFromTopDonors).map((d) => d.id)).toEqual(["donor_a07"]);
  });
});

describe("planUpserts idempotency", () => {
  it("first run inserts everything, second run (even with a later now) inserts nothing", () => {
    const rerun = buildSeed(NOW + 1000);
    const tables: [{ id: string }[], { id: string }[]][] = [
      [seed.charities, rerun.charities],
      [seed.donors, rerun.donors],
      [seed.donations, rerun.donations],
      [seed.impactLogs, rerun.impactLogs],
      [seed.expenses, rerun.expenses],
    ];
    for (const [first, second] of tables) {
      const existing = new Set<string>();
      const run1 = planUpserts(existing, first);
      expect(run1.insert.length).toBe(first.length);
      expect(run1.update.length).toBe(0);
      for (const r of run1.insert) existing.add(r.id);
      const run2 = planUpserts(existing, second);
      expect(run2.insert.length).toBe(0);
      expect(run2.update.length).toBe(second.length);
    }
  });
});
