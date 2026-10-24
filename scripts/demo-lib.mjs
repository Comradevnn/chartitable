// Shared helpers for the demo scripts (demo-check, demo-reset, demo-rehearsal).
//
// Importing this module performs the setup guards and may exit(2):
//   - .env.local at the repo root (process.env overrides the file)
//   - CONVEX_DEPLOYMENT must start with "dev:"
//   - CONVEX_URL and CONVEX_SITE_URL are required
//   - the staff PIN comes from STAFF_PIN, else is captured silently from `npx convex env get STAFF_PIN`
//
// Never printed: the PIN, tokens, URLs with query strings, emails, raw response bodies.
// Error output is a status code or errorData string only.

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(path) {
  const out = {};
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { return out; }
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 1) continue;
    const key = t.slice(0, i).trim().replace(/^export\s+/, "");
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    else val = val.replace(/\s+#.*$/, "");
    out[key] = val;
  }
  return out;
}

const fileEnv = loadEnvFile(join(ROOT, ".env.local"));
const env = (k) => process.env[k] || fileEnv[k] || "";

const DEPLOYMENT = env("CONVEX_DEPLOYMENT");
export const CONVEX_URL = env("CONVEX_URL").replace(/\/+$/, "");
export const SITE_URL = env("CONVEX_SITE_URL").replace(/\/+$/, "");

if (!DEPLOYMENT.startsWith("dev:")) {
  console.error("Abort: CONVEX_DEPLOYMENT must start with 'dev:' (these scripts only run against the dev deployment).");
  process.exit(2);
}
if (!CONVEX_URL || !SITE_URL) {
  console.error("Abort: CONVEX_URL and CONVEX_SITE_URL must be set in .env.local.");
  process.exit(2);
}

function resolvePin() {
  if (process.env.STAFF_PIN) return process.env.STAFF_PIN;
  // Captured in memory only: stdout piped and trimmed, stderr discarded, never echoed.
  const r = spawnSync("npx", ["convex", "env", "get", "STAFF_PIN"], {
    cwd: ROOT,
    shell: false,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 60_000,
  });
  const out = r.status === 0 && typeof r.stdout === "string" ? r.stdout.trim() : "";
  return out;
}

export const PIN = resolvePin();
if (!PIN) {
  console.error("Abort: Set STAFF_PIN or log in to Convex (npx convex env get STAFF_PIN returned nothing).");
  process.exit(2);
}

// ---------- timeouts ----------
export const TIMEOUT = { default: 15_000, warm: 60_000, reset: 120_000 };

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function errReason(e) {
  return e && e.name === "TimeoutError" ? "timeout" : "network error";
}

// ---------- Convex HTTP API ----------
// Returns { ok:true, value } or { ok:false, reason }. reason is a status code / errorData string only.
async function convex(kind, path, args, timeoutMs = TIMEOUT.default) {
  try {
    const res = await fetch(`${CONVEX_URL}/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    let body = null;
    try { body = await res.json(); } catch { /* non-JSON */ }
    if (body && body.status === "success") return { ok: true, value: body.value };
    let code = "";
    const d = body && body.errorData;
    if (typeof d === "string") code = d;
    else if (d && typeof d.code === "string") code = d.code;
    return { ok: false, reason: `http ${res.status}${code ? ` ${code}` : ""}` };
  } catch (e) {
    return { ok: false, reason: errReason(e) };
  }
}

export const callAction = (path, args, timeoutMs) => convex("action", path, args, timeoutMs);
export const callQuery = (path, args, timeoutMs) => convex("query", path, args, timeoutMs);

// ---------- HTTP routes on the Convex site ----------
// GET ${SITE_URL}/<route>?charity=<id>[&peek=1] with an optional bearer token.
// Returns { ok:true, value } or { ok:false, reason }.
export async function siteGet(route, charityId, token, { peek = false, timeoutMs = TIMEOUT.default } = {}) {
  try {
    const q = `charity=${encodeURIComponent(charityId)}${peek ? "&peek=1" : ""}`;
    const res = await fetch(`${SITE_URL}/${route}?${q}`, {
      method: "GET",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, reason: `http ${res.status}` };
    return { ok: true, value: await res.json() };
  } catch (e) {
    return { ok: false, reason: e && e.name === "TimeoutError" ? "timeout" : "network or json error" };
  }
}

// GET an arbitrary page (query stripped by the caller's choice). Reports status + whether it looks like HTML.
export async function pageGet(urlNoQuery, timeoutMs = TIMEOUT.default) {
  try {
    const res = await fetch(urlNoQuery, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const ctype = res.headers.get("content-type") || "";
    return { ok: res.status === 200, status: res.status, html: /html/i.test(ctype) };
  } catch (e) {
    return { ok: false, status: 0, html: false, reason: errReason(e) };
  }
}

// ---------- link helpers (in-memory only) ----------
// Returns the ct token from a donor link, "" for a stranger link (empty ct), null if unparsable.
export function tokenFromUrl(url) {
  try {
    const t = new URL(url).searchParams.get("ct");
    return t === null ? null : t;
  } catch {
    return null;
  }
}

// Strip the query string and hash (so nothing sensitive is requested or printed).
export function stripQuery(url) {
  return String(url).split("#")[0].split("?")[0];
}

// ---------- report ----------
const useColor = Boolean(process.stdout.isTTY);
const COLORS = { GREEN: "\x1b[32m", AMBER: "\x1b[33m", RED: "\x1b[31m", DIM: "\x1b[2m" };
const RESET = "\x1b[0m";
export function paint(word, color) {
  return useColor ? `${COLORS[color] || ""}${word}${RESET}` : word;
}

// report: { overall: "green"|"amber"|"red", checks: [{id,label,status,detail}] }
export function printReport(report) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  const width = Math.max(10, ...checks.map((c) => String(c.label ?? c.id ?? "").length));
  for (const c of checks) {
    const word = String(c.status || "red").toUpperCase();
    const tag = paint(word.padEnd(5), word);
    console.log(`${tag}  ${String(c.label ?? c.id ?? "").padEnd(width)}  ${c.detail ?? ""}`);
  }
  const overall = String(report?.overall || "red").toUpperCase();
  console.log(`Overall: ${paint(overall, overall)}`);
}
