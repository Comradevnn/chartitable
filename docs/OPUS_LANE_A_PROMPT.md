# One-shot Opus 5.5 prompt: Lane A build (T6b, T7b, T3, T19, T9, calibration, Cursor handoffs)

Use: fresh Claude Code session at the repo root, Opus 5.5, high effort. Paste everything under the line as the first message. It is designed to run end to end without further input. Cursor is working in the same folder at the same time (T20), so the prompt includes collision rules.

---

You are the **orchestrator (Opus 5.5)** for Lane A of Chartitable at Cal Hacks 13.0. Devpost deadline: Sun Oct 25, 9:00 AM PT (hard). Work autonomously until every deliverable below is done or genuinely blocked, then give one final report. Do not ask me questions mid-run; make the safe default, record it, and continue.

## 0. Orient (do this first, briefly)
1. Read `CLAUDE.md` (rules, roles, read map), then the Lane A parts of `PROGRESS.md` (Snapshot, Blockers, integration contract v1, Decisions D1–D13, task rows for T3, T6b, T7b, T9, T19, last ~20 log lines tagged `[A]` or `[ALL]`), then `docs/handoff/revnn.md`, `docs/PRODUCT_SPEC.md` (v0.2: §3–§8, §12–§19), `engine/types.ts`, `convex/schema.ts`, `convex/CONVEX_NOTES.md`. Do not read `docs/DASHBOARD_SPEC.md` except its "Data contract" section (needed for T19). Skip Lane B files.
2. Run `git status`, `git log --oneline | head`, `npm test`, `npm run typecheck` to learn the true baseline. Tests were 156/156 green at last check.
3. Check whether Convex is linked: does `convex/_generated/` exist and does `.env` / `.env.local` contain `CONVEX_URL`? **Never print key values.** If Convex is not linked, do not run `npx convex dev` (interactive login is the lead's step); build everything so it works without a deployment (pure logic in `/engine`, thin Convex wrappers, tests with mocks) and mark live steps blocked.

## 1. Collision rules (Cursor is editing this checkout right now)
- Do **not** touch: `/demo-sites/test-hosts/**`, `PRODUCT.md`, `DESIGN.md`, `.cursor/**`, `docs/cursor-shots/**`, `docs/cursor-grok-log.md`, `/frontend`, `/dashboard`, or the Lane B docs.
- Never run `git add -A`, `git add .`, `git commit -a`, `git stash`, `git reset`, or `git checkout -- <file>`. Stage **only the exact paths you created or edited**. Commit with explicit paths. Use `git pull --rebase --autostash` before pushing; never force-push. If a rebase conflicts in files you don't own, abort and note it.
- `convex/schema.ts` and `engine/types.ts` are **orchestrator-only** files: you edit them (below) before any subagent starts and subagents never touch them.

## 2. Orchestration rules (from CLAUDE.md, restated)
- You plan, delegate, review, integrate, commit, and keep `PROGRESS.md` true. You write code yourself only for the schema/types edits and small glue.
- **Sonnet subagents** (`model: "sonnet"`) write code, one scoped task per prompt, using `PROMPTS.md` Part B. Every prompt names: goal, files it may edit, files it must not edit, the interface (paste the exact types and the relevant spec excerpt; do not tell it to read whole docs), acceptance check, "append one `[A]` Handoff log line; do not commit".
- **Haiku subagents** (`model: "haiku"`) are read-only: docs lookups, diff-vs-contract checks, acceptance verification, secret/PII scan, honesty audit (`PROMPTS.md` Part B2/H-prompts).
- Parallelize only subagents with disjoint file sets. After each returns run the gate: read the diff, run `npm test && npm run typecheck && npm run build` yourself, Haiku check (contract, secrets, real names, PII in URLs), commit with explicit paths and the attribution line from the system reminder, update `PROGRESS.md` and your handoff doc.
- Non-negotiables: honesty rule and fact-check guard (D1/D8), fictional data only, no secrets or PII in URLs/logs, first-time visitors untouched, test-mode payments, email only to `DEMO_INBOXES`, repo stays private. Never loosen the guard to make a test pass.

## 3. Step A: schema and types (you, before any subagent)
Edit `convex/schema.ts` and, if needed, `engine/types.ts` once, then commit:
- Dashboard (T19): `expenses` table (`charityId`, `date`, `amountCents`, `category` in food/transport/facility/supplies/staff/other, `note?`, `receiptStorageId?`, `createdAt`, index by charity+date); `donors.hideFromTopDonors?: boolean`, `donors.thankedAt?: number`.
- Narrative/ops (T6b/T9): fields to track narrative `source` and `guardReasons` on `narratives` (keep existing index), a small `callLog` or counters table for the Claude call cap (`NARRATIVE_MAX_PER_HOUR`, `NARRATIVE_MIN_INTERVAL_MS`), and what `milestoneEmails` needs (threshold id per kind, `status`, `sentAt`).
- Add `DonorView` fields only if the spec requires; keep contract v1 unchanged. Run `npm run typecheck` and the seed tests; fix the seed builder if the schema change requires defaults.

## 4. Step B: wave 1, parallel Sonnet subagents (disjoint files)
1. **T6b narrative.** Files: `engine/narrative-run.ts` (+ test), `convex/narrative.ts`. Pure `runNarrative({ facts, callModel, now, caps, cache })` that builds the prompt, calls an injected `callModel` (Anthropic Messages API, `claude-sonnet-5-5`, structured JSON per `NARRATIVE_JSON_SCHEMA`, 15 s timeout), runs the guard, falls back to `templateFallback`, honors the cache by `factsHash` and the call caps; returns `NarrativeResult`. `convex/narrative.ts` is a thin action around it reading `ANTHROPIC_API_KEY` from env. Tests with a mocked model: success path, guard rejection → template with reasons, timeout, API error, missing key, cache hit, cap exceeded. Never log narrative text or keys.
2. **T7b donor-view.** Files: `engine/donor-view.ts` (+ test), `convex/http.ts`, `convex/tokens.ts`, `convex/visits.ts`. Pure `buildDonorView(...)` producing `DonorView` (separate `records` and `estimates`, `sinceLastVisit` from the previous visit, photos). `GET /donor-view?charity=<id>` with Bearer token per spec §6, CORS open, never returns email or other donors' data, any failure → `{recognized:false}` with no detail, per-token rate limit (30/min). Tests: tampered/expired/malformed tokens, first visit vs second visit changes `sinceLastVisit`, no email in output.
3. **T3 donate.** Files: `convex/donations.ts`, `staff/donate.html` + `staff/donate.js` + `staff/donate.css`. Spec §14: presets $10/$25/$50/custom 1–500, optional first name/email, "Don't list me publicly" checkbox, persistent "TEST MODE: no real payment" banner, no card fields, redirect to `charity.siteUrl?ct=<token>` with only `ct`. Pure validation in `engine/donate.ts` with tests (bounds, charity id validation, email stays out of URLs). Do not touch `staff/update*` (Cursor/T4).
4. **T19 dashboard backend.** Files: `engine/dashboard.ts` (+ test), `convex/dashboard.ts`. Pure functions for donor status (new <= period start; active <=45 d; at_risk 46–90 d; lapsed 90+ d), cost per meal (`expenses ÷ meals` in the period; `null` when meals = 0; always `isEstimate: true` with the formula string), totals/prev-period, top donors honoring `hideFromTopDonors`. Queries `dashboard:overview`, `dashboard:donors`, `dashboard:expenses`, mutation `dashboard:addExpense`, matching the shapes in `docs/DASHBOARD_SPEC.md` "Data contract" (paste that block into the prompt). Seed: add a handful of fictional expenses to `seed/data.ts` (coordinate: assign `seed/**` to this subagent only).

## 5. Step C: wave 2 (after wave 1 is merged and green)
5. **T9 milestones.** Files: `engine/milestones.ts` (+ test), `convex/milestones.ts`, `convex/email.ts`. Thresholds per spec §7 (meals 25/50/100/250; produce 100/250/500 lb; volunteer shifts 3/6/12), each fires once per donor+kind, at most one email per donor per 7 days, sends only to `DEMO_INBOXES` (others logged and skipped), body is guard-passing text only with estimates labeled, Resend via `RESEND_API_KEY`, retry once on failure and never block. Scheduled every 5 minutes. Tests: below threshold sends nothing; allowlist; once-only; double run sends once.
6. **Calibration test (spec §16).** You write this one (small): Vitest that builds `buildSeed(2026-10-24T08:00Z)`, runs `allocate` for `demo-pantry-a` over the last 30 days, and asserts `donor_a01` has about 23 meals before and about 26.8 after a new 80-meal log (tolerance ±0.5), crossing the 25-meal threshold only after the log. If the numbers drift from the spec, fix the **threshold or window defaults in the spec and code**, not the assertion's meaning, and log it.

## 6. Step D: live smoke (only if keys exist; never print them)
- If `ANTHROPIC_API_KEY` is available locally (`.env` loaded via `node --env-file`), run **one** live narrative call for the seeded demo donor through the real pipeline (script in the scratchpad, not committed). Report only: `source` (`claude` or `template`), guard result and reasons, latency, and the story text with all donor names replaced. If Claude's output fails the guard, **tune the prompt, never the guard**, rerun at most twice.
- If Convex is linked and `CONVEX_URL` is set, deploy is still the lead's step: list exactly the commands the lead must run (`npx convex dev`, `npx convex env set ...`, `npx convex run seed:load`) in the final report. Do not run interactive commands.

## 7. Step E: Cursor handoff prompts (write, do not execute)
Write `docs/CURSOR_LAYER_STAFF_PROMPT.md`: one prompt for Cursor (Grok 4.7 / Composer 2.5, staged with self-checks like `docs/CURSOR_TEST_SITES_PROMPT.md`) for **T8 `layer.js`** (spec §13, writes `/layer/src/**` only; test against `/demo-sites/test-hosts` and the `DonorView` sample) and **T4 staff update page** (spec §14, writes `/staff/update*`, calls `impact:log`). Also implement `convex/impact.ts` (`impact:log`, upload URL, `allocations:recompute` hook) yourself or via one Sonnet, since Cursor's staff page depends on it. Commit and note both prompts in `PROGRESS.md`.

## 8. Step F: audits and close-out
- Haiku **honesty audit** (PROMPTS.md H5) over `engine/guard.ts`, `prompt.ts`, `narrative-run.ts`, `donor-view.ts`, `milestones.ts`, `email.ts`: any path where model text reaches a donor without the guard, any estimate without a label, any record/estimate mixing.
- Haiku **secret/PII scan** (H3) over working tree and history.
- Run the full gate one last time. Update `PROGRESS.md`: task rows (T3, T6b, T7b, T9, T19 → `review` or `done` with what is blocked on Convex login/keys), a new `[A]` Handoff log line per merged piece, Blockers (precise remaining human steps), `Last updated`. Rewrite `docs/handoff/revnn.md` so a fresh session can resume: done / in progress / next / commands / gotchas. Update `docs/PRODUCT_SPEC.md` labels (PROPOSED → BUILT) for what shipped, and record any default you chose for the §19 open decisions.
- `git pull --rebase --autostash`, push `main` (explicit paths only were staged). Never make the repo public (T17 is the lead's call).

## Stop conditions and priorities
If time or budget runs short, protect in this order: (1) T6b + T7b (the demo path), (2) T3, (3) calibration test, (4) T9, (5) T19, (6) Cursor handoff prompts. Cut the lower items and say so; never cut the guard, labeled estimates, or first-time-visitor behavior.

## Final report (one message, under 40 lines)
What was built (task → files → tests added → pass/fail), what is verified vs only mocked, decisions you made on the open items, commits pushed, remaining human steps in exact order (Convex login/deploy/seed, `convex env set` keys, Resend inbox, Vercel), and anything that needs the lead's decision.
