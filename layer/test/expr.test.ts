// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { evalExpr } from "../src/expr";
import { parseView, type View } from "../src/view";

function viewOf(extra: Record<string, unknown> = {}): View {
  const v = parseView({
    recognized: true,
    hero: { firstName: "Ada", story: "Story." },
    sinceLastVisit: null,
    nextStep: { kind: "give_again", text: "Give again", href: "/donate" },
    records: [{ logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: null }],
    estimates: [{ unit: "meals", approxQuantity: 26 }],
    photos: [],
    ...extra,
  });
  if (!v) throw new Error("view");
  return v;
}

describe("evalExpr", () => {
  const v = viewOf({ donor: { state: "repeat", traits: ["named", "bogus"], gifts: [{ amountDollars: 25, dateLabel: "Oct 1" }], giftCount: 2 } });

  it("handles keys, AND, OR, NOT", () => {
    expect(evalExpr("records", v)).toBe(true);
    expect(evalExpr("records+estimates", v)).toBe(true);
    expect(evalExpr("records+since", v)).toBe(false);
    expect(evalExpr("since|records", v)).toBe(true);
    expect(evalExpr("!since", v)).toBe(true);
    expect(evalExpr("records+!thin", v)).toBe(true);
    expect(evalExpr(" records + ! thin ", v)).toBe(true);
    expect(evalExpr("thin|since+records", v)).toBe(false);
  });
  it("handles state, trait, gifts, repeat, next", () => {
    expect(evalExpr("state:repeat", v)).toBe(true);
    expect(evalExpr("state:lapsed|state:repeat", v)).toBe(true);
    expect(evalExpr("state:lapsed", v)).toBe(false);
    expect(evalExpr("trait:named", v)).toBe(true);
    expect(evalExpr("trait:bogus", v)).toBe(false);
    expect(evalExpr("gifts+repeat+next+nextHref", v)).toBe(true);
    expect(evalExpr("firstName+story", v)).toBe(true);
    expect(evalExpr("headline|body", v)).toBe(false);
  });
  it("unknown key is false, even negated; over-length is false", () => {
    expect(evalExpr("bogus", v)).toBe(false);
    expect(evalExpr("!bogus", v)).toBe(false);
    expect(evalExpr("records+bogus", v)).toBe(false);
    expect(evalExpr("", v)).toBe(false);
    expect(evalExpr("records|".repeat(20) + "records", v)).toBe(false);
  });
  it("missing donor profile: state/trait/gifts/repeat are false, thin works", () => {
    const old = viewOf();
    expect(evalExpr("state:repeat|trait:named|gifts|repeat", old)).toBe(false);
    expect(evalExpr("thin", old)).toBe(false);
    expect(evalExpr("thin", viewOf({ records: [], estimates: [] }))).toBe(true);
  });
  it("repeat needs giftCount >= 2; nextHref needs a safe href", () => {
    expect(evalExpr("repeat", viewOf({ donor: { giftCount: 1 } }))).toBe(false);
    expect(evalExpr("nextHref", viewOf({ nextStep: { text: "x", href: "javascript:alert(1)" } }))).toBe(false);
    expect(evalExpr("nextHref", viewOf({ nextStep: { text: "x", href: null } }))).toBe(false);
  });
});

describe("parseView v2", () => {
  it("reads v2 fields defensively", () => {
    const v = viewOf({
      hero: { firstName: "Ada", story: "S", headline: "Hi", body: 5 },
      nextStep: { kind: "volunteer", text: "t", href: null, label: "Sign up" },
      donor: { state: "nope", traits: "x", gifts: [{ amountDollars: "5", dateLabel: "x" }, { amountDollars: 5, dateLabel: "Oct" }], giftCount: "2" },
      rev: 7,
      live: { pollMs: 6000 },
    });
    expect(v.headline).toBe("Hi");
    expect(v.body).toBeNull();
    expect(v.next?.kind).toBe("volunteer");
    expect(v.next?.label).toBe("Sign up");
    expect(v.donor?.state).toBeNull();
    expect(v.donor?.traits).toEqual([]);
    expect(v.donor?.gifts).toHaveLength(1);
    expect(v.donor?.giftCount).toBeNull();
    expect(v.rev).toBeNull();
    expect(v.pollMs).toBe(6000);
  });
  it("keeps v1 behavior", () => {
    expect(parseView({ recognized: false })).toBe(false);
    expect(parseView(null)).toBeNull();
    expect(parseView({ recognized: true, hero: { story: 1 } })).toBeNull();
    const v = viewOf();
    expect(v.headline).toBeNull();
    expect(v.donor).toBeNull();
    expect(v.pollMs).toBeNull();
  });
});
