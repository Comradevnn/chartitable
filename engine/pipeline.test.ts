// End-to-end on the fictional seed: allocate → buildFacts → templateFallback → guard.
import { describe, expect, it } from "vitest";
import { buildSeed } from "../seed/data";
import { allocate } from "./allocate";
import { buildFacts } from "./facts";
import { guard } from "./guard";
import { templateFallback } from "./template";

const NOW = Date.UTC(2026, 9, 24, 18, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

describe("seed pipeline", () => {
  const seed = buildSeed(NOW);
  const window = { from: NOW - 21 * DAY, to: NOW };
  const allocations = allocate(seed.donations, seed.impactLogs, window);

  for (const charity of seed.charities) {
    for (const donor of seed.donors) {
      for (const lastVisitAt of [null, NOW - 3 * DAY]) {
        it(`${donor.id} @ ${charity.id} (lastVisit ${lastVisitAt === null ? "none" : "3d"}) passes the guard`, () => {
          const facts = buildFacts({ charity, donor, donations: seed.donations, logs: seed.impactLogs, allocations, window, lastVisitAt });
          const out = templateFallback(facts);
          expect(guard(out, facts)).toEqual({ ok: true });
          expect(JSON.stringify(facts)).not.toContain(donor.id);
        });
      }
    }
  }

  it("the demo donor gets labeled estimates", () => {
    const charity = seed.charities.find((c) => c.id === "demo-pantry-a")!;
    const donor = seed.donors.find((d) => d.id === "donor_a01")!;
    const facts = buildFacts({ charity, donor, donations: seed.donations, logs: seed.impactLogs, allocations, window, lastVisitAt: null });
    expect(facts.estimates.length).toBeGreaterThan(0);
    expect(templateFallback(facts).story).toMatch(/about \d/);
  });
});
