import { describe, expect, it } from "vitest";
import { DEFAULT_TOKEN_TTL_MS, signToken, verifyToken } from "./token";
import type { TokenPayload } from "./types";

const SECRET = "test-only-fake-secret-not-real-0123456789";
const NOW = 1_800_000_000_000;
const payload: TokenPayload = { donorId: "donor_t0001", charityId: "demo-pantry-a", exp: NOW + DEFAULT_TOKEN_TTL_MS };

const enc = (s: string) =>
  btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const dec = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));

describe("donor tokens", () => {
  it("round-trips", async () => {
    const t = await signToken(payload, SECRET);
    expect(await verifyToken(t, SECRET, NOW)).toEqual({ ok: true, payload });
  });

  it("is URL-safe and carries only opaque fields", async () => {
    const t = await signToken(payload, SECRET);
    expect(t).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const decoded = JSON.parse(dec(t.split(".")[0]!));
    expect(Object.keys(decoded)).toEqual(["donorId", "charityId", "exp"]);
    expect(JSON.stringify(decoded)).not.toContain("@");
  });

  it("rejects a tampered payload", async () => {
    const t = await signToken(payload, SECRET);
    const [, sig] = t.split(".") as [string, string];
    const forged = enc(JSON.stringify({ ...payload, donorId: "donor_t0002" }));
    expect(await verifyToken(`${forged}.${sig}`, SECRET, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects a tampered signature", async () => {
    const t = await signToken(payload, SECRET);
    const [body, sig] = t.split(".") as [string, string];
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(await verifyToken(`${body}.${flipped}`, SECRET, NOW)).toEqual({ ok: false, reason: "bad-signature" });
    expect(await verifyToken(`${body}.${sig.slice(0, -4)}`, SECRET, NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects expired tokens, but signature is checked first", async () => {
    const t = await signToken({ ...payload, exp: NOW }, SECRET);
    expect(await verifyToken(t, SECRET, NOW)).toEqual({ ok: false, reason: "expired" });
    expect(await verifyToken(t, SECRET, NOW - 1)).toMatchObject({ ok: true });
    const [body, sig] = t.split(".") as [string, string];
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(await verifyToken(`${body}.${flipped}`, SECRET, NOW + 1)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("rejects the wrong secret", async () => {
    const t = await signToken(payload, SECRET);
    expect(await verifyToken(t, "another-fake-secret-0123456789", NOW)).toEqual({ ok: false, reason: "bad-signature" });
  });

  it("returns malformed (never throws) on bad input", async () => {
    const sig = (await signToken(payload, SECRET)).split(".")[1]!;
    const cases = [
      "",
      "abc",
      "a.b.c",
      "!!!.???",
      `${enc("not json")}.${sig}`,
      `${enc(JSON.stringify({ ...payload, charityId: "demo-unknown" }))}.${sig}`,
      `${enc(JSON.stringify({ ...payload, email: "x@example.test" }))}.${sig}`,
      `${enc(JSON.stringify({ donorId: 5, charityId: "demo-pantry-a", exp: NOW }))}.${sig}`,
      `${enc(JSON.stringify({ donorId: "d", charityId: "demo-pantry-a" }))}.${sig}`,
      `${enc("[1,2,3]")}.${sig}`,
    ];
    for (const c of cases) {
      expect(await verifyToken(c, SECRET, NOW), c).toEqual({ ok: false, reason: "malformed" });
    }
    expect(await verifyToken(undefined as unknown as string, SECRET, NOW)).toEqual({ ok: false, reason: "malformed" });
  });

  it("refuses to sign with an empty or short secret", async () => {
    await expect(signToken(payload, "")).rejects.toThrow();
    await expect(signToken(payload, "short")).rejects.toThrow();
  });
});
