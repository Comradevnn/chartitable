import { describe, expect, it } from "vitest";
import { boundedToken, chooseDonor, DONATE_TOKEN_MAX, redirectUrl, validateDonation, keepAllowlistedEmail } from "./donate";

const base = { charityId: "demo-pantry-a", amountCents: 2500 };

describe("validateDonation", () => {
  it("accepts a minimal donation with defaults", () => {
    expect(validateDonation(base)).toEqual({
      ok: true,
      value: { charityId: "demo-pantry-a", amountCents: 2500, firstName: null, email: null, hideFromTopDonors: false },
    });
  });

  it("enforces amount bounds", () => {
    for (const a of [0, 99, -100, 50001, 25.5, NaN, Infinity, "2500", null, undefined]) {
      expect(validateDonation({ ...base, amountCents: a })).toEqual({ ok: false, error: "amount" });
    }
    for (const a of [100, 2500, 50000]) {
      expect(validateDonation({ ...base, amountCents: a }).ok).toBe(true);
    }
  });

  it("rejects unknown charity", () => {
    for (const c of ["nope", "", undefined, 5, null]) {
      expect(validateDonation({ ...base, charityId: c })).toEqual({ ok: false, error: "charity" });
    }
  });

  it("validates firstName", () => {
    const ok = (n: unknown) => validateDonation({ ...base, firstName: n });
    expect(ok("  Ana-María O'Neil ")).toMatchObject({ ok: true, value: { firstName: "Ana-María O'Neil" } });
    expect(ok("José")).toMatchObject({ ok: true });
    expect(ok("   ")).toMatchObject({ ok: true, value: { firstName: null } });
    expect(ok("")).toMatchObject({ ok: true, value: { firstName: null } });
    expect(ok("a".repeat(40))).toMatchObject({ ok: true });
    expect(ok("a".repeat(41))).toEqual({ ok: false, error: "firstName" });
    expect(ok("<b>")).toEqual({ ok: false, error: "firstName" });
    expect(ok("Sam3")).toEqual({ ok: false, error: "firstName" });
    expect(ok(42)).toEqual({ ok: false, error: "firstName" });
  });

  it("validates email", () => {
    const e = (x: unknown) => validateDonation({ ...base, email: x });
    expect(e("  Demo@Example.COM ")).toMatchObject({ ok: true, value: { email: "demo@example.com" } });
    expect(e("   ")).toMatchObject({ ok: true, value: { email: null } });
    expect(e("")).toMatchObject({ ok: true, value: { email: null } });
    for (const bad of ["nope", "a@b", "a b@c.com", "@x.com", "a@@b.com"]) {
      expect(e(bad)).toEqual({ ok: false, error: "email" });
    }
    const long = "a".repeat(250) + "@b.co"; // 255 chars
    expect(e(long)).toEqual({ ok: false, error: "email" });
    const exactly254 = "a".repeat(254 - "@b.co".length) + "@b.co";
    expect(exactly254.length).toBe(254);
    expect(e(exactly254).ok).toBe(true);
  });

  it("hideFromTopDonors defaults false and only true when boolean true", () => {
    expect(validateDonation({ ...base, hideFromTopDonors: true })).toMatchObject({ value: { hideFromTopDonors: true } });
    expect(validateDonation({ ...base, hideFromTopDonors: false })).toMatchObject({ value: { hideFromTopDonors: false } });
    expect(validateDonation({ ...base, hideFromTopDonors: "true" })).toMatchObject({ value: { hideFromTopDonors: false } });
  });
});

describe("keepAllowlistedEmail", () => {
  it("keeps only allowlisted addresses", () => {
    const allow = new Set(["demo@example.com"]);
    expect(keepAllowlistedEmail("demo@example.com", allow)).toBe("demo@example.com");
    expect(keepAllowlistedEmail("stranger@example.com", allow)).toBeNull();
    expect(keepAllowlistedEmail(null, allow)).toBeNull();
    expect(keepAllowlistedEmail("demo@example.com", new Set())).toBeNull();
  });
});

describe("redirectUrl", () => {
  it("sets exactly one ct param", () => {
    const u = new URL(redirectUrl("https://pantry-a.example/donor", "tok.sig"));
    expect([...u.searchParams.keys()]).toEqual(["ct"]);
    expect(u.searchParams.get("ct")).toBe("tok.sig");
  });

  it("strips existing query and hash", () => {
    const out = redirectUrl("http://localhost:5173/page?a=1#x", "t");
    const u = new URL(out);
    expect([...u.searchParams.keys()]).toEqual(["ct"]);
    expect(u.hash).toBe("");
    expect(u.pathname).toBe("/page");
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => redirectUrl("javascript:alert(1)", "t")).toThrow();
    expect(() => redirectUrl("ftp://x", "t")).toThrow();
    expect(() => redirectUrl("not a url", "t")).toThrow();
  });

  it("never carries the donor's email", () => {
    const v = validateDonation({ ...base, email: "Secret@Demo.test", firstName: "Ana" });
    if (!v.ok) throw new Error("expected ok");
    const out = redirectUrl("https://pantry-a.example/", "opaque.token");
    expect(out).not.toContain("secret");
    expect(out).not.toContain(encodeURIComponent(v.value.email!));
    expect(out).not.toContain("Ana");
  });
});

describe("chooseDonor", () => {
  it("reuses the donor only when the token verified and the row exists", () => {
    expect(chooseDonor({ tokenOk: true, donorExists: true })).toBe("existing");
    expect(chooseDonor({ tokenOk: true, donorExists: false })).toBe("new");
    expect(chooseDonor({ tokenOk: false, donorExists: true })).toBe("new");
    expect(chooseDonor({ tokenOk: false, donorExists: false })).toBe("new");
  });
});

describe("boundedToken", () => {
  it("accepts a bounded non-empty string", () => {
    expect(boundedToken("abc.def")).toBe("abc.def");
    expect(boundedToken("  abc.def ")).toBe("abc.def");
    expect(boundedToken("a".repeat(DONATE_TOKEN_MAX))).toHaveLength(DONATE_TOKEN_MAX);
  });
  it("rejects empty, oversized and non-string values", () => {
    for (const bad of ["", "   ", "a".repeat(DONATE_TOKEN_MAX + 1), 5, null, undefined, {}]) {
      expect(boundedToken(bad)).toBeNull();
    }
  });
});
