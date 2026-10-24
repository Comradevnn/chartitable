#!/usr/bin/env node
// Resets the DEV demo to its canonical start state (demo:reset), then runs preflight.
// Run:  npm run demo:reset     (STAFF_PIN env, or being logged in to Convex)
// Exit: 0 ok, 1 reset failed or preflight red, 2 setup problem.

import { PIN, callAction, printReport, TIMEOUT } from "./demo-lib.mjs";

const sumValues = (o) =>
  o && typeof o === "object" ? Object.values(o).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0) : 0;

let failed = false;

const r = await callAction("demo:reset", { pin: PIN }, TIMEOUT.reset);
if (!r.ok || !r.value || r.value.ok !== true) {
  console.log(`Reset FAILED (${r.ok ? "ok:false" : r.reason})`);
  failed = true;
} else {
  const v = r.value;
  const w = v.warm || {};
  console.log(`Reset done: ${sumValues(v.removed)} rows removed, ${v.expensesRemoved ?? 0} expenses removed`);
  console.log(`Demo inbox set: ${v.emailSet ? "yes" : "no"}`);
  console.log(`Stories warmed: ${w.claude ?? 0} of ${w.total ?? 0} Claude (${w.template ?? 0} template, ${w.failed ?? 0} failed)`);
  if (w.total !== w.claude) console.log("Note: not every story came from Claude.");
}

console.log("");
const p = await callAction("demo:preflight", { pin: PIN }, TIMEOUT.warm);
if (!p.ok || !p.value || !Array.isArray(p.value.checks)) {
  console.log(`RED    preflight did not run (${p.ok ? "unexpected response" : p.reason})`);
  failed = true;
} else {
  printReport(p.value);
  if (p.value.overall === "red") failed = true;
}
process.exit(failed ? 1 : 0);
