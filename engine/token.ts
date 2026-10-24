// Signed opaque donor tokens (D6). Pure Web Crypto: runs in Convex's default runtime.
// Format: <base64url(JSON payload)>.<base64url(HMAC-SHA256 over first segment)>
import { CHARITY_IDS } from "./types";
import type { CharityId, TokenPayload, TokenVerifyResult } from "./types";

export const DEFAULT_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

const MIN_SECRET_LENGTH = 16;
const B64URL = /^[A-Za-z0-9_-]*$/;

function toB64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Returns null on any invalid input (never throws).
function fromB64Url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!B64URL.test(s) || s.length % 4 === 1) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  if (typeof secret !== "string" || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`token secret must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  // Fixed key order, only the three allowed fields.
  const json = JSON.stringify({
    donorId: payload.donorId,
    charityId: payload.charityId,
    exp: payload.exp,
  });
  const body = toB64Url(new TextEncoder().encode(json));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), new TextEncoder().encode(body));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

function parsePayload(bytes: Uint8Array): TokenPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 3 || !("donorId" in o) || !("charityId" in o) || !("exp" in o)) return null;
  const { donorId, charityId, exp } = o;
  if (typeof donorId !== "string" || donorId.length === 0) return null;
  if (typeof charityId !== "string" || !(CHARITY_IDS as readonly string[]).includes(charityId)) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  return { donorId, charityId: charityId as CharityId, exp };
}

export async function verifyToken(
  token: string,
  secret: string,
  now: number = Date.now(),
): Promise<TokenVerifyResult> {
  try {
    if (typeof token !== "string" || typeof secret !== "string" || secret.length === 0) {
      return { ok: false, reason: "malformed" };
    }
    const parts = token.split(".");
    if (parts.length !== 2) return { ok: false, reason: "malformed" };
    const [body, sigPart] = parts as [string, string];
    const bodyBytes = fromB64Url(body);
    const sigBytes = fromB64Url(sigPart);
    if (!bodyBytes || !sigBytes || bodyBytes.length === 0 || sigBytes.length === 0) {
      return { ok: false, reason: "malformed" };
    }
    const payload = parsePayload(bodyBytes);
    if (!payload) return { ok: false, reason: "malformed" };

    // Signature first (constant-time via subtle.verify), expiry second.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      sigBytes,
      new TextEncoder().encode(body),
    );
    if (!valid) return { ok: false, reason: "bad-signature" };
    if (payload.exp <= now) return { ok: false, reason: "expired" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "malformed" };
  }
}
