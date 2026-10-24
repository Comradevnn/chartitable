// Demo calibration (PRODUCT_SPEC §16). If this fails after a seed or window change, fix the
// threshold/window defaults in the spec and engine/config.ts — never the meaning of these asserts.
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import { allocate, roundEstimate } from "./allocate";
import { MILESTONE_THRESHOLDS, windowEnding } from "./config";
import type { ImpactLog } from "./types";

const NOW = Date.parse("2026-10-24T08:00:00Z");
const DEMO_DONOR = "donor_a01";
const FIRST_MEALS_MILESTONE = MILESTONE_THRESHOLDS.meals[0]!;

function demoMeals(logs: ImpactLog[], at: number): number {
  const seed = buildSeed(NOW);
  return allocate(seed.donations, logs, windowEnding(at))
    .filter((a) => a.donorId === DEMO_DONOR && a.charityId === "demo-pantry-a" && a.kind === "meals")
    .reduce((sum, a) => sum + a.estimatedQuantity, 0);
}

describe("demo calibration (§16)", () => {
  const seed = buildSeed(NOW);
  const staffUpdateAt = NOW + 60_000;
  const served80: ImpactLog = {
    id: "log_demo_80",
    charityId: "demo-pantry-a",
    kind: "meals",
    count: 80,
    unit: "meals",
    note: null,
    photoStorageId: null,
    loggedAt: staffUpdateAt,
  };
  const before = demoMeals(seed.impactLogs, NOW);
  const after = demoMeals([...seed.impactLogs, served80], staffUpdateAt);

  it("demo donor has about 23 meals before the staff update", () => {
    expect(before).toBeGreaterThan(23 - 0.5);
    expect(before).toBeLessThan(23 + 0.5);
  });

  it("about 26.8 meals after staff post 'served 80 meals'", () => {
    expect(after).toBeGreaterThan(26.8 - 0.5);
    expect(after).toBeLessThan(26.8 + 0.5);
  });

  it("crosses the first meals milestone only after the update", () => {
    expect(before).toBeLessThan(FIRST_MEALS_MILESTONE);
    expect(after).toBeGreaterThanOrEqual(FIRST_MEALS_MILESTONE);
  });

  it("the displayed estimate never overstates", () => {
    expect(roundEstimate(after)).toBeLessThanOrEqual(after);
    expect(roundEstimate(after)).toBe(26);
  });
});
