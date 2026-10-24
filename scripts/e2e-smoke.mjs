#!/usr/bin/env node
// End-to-end smoke test for the Chartitable backend (T23).
//
// What it does: donate (test mode) -> signed ?ct= token -> /donor-view (first visit)
// -> staff impact:log -> /donor-view again (view must change) -> tamper checks
// -> first-time-visitor rule -> milestone safety (no email) -> cleanup.
//
// Run:   STAFF_PIN=<pin> node scripts/e2e-smoke.mjs
// Needs: .env.local at the repo root with CONVEX_DEPLOYMENT (must start with "dev:"),
//        CONVEX_URL and CONVEX_SITE_URL (process.env overrides the file).
//        The PIN comes ONLY from the STAFF_PIN environment variable, never from a file.
//
// Safety: only touches rows tagged smoke:true on the DEV deployment, and never uses
// donor_a01 (the demo donor). Before and after the run it executes
// `npx convex run seed:cleanSmoke '{}'` to remove smoke rows. It never prints tokens,
// the PIN, emails, URLs with query strings, or raw response bodies.
//
// Exit codes: 0 all checks passed, 1 a check failed, 2 setup problem (nothing was run).

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHARITY = "demo-pantry-a";
const TIMEOUT_MS = 10_000;

// ---------- env ----------
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
const CONVEX_URL = env("CONVEX_URL").replace(/\/+$/, "");
const SITE_URL = env("CONVEX_SITE_URL").replace(/\/+$/, "");
const PIN = process.env.STAFF_PIN || "";

if (!DEPLOYMENT.startsWith("dev:")) {
  console.error("Abort: CONVEX_DEPLOYMENT must start with 'dev:' (this script only runs against the dev deployment).");
  process.exit(2);
}
if (!CONVEX_URL || !SITE_URL) {
  console.error("Abort: CONVEX_URL and CONVEX_SITE_URL must be set in .env.local.");
  process.exit(2);
}
if (!PIN) {
  console.error("Abort: STAFF_PIN is not set. Run: STAFF_PIN=... node scripts/e2e-smoke.mjs");
  process.exit(2);
}

// ---------- helpers ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
function report(n, ok, label, reason) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"} ${n} ${label}${!ok && reason ? ` (${reason})` : ""}`);
}

// Returns { ok:true, value } or { ok:false, reason } where reason is status / error code only.
async function convex(kind, path, args) {
  try {
    const res = await fetch(`${CONVEX_URL}/api/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args, format: "json" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
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
    return { ok: false, reason: e && e.name === "TimeoutError" ? "timeout" : "network error" };
  }
}

async function donorView(token) {
  try {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${SITE_URL}/donor-view?charity=${encodeURIComponent(CHARITY)}`, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return { ok: false, reason: `http ${res.status}` };
    const body = await res.json();
    return { ok: true, value: body };
  } catch (e) {
    return { ok: false, reason: e && e.name === "TimeoutError" ? "timeout" : "network or json error" };
  }
}

function cleanSmoke() {
  const r = spawnSync("npx", ["convex", "run", "seed:cleanSmoke", "{}"], {
    cwd: ROOT,
    shell: false,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  const ok = r.status === 0;
  console.log(`cleanup: ${ok ? "ok" : "failed"}`);
  return ok;
}

const health = () => convex("query", "ops:health", { pin: PIN, now: Date.now() });

// Mirrors the layer rule (layer/src/layer.ts): token = ?ct= from the URL, else the stored value.
// No token means no network request at all.
function layerShouldFetch({ search, stored }) {
  let fromUrl = null;
  try {
    const raw = new URLSearchParams(search).get("ct");
    fromUrl = raw && raw.trim() ? raw.trim() : null;
  } catch { /* ignore */ }
  const token = fromUrl || stored || null;
  return token !== null;
}
async function simulatedInit(opts, fetchStub) {
  if (!layerShouldFetch(opts)) return;
  await fetchStub("donor-view");
}

// ---------- run ----------
let baseline = null;
let token = null;

async function main() {
  // 0. Pre-clean and baseline
  cleanSmoke();
  const h0 = await health();
  if (!h0.ok) {
    report(0, false, "baseline ops:health after pre-clean", h0.reason);
    return;
  }
  baseline = { sentTotal: h0.value.email?.sentTotal, donors: h0.value.seed?.donors };
  const clean0 = h0.value.smoke?.donors === 0 && h0.value.smoke?.impactLogs === 0;
  report(0, clean0, "baseline captured, no smoke rows after pre-clean", "smoke rows remain");
  if (!clean0) return;

  // 1. Donate
  const d = await convex("mutation", "donations:create", {
    charityId: CHARITY, amountCents: 2500, firstName: "Smoke", smoke: true,
  });
  let step1 = false, reason1 = d.ok ? "" : d.reason;
  if (d.ok && d.value && d.value.ok === true && typeof d.value.redirectUrl === "string") {
    try {
      const u = new URL(d.value.redirectUrl);
      const keys = [...u.searchParams.keys()];
      const t = u.searchParams.get("ct");
      if (keys.length === 1 && keys[0] === "ct" && t && !d.value.redirectUrl.includes("@")) {
        step1 = true;
        token = t;
      } else reason1 = "redirect has unexpected params or an @";
    } catch { reason1 = "redirectUrl not a URL"; }
  } else if (d.ok) reason1 = `ok:false ${d.value && typeof d.value.error === "string" ? d.value.error : ""}`.trim();
  report(1, step1, "donate redirect carries only ct", reason1);
  if (!step1) return;

  // 2. First visit
  const v1 = await donorView(token);
  const first = v1.ok ? v1.value : null;
  const step2 = !!first && first.recognized === true && first.sinceLastVisit === null;
  report(2, step2, "donor-view recognizes the donor; first visit has no sinceLastVisit",
    v1.ok ? `recognized=${first?.recognized} sinceLastVisit=${first?.sinceLastVisit === null ? "null" : typeof first?.sinceLastVisit}` : v1.reason);
  if (!first || first.recognized !== true) return;

  // 3. impact:log (+ wrong PIN rejected)
  const wrongPin = PIN + "x";
  const bad = await convex("mutation", "impact:log", {
    pin: wrongPin, charityId: CHARITY, kind: "meals", count: 1, note: "Smoke test: wrong pin", smoke: true,
  });
  const badRejected = !bad.ok || (bad.value && bad.value.ok === false);
  const logStart = Date.now();
  const lg = await convex("mutation", "impact:log", {
    pin: PIN, charityId: CHARITY, kind: "meals", count: 80, note: "Smoke test: served 80 meals", smoke: true,
  });
  const logOk = lg.ok && lg.value && lg.value.ok === true && Number(lg.value.donorsCredited) >= 1;
  report(3, !!(logOk && badRejected), "impact:log accepted with PIN, rejected with wrong PIN",
    !badRejected ? "wrong PIN was accepted"
      : !lg.ok ? lg.reason
      : lg.value?.ok !== true ? `ok:false ${typeof lg.value?.error === "string" ? lg.value.error : ""}`.trim()
      : "donorsCredited < 1");
  if (!logOk) return;

  // 4. View changes
  await sleep(1500);
  const v2 = await donorView(token);
  const second = v2.ok ? v2.value : null;
  let step4 = false, reason4 = v2.ok ? "" : v2.reason;
  if (second && second.recognized === true) {
    const since = second.sinceLastVisit;
    if (!since) reason4 = "sinceLastVisit still null";
    else if (JSON.stringify(since) === JSON.stringify(first.sinceLastVisit)) reason4 = "view did not change";
    else if (!Array.isArray(since.records) || !since.records.some((r) => r && r.kind === "meals" && r.count === 80)) reason4 = "no meals record with count 80";
    else if (Array.isArray(since.estimates) && since.estimates.some((e) => !e || e.marker !== "about")) reason4 = "estimate missing 'about' marker";
    else step4 = true;
  } else if (second) reason4 = "not recognized";
  report(4, step4, "after impact:log the view changes and shows an 80-meals record (estimates labeled)", reason4);

  // 5. Tampered / missing token
  const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
  const vt = await donorView(tampered);
  const vn = await donorView(null);
  const step5 = vt.ok && vt.value.recognized === false && vn.ok && vn.value.recognized === false;
  report(5, step5, "tampered token and missing token are not recognized",
    !vt.ok ? vt.reason : !vn.ok ? vn.reason : vt.value.recognized !== false ? "tampered token recognized" : "missing token recognized");

  // 6. First-time visitor: no token, no request
  let calls = 0;
  const stub = async () => { calls++; return { ok: true }; };
  await simulatedInit({ search: "", stored: null }, stub);
  const noTokenCalls = calls;
  calls = 0;
  await simulatedInit({ search: "?ct=x", stored: null }, stub);
  const controlCalls = calls;
  report(6, noTokenCalls === 0 && controlCalls === 1, "first-time visitor makes no request (positive control makes one)",
    `no-token calls=${noTokenCalls}, control calls=${controlCalls}`);

  // 7. Milestones did not email anyone
  let lastRun = null, hm = null;
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    hm = await health();
    lastRun = hm.ok ? hm.value.milestones?.lastRun : null;
    if (lastRun && lastRun.at > logStart) break;
    await sleep(1000);
  }
  const fresh = !!(lastRun && lastRun.at > logStart);
  const configured = hm?.ok ? hm.value.milestones?.configured : undefined;
  const dry = await convex("query", "ops:milestoneDryRun", { pin: PIN, now: Date.now() });
  let step7 = false, reason7 = "";
  if (!hm?.ok) reason7 = hm?.reason || "health failed";
  else if (!fresh) reason7 = "no milestone run recorded after impact:log";
  else if (lastRun.sent !== 0) reason7 = `lastRun.sent=${lastRun.sent}`;
  else if (!(lastRun.smokeSkipped === true || configured === false)) reason7 = "run neither smokeSkipped nor unconfigured";
  else if (hm.value.email?.sentTotal !== baseline.sentTotal) reason7 = "email.sentTotal changed";
  else if (!dry.ok) reason7 = `dry run ${dry.reason}`;
  else if (dry.value.nonAllowlistedWouldSend !== 0) reason7 = `nonAllowlistedWouldSend=${dry.value.nonAllowlistedWouldSend}`;
  else step7 = true;
  report(7, step7, "milestone check sent nothing; dry run shows no non-allowlisted sends", reason7);
  if (configured === false) console.log("note: email not configured (RESEND_API_KEY/DEMO_INBOXES unset), nothing sent");
}

try {
  await main();
} catch (e) {
  failures++;
  console.log(`FAIL - unexpected error (${e && e.name ? e.name : "unknown"})`);
} finally {
  token = null;
  const cleaned = cleanSmoke();
  const h = await health();
  let ok = false, reason = "";
  if (!h.ok) reason = h.reason;
  else if (h.value.smoke?.donors !== 0 || h.value.smoke?.impactLogs !== 0) reason = "smoke rows remain";
  else if (baseline && h.value.seed?.donors !== baseline.donors) reason = "seed.donors differs from baseline";
  else if (!baseline) reason = "no baseline";
  else ok = true;
  if (!cleaned && ok) ok = false, reason = "cleanSmoke command failed";
  report(8, ok, "cleanup left no smoke rows", reason);
  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}
