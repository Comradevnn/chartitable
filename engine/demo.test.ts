import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import type { SeedData } from "../seed/data";
import { allocate, roundEstimate } from "./allocate";
import { windowEnding } from "./config";
import {
  DEMO_PRESETS,
  HOST_PATHS,
  PERSONAS,
  PIN_LOCK_WINDOW_MS,
  PIN_MAX_FAILURES,
  PROBE_TTL_MS,
  constantTimeEqual,
  donorPersonas,
  overallStatus,
  personaById,
  pinLocked,
  presetById,
  probeFresh,
  publicPersonas,
  stagedVisitAt,
} from "./demo";
import type { Persona } from "./demo";
import { buildDonorView, narrativeFacts } from "./donor-view";
import type { DonorViewContext } from "./donor-view";
import { validateImpactLog } from "./impact";
import { templateFallback } from "./template";
import type { ImpactLog, NarrativeResult } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-10-24T20:00:00Z");
const STATES = ["stranger", "first_impact", "just_gave", "news", "repeat", "lapsed"] as const;

const newestLogAt = (seed: SeedData, charityId: string, extra: ImpactLog[] = []): number | null => {
  const times = [...seed.impactLogs, ...extra].filter((l) => l.charityId === charityId).map((l) => l.loggedAt);
  return times.length ? Math.max(...times) : null;
};

/** Mirrors convex/context.ts loadDonorContext + the donor-view endpoint, over seed rows (plus optional staff logs). */
function viewFor(persona: Persona, seed: SeedData, now: number, previousVisitAt: number | null, extraLogs: ImpactLog[] = []) {
  const donorId = persona.donorId!;
  const window = windowEnding(now);
  const charity = seed.charities.find((c) => c.id === persona.charityId)!;
  const donor = seed.donors.find((d) => d.id === donorId)!;
  const donations = seed.donations.filter((d) => d.charityId === persona.charityId && d.createdAt >= window.from && d.createdAt <= window.to);
  const logs = [...seed.impactLogs, ...extraLogs].filter((l) => l.charityId === persona.charityId && l.loggedAt >= window.from && l.loggedAt <= window.to);
  const allocations = allocate(donations, logs, window).filter((a) => a.donorId === donorId);
  const context: DonorViewContext = { charity, donor, donations, logs, allocations, window, photos: [] };
  const narrative: NarrativeResult = { output: templateFallback(narrativeFacts(context)), source: "template", guardReasons: [] };
  const ownGifts = seed.donations.filter((d) => d.donorId === donorId && d.charityId === persona.charityId);
  return buildDonorView({ context, previousVisitAt, narrative, donateHref: null, ownGifts, visitsInLast30Days: 0 });
}

describe("persona map", () => {
  const seed = buildSeed(NOW);

  it("has 12 personas with unique ids and one of each state per charity", () => {
    expect(PERSONAS.length).toBe(12);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(12);
    for (const charityId of ["demo-pantry-a", "demo-pantry-b"] as const) {
      const mine = PERSONAS.filter((p) => p.charityId === charityId);
      expect(mine.map((p) => p.state).sort()).toEqual([...STATES].sort());
      expect(mine.filter((p) => p.hero).length).toBe(1);
    }
  });

  it("stranger has no donor; every other persona has a seed donor with a gift at its charity", () => {
    for (const p of PERSONAS) {
      if (p.state === "stranger") {
        expect(p.donorId).toBeNull();
        continue;
      }
      expect(seed.donors.some((d) => d.id === p.donorId)).toBe(true);
      expect(seed.donations.some((d) => d.donorId === p.donorId && d.charityId === p.charityId)).toBe(true);
    }
    expect(donorPersonas().length).toBe(10);
  });

  it("only a-first-impact (donor_a01) is the email persona", () => {
    expect(PERSONAS.filter((p) => p.email).map((p) => [p.id, p.donorId])).toEqual([["a-first-impact", "donor_a01"]]);
  });

  it("publicPersonas hides donor ids and carries the host path", () => {
    const pub = publicPersonas();
    expect(pub.length).toBe(12);
    for (const p of pub) {
      expect("donorId" in p).toBe(false);
      expect(p.hostPath).toBe(HOST_PATHS[p.charityId]);
    }
  });

  it("personaById round-trips and returns null for unknown ids", () => {
    for (const p of PERSONAS) expect(personaById(p.id)).toBe(p);
    expect(personaById("nope")).toBeNull();
  });
});

describe("classification at reset time", () => {
  for (const [label, now] of [["reset", NOW], ["reset + 3 hours", NOW + 3 * HOUR]] as const) {
    it(`every donor persona classifies to its intended state (${label})`, () => {
      const seed = buildSeed(now);
      for (const p of donorPersonas()) {
        const prev = stagedVisitAt(p, now, newestLogAt(seed, p.charityId));
        const view = viewFor(p, seed, now, prev);
        if (!view.recognized || !view.donor) throw new Error(`${p.id} not recognized`);
        expect({ id: p.id, state: view.donor.state }).toEqual({ id: p.id, state: p.state });
      }
    });
  }

  it("live flip: staff preset meals80 turns the open first-impact page into news with a ~26 meal estimate", () => {
    const seed = buildSeed(NOW);
    const persona = personaById("a-first-impact")!;
    const prev = stagedVisitAt(persona, NOW, newestLogAt(seed, persona.charityId));
    const preset = presetById("meals80")!;
    const staffLog: ImpactLog = {
      id: "log_staff_demo",
      charityId: persona.charityId,
      kind: preset.kind,
      count: preset.count,
      unit: "meals",
      note: preset.note,
      photoStorageId: null,
      loggedAt: NOW + 60_000,
    };
    const view = viewFor(persona, seed, NOW + 120_000, prev, [staffLog]);
    if (!view.recognized || !view.donor) throw new Error("not recognized");
    expect(view.donor.state).toBe("news");
    const meals = view.estimates.find((e) => e.kind === "meals");
    expect(meals).toBeDefined();
    expect(meals!.approxQuantity).toBeGreaterThanOrEqual(25);
    expect(roundEstimate(meals!.approxQuantity)).toBe(26);
  });
});

describe("stagedVisitAt", () => {
  const seed = buildSeed(NOW);
  const personas = (state: Persona["state"]) => PERSONAS.filter((p) => p.state === state);

  it("is null for stranger and lapsed", () => {
    for (const p of [...personas("stranger"), ...personas("lapsed")]) {
      expect(stagedVisitAt(p, NOW, newestLogAt(seed, p.charityId))).toBeNull();
    }
  });

  it("news is three days ago", () => {
    for (const p of personas("news")) expect(stagedVisitAt(p, NOW, newestLogAt(seed, p.charityId))).toBe(NOW - 3 * DAY);
  });

  it("others sit after the newest log, before now, and within the last hour when possible", () => {
    const others = PERSONAS.filter((p) => !["stranger", "lapsed", "news"].includes(p.state));
    for (const p of others) {
      const newest = newestLogAt(seed, p.charityId)!;
      const at = stagedVisitAt(p, NOW, newest)!;
      expect(at).toBeGreaterThanOrEqual(newest + MIN);
      expect(at).toBeLessThanOrEqual(NOW - 1000);
      expect(at).toBeGreaterThanOrEqual(NOW - HOUR); // newest log is older than an hour, so the hour floor applies
    }
    const p = personas("repeat")[0]!;
    expect(stagedVisitAt(p, NOW, null)).toBe(NOW - HOUR);
    expect(stagedVisitAt(p, NOW, NOW - 10 * MIN)).toBe(NOW - 9 * MIN); // a log newer than the hour floor: one minute after it
    expect(stagedVisitAt(p, NOW, NOW - 30_000)).toBe(NOW - 1000); // very fresh log: clamped below now
  });
});

describe("presets", () => {
  it("each passes validateImpactLog; ids unique; presetById round-trips; unknown is null", () => {
    expect(new Set(DEMO_PRESETS.map((p) => p.id)).size).toBe(DEMO_PRESETS.length);
    for (const p of DEMO_PRESETS) {
      expect(validateImpactLog({ kind: p.kind, count: p.count, note: p.note }).ok).toBe(true);
      expect(presetById(p.id)).toBe(p);
    }
    expect(presetById("nope")).toBeNull();
  });
});

describe("PIN helpers", () => {
  it("constantTimeEqual", () => {
    expect(constantTimeEqual("1234", "1234")).toBe(true);
    expect(constantTimeEqual("1234", "1235")).toBe(false);
    expect(constantTimeEqual("1234", "12345")).toBe(false);
    expect(constantTimeEqual("12345", "1234")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
    expect(constantTimeEqual("", "1")).toBe(false);
  });

  it("pinLocked trips at the max failures within the window only", () => {
    const recent = (n: number) => Array.from({ length: n }, (_, i) => NOW - 1000 - i);
    expect(pinLocked(recent(PIN_MAX_FAILURES - 1), NOW)).toBe(false);
    expect(pinLocked(recent(PIN_MAX_FAILURES), NOW)).toBe(true);
    const old = Array.from({ length: 20 }, () => NOW - PIN_LOCK_WINDOW_MS - 1);
    expect(pinLocked(old, NOW)).toBe(false);
    expect(pinLocked([...recent(PIN_MAX_FAILURES - 1), ...old], NOW)).toBe(false);
    const future = Array.from({ length: 20 }, () => NOW + 1000);
    expect(pinLocked(future, NOW)).toBe(false);
    expect(pinLocked([...recent(PIN_MAX_FAILURES - 1), ...future], NOW)).toBe(false);
  });
});

describe("preflight helpers", () => {
  const c = (status: "green" | "amber" | "red") => ({ status });
  it("overallStatus: worst wins, empty is red", () => {
    expect(overallStatus([])).toBe("red");
    expect(overallStatus([c("green"), c("red"), c("amber")])).toBe("red");
    expect(overallStatus([c("green"), c("amber")])).toBe("amber");
    expect(overallStatus([c("green"), c("green")])).toBe("green");
  });

  it("probeFresh", () => {
    expect(probeFresh(null, NOW)).toBe(false);
    expect(probeFresh(NOW - 1000, NOW)).toBe(true);
    expect(probeFresh(NOW - PROBE_TTL_MS, NOW)).toBe(false);
    expect(probeFresh(NOW - PROBE_TTL_MS - 1, NOW)).toBe(false);
  });
});
