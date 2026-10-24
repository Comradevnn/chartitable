import { describe, expect, it } from "vitest";
import { allocate, roundEstimate } from "./allocate";
import type { CharityId, Donation, ImpactLog } from "./types";

const A: CharityId = "demo-pantry-a";
const B: CharityId = "demo-pantry-b";

function don(id: string, donorId: string, cents: number, createdAt: number, charityId: CharityId = A): Donation {
  return { id, donorId, charityId, amountCents: cents, createdAt, testMode: true };
}
function log(id: string, loggedAt: number, count = 80, charityId: CharityId = A): ImpactLog {
  return { id, charityId, kind: "meals", count, unit: "meals", note: null, photoStorageId: null, loggedAt };
}

const W = { from: 0, to: 1000 };

describe("allocate", () => {
  const donations = [
    don("d1", "alice", 2500, 10),
    don("d2", "bob", 7500, 20),
    don("d3", "carol", 5000, 500), // late donor
    don("d4", "alice", 9900, 30, B), // other charity
  ];
  const logs = [log("l1", 100), log("l2", 600, 100), log("l3", 2000)]; // l3 outside window

  it("shares per log sum to 1 when eligible donations exist", () => {
    const res = allocate(donations, logs, W);
    for (const id of ["l1", "l2"]) {
      const sum = res.filter((a) => a.logId === id).reduce((s, a) => s + a.share, 0);
      expect(sum).toBeLessThanOrEqual(1 + 1e-9);
      expect(sum).toBeCloseTo(1, 9);
    }
    expect(res.every((a) => a.isEstimate)).toBe(true);
    expect(res.some((a) => a.logId === "l3")).toBe(false);
  });

  it("returns [] with no NaN when no donations are eligible", () => {
    expect(allocate([], logs, W)).toEqual([]);
    expect(allocate(donations, [log("x", 5)], W)).toEqual([]); // before any gift
    const onlyB = allocate([don("b1", "z", 100, 1, B)], logs, W);
    expect(onlyB).toEqual([]);
  });

  it("late donor gets nothing from logs before their gift", () => {
    const res = allocate(donations, logs, W);
    expect(res.filter((a) => a.logId === "l1").some((a) => a.donorId === "carol")).toBe(false);
    const l2carol = res.find((a) => a.logId === "l2" && a.donorId === "carol");
    expect(l2carol?.share).toBeCloseTo(5000 / 15000, 12);
  });

  it("single donor gets share 1 only inside the window and after their gift", () => {
    const one = [don("s", "solo", 1000, 50)];
    const ls = [log("before", 40), log("in", 60), log("out", 5000)];
    const res = allocate(one, ls, W);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ logId: "in", donorId: "solo", share: 1, estimatedQuantity: 80 });
  });

  it("ignores donations to the other charity and non-positive amounts", () => {
    const res = allocate(
      [don("x", "alice", 100, 1), don("y", "bob", 0, 1), don("z", "carol", -500, 1), don("o", "dave", 9999, 1, B)],
      [log("l", 10)],
      W,
    );
    expect(res.map((a) => a.donorId)).toEqual(["alice"]);
    expect(res[0]?.share).toBe(1);
  });

  it("ignores donations before the window start", () => {
    const res = allocate([don("e", "early", 100, 5), don("n", "now", 100, 15)], [log("l", 20)], { from: 10, to: 100 });
    expect(res.map((a) => a.donorId)).toEqual(["now"]);
  });

  it("attributableFraction scales estimatedQuantity, clamps, and rejects NaN", () => {
    const full = allocate(donations, logs, W)[0]!;
    const half = allocate(donations, logs, W, { attributableFraction: 0.5 })[0]!;
    expect(half.estimatedQuantity).toBeCloseTo(full.estimatedQuantity / 2, 12);
    expect(half.share).toBe(full.share);
    expect(allocate(donations, logs, W, { attributableFraction: 5 })[0]?.estimatedQuantity).toBe(full.estimatedQuantity);
    expect(allocate(donations, logs, W, { attributableFraction: -1 })[0]?.estimatedQuantity).toBe(0);
    expect(() => allocate(donations, logs, W, { attributableFraction: NaN })).toThrow();
  });

  it("copies log metadata onto each allocation", () => {
    const res = allocate([don("d", "a", 100, 1)], [log("l", 10, 7)], W);
    expect(res[0]).toEqual({
      donorId: "a", charityId: A, logId: "l", kind: "meals", unit: "meals", loggedAt: 10,
      share: 1, estimatedQuantity: 7, isEstimate: true,
    });
  });

  it("is deterministic regardless of input order and does not mutate inputs", () => {
    const ds = [...donations];
    const ls = [...logs];
    const dsSnap = JSON.stringify(ds);
    const lsSnap = JSON.stringify(ls);
    const forward = allocate(ds, ls, W);
    const reversed = allocate([...donations].reverse(), [...logs].reverse(), W);
    expect(reversed).toEqual(forward);
    expect(JSON.stringify(ds)).toBe(dsSnap);
    expect(JSON.stringify(ls)).toBe(lsSnap);
    // ordering: loggedAt asc, logId asc, donorId asc
    const same = allocate(
      [don("1", "zed", 100, 1), don("2", "amy", 100, 1)],
      [log("b", 50), log("a", 50), log("c", 40)],
      W,
    );
    expect(same.map((a) => `${a.logId}:${a.donorId}`)).toEqual(["c:amy", "c:zed", "a:amy", "a:zed", "b:amy", "b:zed"]);
  });
});

describe("roundEstimate", () => {
  it("matches the rule", () => {
    expect(roundEstimate(0.999)).toBe(0);
    expect(roundEstimate(0)).toBe(0);
    expect(roundEstimate(1)).toBe(1);
    expect(roundEstimate(1.9)).toBe(1);
    expect(roundEstimate(99.99)).toBe(99);
    expect(roundEstimate(100)).toBe(100);
    expect(roundEstimate(104.9)).toBe(100);
    expect(roundEstimate(109.99)).toBe(105);
    expect(roundEstimate(0.1 * 30)).toBe(3);
    expect(roundEstimate(-5)).toBe(0);
    expect(roundEstimate(NaN)).toBe(0);
    expect(roundEstimate(Infinity)).toBe(0);
  });

  it("never exceeds the input (beyond 1e-9)", () => {
    const samples = [0.999, 1, 99.99, 100, 104.9, 0.1 * 30, 0.3 * 10, 2.9999999999];
    for (let i = 0; i < 5000; i++) samples.push(i * 0.37, i / 7, i * 0.1 * 3);
    for (const v of samples) {
      const r = roundEstimate(v);
      expect(r).toBeLessThanOrEqual(v + 1e-9);
      expect(Number.isInteger(r)).toBe(true);
      if (v >= 100) expect(r % 5).toBe(0);
    }
  });
});
