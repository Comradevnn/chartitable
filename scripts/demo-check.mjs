#!/usr/bin/env node
// Demo readiness check: runs demo:preflight against the DEV deployment and prints the report.
// Run:  npm run demo:check     (STAFF_PIN env, or being logged in to Convex)
// Exit: 0 green/amber, 1 red or call failed, 2 setup problem.

import { PIN, callAction, printReport, TIMEOUT } from "./demo-lib.mjs";

const r = await callAction("demo:preflight", { pin: PIN }, TIMEOUT.warm);
if (!r.ok || !r.value || !Array.isArray(r.value.checks)) {
  console.log(`RED    preflight did not run (${r.ok ? "unexpected response" : r.reason})`);
  process.exit(1);
}
printReport(r.value);
if (r.value.overall === "red") {
  console.log("Not ready: fix the RED checks above.");
  process.exit(1);
}
console.log(r.value.overall === "amber" ? "Ready with warnings." : "Ready.");
process.exit(0);
