import { describe, expect, it, vi } from "vitest";
import { sendViaResend } from "./email";
import type { OutgoingEmail } from "./email";

const email: OutgoingEmail = { to: "Team@Example.com", subject: "S", text: "T", html: "<p>T</p>" };
const allowlist = new Set(["team@example.com"]);
const base = { apiKey: "re_test_key", from: "Chartitable Demo <onboarding@resend.dev>", email, allowlist };

const res = (status: number, body: unknown = { id: "msg_1" }) => new Response(JSON.stringify(body), { status });
const asFetch = (f: unknown) => f as typeof fetch;

describe("sendViaResend", () => {
  it("never calls fetch for a non-allowlisted recipient", async () => {
    const f = vi.fn();
    const r = await sendViaResend({ ...base, fetchFn: asFetch(f), email: { ...email, to: "x@evil.com" } });
    expect(r).toEqual({ ok: false, reason: "not_allowlisted" });
    expect(f).not.toHaveBeenCalled();
  });

  it("empty allowlist sends nothing", async () => {
    const f = vi.fn();
    const r = await sendViaResend({ ...base, fetchFn: asFetch(f), allowlist: new Set() });
    expect(r).toEqual({ ok: false, reason: "not_allowlisted" });
    expect(f).not.toHaveBeenCalled();
  });

  it("no key -> no_key without fetching", async () => {
    const f = vi.fn();
    expect(await sendViaResend({ ...base, fetchFn: asFetch(f), apiKey: null })).toEqual({ ok: false, reason: "no_key" });
    expect(f).not.toHaveBeenCalled();
  });

  it("posts the expected request", async () => {
    const f = vi.fn().mockResolvedValue(res(200));
    const r = await sendViaResend({ ...base, fetchFn: asFetch(f) });
    expect(r).toEqual({ ok: true, id: "msg_1" });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(init.body as string)).toEqual({
      from: base.from,
      to: ["Team@Example.com"],
      subject: "S",
      text: "T",
      html: "<p>T</p>",
    });
  });

  it("ok with null id when the body is not JSON", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 202 }));
    expect(await sendViaResend({ ...base, fetchFn: asFetch(f) })).toEqual({ ok: true, id: null });
  });

  it("500 then 200 -> ok after exactly 2 calls", async () => {
    const f = vi.fn().mockResolvedValueOnce(res(500, {})).mockResolvedValueOnce(res(200));
    expect(await sendViaResend({ ...base, fetchFn: asFetch(f) })).toEqual({ ok: true, id: "msg_1" });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("500 twice -> failed after exactly 2 calls", async () => {
    const f = vi.fn().mockImplementation(async () => res(500, {}));
    expect(await sendViaResend({ ...base, fetchFn: asFetch(f) })).toEqual({ ok: false, reason: "failed" });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("fetch throwing twice -> failed, never throws", async () => {
    const f = vi.fn().mockRejectedValue(new Error("network"));
    expect(await sendViaResend({ ...base, fetchFn: asFetch(f) })).toEqual({ ok: false, reason: "failed" });
    expect(f).toHaveBeenCalledTimes(2);
  });
});
