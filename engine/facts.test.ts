import { describe, expect, it } from "vitest";
import { allocate } from "./allocate";
import { buildFacts, hashFacts, hashInput, type FactsInput } from "./facts";
import { PROMPT_VERSION } from "./prompt";
import type { Charity, Donation, Donor, ImpactLog } from "./types";

const charity: Charity = {
  id: "demo-pantry-a",
  name: "Juniper Street Pantry",
  siteUrl: "http://localhost:5173",
  fictional: true,
};
const priya: Donor = { id: "donor_priya1", firstName: "Priya", email: "priya.secret@example.test" };
const omar: Donor = { id: "donor_omar2", firstName: "Omar", email: "omar.secret@example.test" };

const at = (m: number, d: number, h = 19) => Date.UTC(2026, m - 1, d, h); // 19:00 UTC = noon PT
const don = (id: string, donorId: string, cents: number, createdAt: number, charityId: Charity["id"] = "demo-pantry-a"): Donation => ({
  id, donorId, charityId, amountCents: cents, createdAt, testMode: true,
});
const log = (id: string, loggedAt: number, count: number, unit = "meals", kind: ImpactLog["kind"] = "meals", charityId: Charity["id"] = "demo-pantry-a", photo: string | null = null, note: string | null = null): ImpactLog => ({
  id, charityId, kind, count, unit, note, photoStorageId: photo, loggedAt,
});

const window = { from: at(10, 1), to: at(10, 23) };
const donations: Donation[] = [
  don("d1", priya.id, 2500, at(10, 5)),
  don("d2", priya.id, 1250, at(10, 12)),
  don("d3", omar.id, 7500, at(10, 6)),
  don("d4", priya.id, 9900, at(10, 6), "demo-pantry-b"), // other charity
  don("d5", priya.id, 4000, at(9, 20)), // before window
];
const logs: ImpactLog[] = [
  log("l1", at(10, 8), 80, "meals", "meals", "demo-pantry-a", "photo_1", "Packed boxes on Thursday"),
  log("l2", at(10, 15), 200, "pounds of produce", "produce"),
  log("l3", at(10, 20), 60),
  log("lx", at(10, 16), 999, "meals", "meals", "demo-pantry-b"), // other charity
  log("lo", at(9, 1), 50), // before window
];

function input(over: Partial<FactsInput> = {}): FactsInput {
  return {
    charity, donor: priya, donations, logs,
    allocations: allocate(donations, logs, window),
    window, lastVisitAt: null, ...over,
  };
}

describe("buildFacts", () => {
  it("includes only this donor's gifts to this charity within the window", () => {
    const f = buildFacts(input());
    expect(f.donations).toEqual([
      { amountDollars: 25, dateLabel: "Mon, Oct 5" },
      { amountDollars: 12.5, dateLabel: "Mon, Oct 12" },
    ]);
    expect(f.totalGivenDollars).toBe(37.5);
  });

  it("includes only this charity's logs in the window, verbatim, sorted", () => {
    const f = buildFacts(input());
    expect(f.records.map((r) => r.logId)).toEqual(["l1", "l2", "l3"]);
    expect(f.records[0]).toMatchObject({
      count: 80, unit: "meals", dateLabel: "Thu, Oct 8", note: "Packed boxes on Thursday", hasPhoto: true,
    });
    expect(f.records[1]?.hasPhoto).toBe(false);
  });

  it("never leaks email, donorId, or other donors", () => {
    const json = JSON.stringify(buildFacts(input()));
    for (const s of [priya.email!, omar.email!, priya.id, omar.id, "Omar", "donor_"]) {
      expect(json).not.toContain(s);
    }
  });

  it("ignores allocations for other donors/charities and rounds estimates down", () => {
    const base = allocate(donations, logs, window);
    const extra = [
      ...base,
      { ...base[0]!, donorId: omar.id, estimatedQuantity: 500 },
      { ...base[0]!, charityId: "demo-pantry-b" as const, estimatedQuantity: 500 },
    ];
    const f = buildFacts(input({ allocations: extra }));
    const mine = base.filter((a) => a.donorId === priya.id);
    const rawMeals = mine.filter((a) => a.kind === "meals").reduce((s, a) => s + a.estimatedQuantity, 0);
    const meals = f.estimates.find((e) => e.kind === "meals")!;
    expect(meals.approxQuantity).toBeLessThanOrEqual(rawMeals);
    expect(meals.approxQuantity).toBeGreaterThan(0);
    expect(meals.marker).toBe("about");
    for (const e of f.estimates) expect(Number.isInteger(e.approxQuantity)).toBe(true);
  });

  it("drops zero estimates (missing data: say less)", () => {
    const tiny = [{
      donorId: priya.id, charityId: charity.id, logId: "l1", kind: "meals" as const, unit: "meals",
      loggedAt: at(10, 8), share: 0.001, estimatedQuantity: 0.4, isEstimate: true as const,
    }];
    const f = buildFacts(input({ allocations: tiny }));
    expect(f.estimates).toEqual([]);
    expect(f.thinData).toBe(true);
  });

  it("orders estimates by kind and aggregates per (kind, unit)", () => {
    const f = buildFacts(input());
    expect(f.estimates.map((e) => e.kind)).toEqual(["meals", "produce"]);
    expect(f.thinData).toBe(false);
  });

  it("thinData when fewer than two records", () => {
    const f = buildFacts(input({ logs: [logs[0]!], allocations: allocate(donations, [logs[0]!], window) }));
    expect(f.thinData).toBe(true);
  });

  it("sinceLastVisit is null when lastVisitAt is null", () => {
    expect(buildFacts(input()).sinceLastVisit).toBeNull();
  });

  it("sinceLastVisit keeps only records and estimates after the last visit", () => {
    const f = buildFacts(input({ lastVisitAt: at(10, 15, 20) })); // after l2 (19:00), before l3
    expect(f.sinceLastVisit?.sinceDateLabel).toBe("Thu, Oct 15");
    expect(f.sinceLastVisit?.records.map((r) => r.logId)).toEqual(["l3"]);
    expect(f.sinceLastVisit?.estimates.map((e) => e.kind)).toEqual(["meals"]);
    const none = buildFacts(input({ lastVisitAt: at(10, 22) }));
    expect(none.sinceLastVisit).toEqual({ sinceDateLabel: "Thu, Oct 22", records: [], estimates: [] });
  });

  it("respects the time zone for date labels", () => {
    const edge = Date.UTC(2026, 9, 21, 3); // Oct 20 8pm PT, Oct 21 in UTC
    const f = buildFacts(input({ logs: [log("e1", edge, 10), log("e2", edge + 1, 10)] }));
    expect(f.records[0]?.dateLabel).toBe("Tue, Oct 20");
    const utc = buildFacts(input({ logs: [log("e1", edge, 10), log("e2", edge + 1, 10)], timeZone: "UTC" }));
    expect(utc.records[0]?.dateLabel).toBe("Wed, Oct 21");
  });

  it("is deterministic and does not mutate inputs", () => {
    const inp = input({ lastVisitAt: at(10, 10) });
    const snapshot = JSON.stringify(inp);
    expect(buildFacts(inp)).toEqual(buildFacts(inp));
    expect(JSON.stringify(inp)).toBe(snapshot);
  });

  it("trims blank donor names to null", () => {
    expect(buildFacts(input({ donor: { ...priya, firstName: "  " } })).donorFirstName).toBeNull();
  });
});

describe("hashFacts", () => {
  it("is stable for equal facts, regardless of key order", async () => {
    const f = buildFacts(input());
    const reverseKeys = (v: any): any =>
      Array.isArray(v)
        ? v.map(reverseKeys)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.keys(v).sort().reverse().map((k) => [k, reverseKeys(v[k])]))
          : v;
    const reordered = reverseKeys(f);
    const h1 = await hashFacts(f);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashFacts(buildFacts(input()))).toBe(h1);
    expect(await hashFacts(reordered)).toBe(h1);
  });

  it("changes when a record changes", async () => {
    const f = buildFacts(input());
    const changed = buildFacts(input({ logs: [log("l1", at(10, 8), 81), logs[1]!, logs[2]!] }));
    expect(await hashFacts(changed)).not.toBe(await hashFacts(f));
  });

  it("includes PROMPT_VERSION, so a prompt change regenerates cached narratives", async () => {
    const f = buildFacts(input());
    const sha = async (t: string) =>
      Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))), (b) => b.toString(16).padStart(2, "0")).join("");
    expect(await hashFacts(f)).toBe(await sha(hashInput(f)));
    expect(hashInput(f)).toContain(PROMPT_VERSION);
    expect(hashInput(f, "some-other-version")).not.toBe(hashInput(f));
    expect(await sha(hashInput(f, "some-other-version"))).not.toBe(await hashFacts(f));
    // never the bare facts hash used before T30
    expect(await hashFacts(f)).not.toBe(await sha(JSON.stringify(f)));
  });
});
