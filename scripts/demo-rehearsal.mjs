#!/usr/bin/env node
// Walks the 3-minute demo run sheet against the live DEV deployment, then ALWAYS resets.
//
// Run:   npm run demo:rehearsal [-- --send-email]
//        (STAFF_PIN env, or being logged in to Convex)
// Flags: --send-email  actually send the hero email (a-first-impact). Default holds the
//                      milestone email (holdEmail:true) and checks the dry run instead.
// Exit:  0 all steps passed (WARN/SKIP do not fail), 1 any FAIL, 2 setup problem.
//
// Never prints the PIN, tokens, URLs with query strings, emails, or raw bodies.
// Safe to run twice in a row: step 9 (in a finally) resets to the canonical start state.

import {
  PIN, callAction, callQuery, siteGet, pageGet, tokenFromUrl, stripQuery,
  sleep, TIMEOUT, paint,
} from "./demo-lib.mjs";

const SEND_EMAIL = process.argv.includes("--send-email");
const HERO = "a-first-impact";
const STATES = ["stranger", "first_impact", "just_gave", "news", "repeat", "lapsed"];
const T0 = Date.now();

let passed = 0;
let failed = 0;

function line(word, color, n, label, detail) {
  console.log(`${paint(word.padEnd(4), color)} ${n} ${label}${detail ? ` (${detail})` : ""}`);
}
const pass = (n, label, detail) => { passed++; line("PASS", "GREEN", n, label, detail); };
const fail = (n, label, detail) => { failed++; line("FAIL", "RED", n, label, detail); };
const warn = (n, label, detail) => line("WARN", "AMBER", n, label, detail);
const skip = (n, label, detail) => line("SKIP", "DIM", n, label, detail);

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;
const reasonOf = (r) => (r && r.reason) || "unexpected response";

async function link(personaId) {
  const r = await callAction("demo:link", { pin: PIN, personaId });
  if (!r.ok) return { ok: false, reason: r.reason };
  if (!r.value || r.value.ok !== true || typeof r.value.url !== "string") {
    return { ok: false, reason: `ok:false ${typeof r.value?.error === "string" ? r.value.error : ""}`.trim() };
  }
  return { ok: true, url: r.value.url };
}

const mealsEstimate = (estimates) =>
  (Array.isArray(estimates) ? estimates : []).find((e) => e && (e.kind === "meals" || /meal/i.test(String(e.unit || ""))));

async function main() {
  let personas = [];

  // 1. Reset
  {
    const r = await callAction("demo:reset", { pin: PIN }, TIMEOUT.reset);
    if (!r.ok || !r.value || r.value.ok !== true) {
      fail(1, "demo:reset", r.ok ? "ok:false" : r.reason);
    } else {
      const w = r.value.warm || {};
      const counts = `${w.claude ?? "?"} of ${w.total ?? "?"} Claude, ${w.template ?? 0} template, ${w.failed ?? 0} failed`;
      if (w.total === w.claude && typeof w.total === "number") pass(1, "reset ok, every story warmed by Claude", counts);
      else fail(1, "reset ok but not every story came from Claude", counts);
    }
  }

  // 2. Personas
  {
    const r = await callQuery("demo:personas", {});
    if (!r.ok || !Array.isArray(r.value)) {
      fail(2, "demo:personas", r.ok ? "not an array" : r.reason);
    } else {
      personas = r.value;
      const problems = [];
      if (personas.length !== 12) problems.push(`got ${personas.length} personas`);
      for (const cid of ["demo-pantry-a", "demo-pantry-b"]) {
        const have = new Set(personas.filter((p) => p.charityId === cid).map((p) => p.state));
        const missing = STATES.filter((s) => !have.has(s));
        if (missing.length) problems.push(`${cid} missing ${missing.join(",")}`);
      }
      if (problems.length) fail(2, "12 personas, six states per charity", problems.join("; "));
      else pass(2, "12 personas, six states per charity");
    }
  }
  if (personas.length === 0) return;

  // 3. Stranger links
  {
    const problems = [];
    for (const p of personas.filter((x) => x.state === "stranger")) {
      const l = await link(p.id);
      if (!l.ok) { problems.push(`${p.id}: link ${l.reason}`); continue; }
      if (tokenFromUrl(l.url) !== "" || !/ct=$/.test(l.url)) { problems.push(`${p.id}: url does not end with empty ct=`); continue; }
      const pg = await pageGet(stripQuery(l.url));
      if (!pg.ok) problems.push(`${p.id}: page http ${pg.status || pg.reason}`);
      else if (!pg.html) problems.push(`${p.id}: page is not html`);
    }
    if (problems.length) fail(3, "stranger links carry empty ct and the host page loads", problems.join("; "));
    else pass(3, "stranger links carry empty ct and the host page loads (200 HTML)");
  }

  // 4. Every donor persona
  {
    const donors = personas.filter((p) => p.state !== "stranger");
    const problems = [];
    for (const p of donors) {
      const l = await link(p.id);
      const token = l.ok ? tokenFromUrl(l.url) : null;
      if (!l.ok || !token) { problems.push(`${p.id}: link ${l.ok ? "has no token" : l.reason}`); continue; }
      const v = await siteGet("donor-view", p.charityId, token);
      if (!v.ok) { problems.push(`${p.id}: view ${v.reason}`); continue; }
      const d = v.value;
      if (d.recognized !== true) { problems.push(`${p.id}: not recognized`); continue; }
      const gotState = d.donor && d.donor.state;
      const gotSource = d.hero && d.hero.source;
      if (gotState !== p.state || gotSource !== "claude") {
        problems.push(`${p.id}: state=${gotState} source=${gotSource}`);
      }
    }
    // Re-link every donor persona so the next steps start staged.
    for (const p of donors) await link(p.id);
    if (problems.length) fail(4, `${donors.length} donor personas show their state with a Claude story`, problems.join("; "));
    else pass(4, `${donors.length} donor personas show their state with a Claude story`);
  }

  // 5. Hero path
  const hero = personas.find((p) => p.id === HERO);
  let heroToken = null;
  let heroCharity = "demo-pantry-a";
  let postedOk = false;
  if (!hero) {
    fail(5, "hero path", `persona ${HERO} not found`);
  } else {
    heroCharity = hero.charityId;
    const problems = [];
    let baseRev = null;
    let baseMeals = null;
    const l = await link(HERO);
    heroToken = l.ok ? tokenFromUrl(l.url) : null;
    if (!heroToken) {
      problems.push(`link ${l.ok ? "has no token" : l.reason}`);
    } else {
      const v = await siteGet("donor-view", heroCharity, heroToken); // the "page load"
      if (!v.ok) problems.push(`view ${v.reason}`);
      else if (v.value.recognized !== true) problems.push("not recognized");
      else {
        const d = v.value;
        baseRev = d.rev ?? null;
        if (!d.donor || d.donor.state !== "first_impact") problems.push(`state=${d.donor && d.donor.state}`);
        const m = mealsEstimate(d.estimates);
        baseMeals = m ? m.approxQuantity : null;
        console.log(`     hero before: meals estimate about ${baseMeals ?? "n/a"}, rev ${baseRev ?? "n/a"}`);
        const pulse = await siteGet("donor-pulse", heroCharity, heroToken);
        if (!pulse.ok) problems.push(`pulse ${pulse.reason}`);
        else if (pulse.value.recognized !== true || pulse.value.rev !== baseRev) problems.push("pulse rev differs from view rev");
      }
    }
    if (problems.length === 0) {
      const post = await callAction("demo:post", {
        pin: PIN, charityId: heroCharity, preset: "meals80", holdEmail: !SEND_EMAIL,
      });
      if (!post.ok) problems.push(`post ${post.reason}`);
      else if (post.value?.ok !== true) problems.push(`post ok:false ${typeof post.value?.error === "string" ? post.value.error : ""}`.trim());
      else postedOk = true;
    }
    let pulseSecs = null;
    if (postedOk) {
      const t = Date.now();
      while (Date.now() - t < 30_000) {
        await sleep(2000);
        const pulse = await siteGet("donor-pulse", heroCharity, heroToken);
        if (pulse.ok && pulse.value.recognized === true && pulse.value.rev !== baseRev) { pulseSecs = Date.now() - t; break; }
      }
      if (pulseSecs === null) problems.push("donor-pulse rev did not change within 30s");
      else {
        const v = await siteGet("donor-view", heroCharity, heroToken, { peek: true });
        if (!v.ok) problems.push(`peek ${v.reason}`);
        else if (v.value.recognized !== true) problems.push("peek not recognized");
        else {
          const d = v.value;
          const m = mealsEstimate(d.estimates);
          const after = m ? m.approxQuantity : null;
          if (!d.donor || d.donor.state !== "news") problems.push(`state after post=${d.donor && d.donor.state}`);
          const recs = Array.isArray(d.records) ? d.records : [];
          if (!recs.some((r) => r && r.count === 80 && /meal/i.test(String(r.unit || r.kind || "")))) problems.push("no 80-meals record");
          if (!(typeof after === "number" && after >= 25)) problems.push(`meals estimate ${after ?? "missing"} (< 25)`);
          console.log(`     estimate about ${baseMeals ?? "n/a"} -> about ${after ?? "n/a"} meals`);
        }
      }
    }
    if (problems.length) fail(5, "hero path: first impact, post 80 meals, live update to news", problems.join("; "));
    else pass(5, "hero path: first impact, post 80 meals, live update to news", `pulse changed after ${secs(pulseSecs)}`);
  }

  // 6. Narrative regenerates after the post
  if (!heroToken || !postedOk) {
    fail(6, "narrative regenerated by Claude after the post", "hero post did not happen");
  } else {
    const t = Date.now();
    let source = null;
    while (Date.now() - t < 25_000) {
      const v = await siteGet("donor-view", heroCharity, heroToken, { peek: true });
      if (v.ok && v.value.recognized === true) {
        source = v.value.hero && v.value.hero.source;
        if (source === "claude") break;
      }
      await sleep(2000);
    }
    if (source === "claude") pass(6, "narrative regenerated by Claude after the post", `${secs(Date.now() - t)}`);
    else warn(6, "narrative not yet from Claude after 25s", `source=${source ?? "n/a"}`);
  }

  // 7. Email
  if (SEND_EMAIL) {
    const r = await callAction("demo:sendEmail", { pin: PIN, personaId: HERO });
    const status = r.ok ? r.value?.status : null;
    if (r.ok && (status === "sent" || status === "already_sent")) pass(7, "hero email", `status=${status}`);
    else fail(7, "hero email", r.ok ? `status=${status ?? "n/a"}` : r.reason);
  } else {
    const r = await callQuery("ops:milestoneDryRun", { pin: PIN, now: Date.now() });
    if (!r.ok) fail(7, "milestone dry run", r.reason);
    else if (!r.value.configured) skip(7, "milestone dry run", "email not configured");
    else if (r.value.wouldSend >= 1 && r.value.nonAllowlistedWouldSend === 0) {
      pass(7, "milestone dry run would send, only to the allowlist", `wouldSend=${r.value.wouldSend}`);
    } else {
      fail(7, "milestone dry run", `wouldSend=${r.value.wouldSend} nonAllowlistedWouldSend=${r.value.nonAllowlistedWouldSend}`);
    }
  }

  // 8. Second charity
  {
    const r = await callAction("demo:post", { pin: PIN, charityId: "demo-pantry-b", preset: "produce120", holdEmail: true });
    if (!r.ok) fail(8, "post produce120 on demo-pantry-b", r.reason);
    else if (r.value?.ok !== true) fail(8, "post produce120 on demo-pantry-b", `ok:false ${typeof r.value?.error === "string" ? r.value.error : ""}`.trim());
    else pass(8, "post produce120 on demo-pantry-b", `donorsCredited=${r.value.donorsCredited}`);
  }
}

try {
  await main();
} catch (e) {
  fail("!", "unexpected error", e && e.name ? e.name : "unknown");
} finally {
  // 9. Always leave the demo in canonical start state.
  try {
    const r = await callAction("demo:reset", { pin: PIN }, TIMEOUT.reset);
    if (!r.ok || r.value?.ok !== true) {
      fail(9, "final reset", r.ok ? "ok:false" : r.reason);
    } else {
      const p = await callAction("demo:preflight", { pin: PIN }, TIMEOUT.warm);
      if (!p.ok || !p.value || !Array.isArray(p.value.checks)) {
        fail(9, "final reset, then preflight", p.ok ? "unexpected response" : p.reason);
      } else {
        const canon = p.value.checks.find((c) => c.id === "canonical");
        if (p.value.overall !== "red" && canon && canon.status === "green") {
          pass(9, "final reset leaves the canonical start state", `preflight ${p.value.overall}`);
        } else {
          fail(9, "final reset leaves the canonical start state", `preflight ${p.value.overall}, canonical ${canon ? canon.status : "missing"}`);
        }
      }
    }
  } catch (e) {
    fail(9, "final reset", e && e.name ? e.name : "unknown");
  }
  console.log(`Elapsed ${secs(Date.now() - T0)}. ${passed} passed, ${failed} failed.`);
  process.exitCode = failed === 0 ? 0 : 1;
}
