import { describe, expect, it } from "vitest";
import { UNIT_FOR_KIND, validateImpactLog } from "./impact";

const ok = (o: { kind: unknown; count: unknown; note?: unknown }) => validateImpactLog(o);

describe("validateImpactLog", () => {
  it("accepts the three kinds and derives unit from kind", () => {
    for (const kind of ["meals", "produce", "volunteer_shifts"] as const) {
      const r = ok({ kind, count: 5 });
      expect(r).toEqual({ ok: true, value: { kind, count: 5, unit: UNIT_FOR_KIND[kind], note: null } });
    }
    expect(UNIT_FOR_KIND.produce).toBe("pounds of produce");
  });

  it("rejects invalid kinds", () => {
    for (const kind of ["", "Meals", "toString", "__proto__", 3, null, undefined]) {
      expect(ok({ kind, count: 5 })).toEqual({ ok: false, error: "kind" });
    }
  });

  it("enforces integer count 1..10000", () => {
    expect(ok({ kind: "meals", count: 1 }).ok).toBe(true);
    expect(ok({ kind: "meals", count: 10000 }).ok).toBe(true);
    for (const count of [0, -1, 10001, 2.5, "5", NaN, Infinity, null, undefined]) {
      expect(ok({ kind: "meals", count })).toEqual({ ok: false, error: "count" });
    }
  });

  it("normalizes notes", () => {
    const get = (note: unknown) => {
      const r = ok({ kind: "meals", count: 5, note });
      return r.ok ? r.value.note : r.error;
    };
    expect(get(undefined)).toBeNull();
    expect(get("")).toBeNull();
    expect(get("   ")).toBeNull();
    expect(get("  Fresh batch  ")).toBe("Fresh batch");
    expect(get("a".repeat(200))).toBe("a".repeat(200));
    expect(get("  " + "a".repeat(200) + "  ")).toBe("a".repeat(200));
    expect(get("a".repeat(201))).toBe("note");
    expect(get(42)).toBe("note");
  });

  it("rejects markup, emails, and links in notes", () => {
    for (const note of ["<b>hi</b>", "a > b", "x@y.z", "see http://x", "see HTTPS://x", "visit https://a.b"]) {
      expect(ok({ kind: "meals", count: 5, note })).toEqual({ ok: false, error: "note" });
    }
  });

  it("reports kind before count before note", () => {
    expect(ok({ kind: "x", count: 0, note: "<" })).toEqual({ ok: false, error: "kind" });
    expect(ok({ kind: "meals", count: 0, note: "<" })).toEqual({ ok: false, error: "count" });
  });
});
