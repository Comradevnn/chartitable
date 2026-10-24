# Product spec — Lane A (donor layer + backend)

Audience: Revnn and the agents working in Lane A (`/convex`, `/engine`, `/layer`, `/staff`, `/seed`). Not needed for Lane B except §6 (the dashboard queries Lane A will expose) and §9 (contract).
Status labels: **BUILT** = exists and tested; **PROPOSED** = decided here, not yet in code; **OPEN** = needs a decision. Last updated Sat Oct 24, ~1:20 AM PT (v0.3: Lane A backend BUILT in code; live deploy pending Convex login).
Data shapes live in `engine/types.ts` (source of truth; this file doesn't restate them). The honesty rule (D1/D8) governs everything below.

## 1. End-to-end flow
1. Donor opens a charity site → `layer.js` (contract v1). No token → nothing changes (first-time visitor sees the normal site).
2. Donor clicks the site's donate button → `layer.js` has rewritten its `href` to the hosted donate page `/donate?charity=<id>` (D10).
3. Donate page records a **test-mode** donation (`createDonation`), creates a new donor (never looked up by email), signs a token, redirects to `charity.siteUrl?ct=<token>`. **BUILT (T3: `convex/donations.ts`, `staff/donate.*`)**
4. Staff post an impact update (count, unit, note, optional photo) on the staff page → stored as an `ImpactLog`. **Backend BUILT (`convex/impact.ts`); page PROPOSED (Cursor, T4)**
5. Allocation recomputes for the window (§3) → per-donor `Allocation` rows. **BUILT (engine)**
6. For a donor: `buildFacts` → `buildPrompt` → Claude (`claude-sonnet-5-5`, JSON) → `guard` → accept, else `templateFallback`; cache by `factsHash` in `narratives`. **BUILT (engine); Convex action PROPOSED (T6b)**
7. Milestone check (scheduled) finds donors who crossed a threshold → Resend email "See where your donation has gone" with `siteUrl?ct=<token>` → only to `DEMO_INBOXES`. **PROPOSED (T9)**
8. Donor opens the link → `layer.js` stores the token (`localStorage` key `chartitable:<charity-id>`, try/catch), strips `?ct=` with `history.replaceState`, calls `GET /donor-view`, fills slots. **PROPOSED (T7b, T8)**
9. Next visit after a new staff update → "since your last visit" differs (§5).

## 2. Data model — BUILT (`convex/schema.ts`)
charities, donors, donations, impactLogs, allocations, visits, narratives (indexed by donor + charity + factsHash), milestoneEmails. Money is integer cents in storage; facts carry whole dollars. Photos use Convex file storage (`photoStorageId`). Seed is fictional and idempotent; re-seeding never resets photo ids.

## 3. Allocation — BUILT (`engine/allocate.ts`; rule documented in its header)
- A log is shared among donors in proportion to their eligible gifts; eligible = same charity, made within the window and **at or before the log's `loggedAt`** (late donors get nothing from earlier logs).
- `estimatedQuantity = share × log.count × attributableFraction` (default 1). Always `isEstimate: true`; displayed through `roundEstimate()`, which never overstates.
- No eligible donations → no allocations. Deterministic ordering.
- **Default window: BUILT default, rolling 30 days ending now** (`engine/config.ts` `WINDOW_DAYS`; lead may still change it — rerun the calibration test). The window bounds both donations and logs, so a short window can drop a donor entirely: on the seed, the demo donor's gift is 9 days old and gets **0 meals** in a 7-day window, **42** in 14 days, **23** in 30 days (their share dilutes as other gifts enter). Never use a window shorter than the demo donor's gift age; see §16 for the calibrated demo numbers.

## 4. Narrative and guard — BUILT (engine + `convex/narrative.ts`; live Claude smoke passed Sat 1:08 AM)
- Claude sees only `DonorFacts`. Output schema: `{ story, nextStep: { kind, text } }` (`NARRATIVE_JSON_SCHEMA`).
- Guard rejects: numbers/number words not derivable from facts, unlabeled estimates, percentages, names not in facts, pressure language, markup, over-length text. Failure → `templateFallback(facts)` (always passes the guard). `NarrativeResult.source` records which was used; guard reasons are kept for the dashboard's narrative review (dashboard Next N3).
- API error, timeout (set 15 s), or missing key → template fallback; never block the page.
- Regenerate when `factsHash` changes (new log, new gift, new visit window). Otherwise serve the cache.
- Thin data (`thinData: true`) → short story, no padding.
- **Call cap: BUILT, default chosen** 60 Claude calls per hour per deployment and at most 1 regeneration per donor+charity per **60 s** (shortened from 10 min so demo steps 3→4 still get a Claude story; §19.3); beyond either, serve the cached story or the template. Set as env vars (`NARRATIVE_MAX_PER_HOUR`, `NARRATIVE_MIN_INTERVAL_MS`).

## 5. Tokens and "since last visit" — BUILT (`engine/token.ts`, `convex/visits.ts`; previous visit = most recent `/donor-view` call)
- `signToken/verifyToken`: HMAC-SHA256, opaque ids only, default TTL 30 days; failures: `malformed | bad-signature | expired`. Secret: `TOKEN_SECRET`.
- Each successful `/donor-view` call records a `visits` row. `sinceLastVisit` = records/estimates with `loggedAt` after the donor's previous visit (null on first visit with a token). Anything the response can't support is omitted, not guessed.
- Invalid, expired or missing token → `{ recognized: false }` with no error detail.

## 6. HTTP API — BUILT (T7b `convex/http.ts`; T3 `donations:create`; T19 `convex/dashboard.ts`, every dashboard function takes a `pin` arg)
### `GET /donor-view?charity=<id>` — header `Authorization: Bearer <token>`
Response is `DonorView` (see `engine/types.ts`). CORS open to any origin. Never returns email or other donors' data. Records and estimates are separate arrays.
### Donate (Convex mutation) `createDonation(charityId, amountCents, firstName?, email?, hideFromTopDonors?)`
Test mode only. Returns a signed token; the page redirects with only `?ct=`. Email never appears in a URL.
### Dashboard queries (for Lane B; shapes in `docs/DASHBOARD_SPEC.md`, task T19)
`dashboard:overview`, `dashboard:donors`, `dashboard:expenses`, `dashboard:addExpense`. New table `expenses`; new donor fields `hideFromTopDonors`, `thankedAt`.

## 7. Milestones and email — BUILT (T9 `convex/milestones.ts`, `convex/email.ts`, `convex/crons.ts`; also runs right after `impact:log`; does nothing until `RESEND_API_KEY` and `DEMO_INBOXES` are set)
- Trigger: a donor's cumulative **estimated** impact (aggregated by kind) crosses a threshold, e.g. 25 / 50 / 100 / 250 meals; threshold id stored in `milestoneEmails` so each fires once.
- Frequency cap: at most one email per donor per 7 days. Quiet by default.
- Content: only guard-passing text; estimates labeled; one link.
- **Safety:** send only to `DEMO_INBOXES`; non-allowlisted addresses are logged and skipped. Resend without a verified domain delivers only to the account owner's address (D4).
- **Thresholds: BUILT defaults meals 25 / 50 / 100 / 250** (`engine/config.ts`; compared against the rounded "about N" value) (other kinds: produce 100 / 250 / 500 lb; volunteer shifts 3 / 6 / 12). Calibrated in §16 so the seeded demo donor crosses 25 meals exactly when staff post "served 80 meals".

## 8. Failure modes
| Failure | Behavior |
|---|---|
| Claude error/timeout/missing key | Template story; page works |
| Guard rejects output | Template; reasons logged |
| Bad/expired token | `recognized:false`; site unchanged |
| No logs yet / zero meals | Say less; no estimates shown |
| Convex down | `layer.js` fails silently; slots stay empty; no console errors |
| localStorage blocked | Works for the session via URL token only |
| Email send fails | Retry once; log; never block donation |

## 9. Contract with Lane B (shared surface)
Lane B's static pages live in `/frontend` (not Lane A's). Lane A wires them to the API only after Lane B stabilizes the markup; until then they use mock data.
Integration contract v1 in `PROGRESS.md` and the dashboard data contract in `docs/DASHBOARD_SPEC.md`. Lane B never edits Lane A files; changes go through PROGRESS.md Blockers.

## 10. Test plan (maps to demo-done checks in PROGRESS.md)
- Unit (BUILT): allocation, tokens, facts, prompt, guard (invented number/name/unlabeled estimate), template, pipeline, seed builder.
- Needed: `/donor-view` auth cases; milestone once-only and allowlist; donate redirect has only `ct`; layer smoke on two pages (donor, first-time).
- Manual end to end (T13, Teammate 2): checks 1–6 twice in a row on deployed URLs.

## 11. Non-goals
Real payments, real accounts/auth for donors, SMS intake, multi-tenant onboarding, real charity data, generated imagery.

---

## 12. Convex function inventory (what gets built, who calls it)
| Function | Kind | Caller | Task |
|---|---|---|---|
| `seed:load` | mutation | CLI (lead) | T2/T12 BUILT |
| `donations:create` | mutation | donate page | T3 |
| `impact:log` | mutation + `generateUploadUrl` | staff page | T4 |
| `allocations:recompute(charityId)` | internal mutation, runs after `impact:log` and `donations:create` | internal | T4/T3 |
| `narrative:getOrGenerate(donorId, charityId)` | action | `donorView` | T6b |
| `tokens:verify` | internal query | HTTP layer | T7b |
| `http: GET /donor-view` | httpAction | `layer.js` | T7b |
| `visits:record` | internal mutation | `donorView` | T7b |
| `milestones:check` | scheduled (every 5 min in demo) | cron | T9 |
| `email:sendMilestone` | action | `milestones:check` | T9 |
| `dashboard:*` | queries/mutation | Lane B pages | T19 |
Rules: pure logic stays in `/engine` and is imported; Convex functions are thin wrappers. Every function validates args (Convex validators) and charity ids against `CHARITY_IDS`.

## 13. `layer.js` behavior (T8, Cursor)
- **Init:** runs on `DOMContentLoaded`; reads `data-charity` from its own script tag. Unknown charity id or missing slots → do nothing.
- **Token:** order of precedence: `?ct=` in URL (then store + `history.replaceState` to remove it) → `localStorage["chartitable:<id>"]` (try/catch; falls back to in-memory). No token → exit silently (first-time visitor: DOM untouched, no network call).
- **Fetch:** one `GET /donor-view` with the Bearer token, 4 s timeout, no retries. `recognized:false` or any error → remove the stored token only on explicit `recognized:false`; otherwise leave slots empty. No `console.error` output in normal failure paths.
- **Render:** fill each slot found on the page with plain text nodes and `.ct-*` classes (never `innerHTML` with API strings; text is escaped by construction). Records use `.ct-record`; estimates use `.ct-estimate` with the visible word "about" or "estimate"; photos use `.ct-photo` with `alt` text from the record note. Set `data-impact-state="ready"` per slot and `data-impact-active` on `<html>` only after a successful render.
- **No layout shift for strangers:** slots are `:empty` by default; fill atomically in one frame.
- **Donate link:** rewrite `[data-impact-donate]` `href` to `<hosted donate>/donate?charity=<id>` on init, token or not. Without JS the site's own href is used.
- **Accessibility:** slots become `region`s with `aria-label`s; estimates carry the label in text, not only color; respects `prefers-reduced-motion` (no animation by default).
- **Size/perf:** target < 8 KB min+gzip, no dependencies, one network call, no render-blocking.
- **Styles:** default CSS wrapped in `:where()`; theming via `--ct-*` variables.

## 14. Donate page (T3) and staff page (T4)
**Donate (`/staff/donate`)**: charity name from `charity` query param (validated); amount presets $10 / $25 / $50 / custom (1–500 dollars); optional first name; optional email (placeholder says demo inboxes only); checkbox "Don't list me publicly"; a persistent banner "TEST MODE — no real payment"; submit → `donations:create` → redirect to `charity.siteUrl?ct=<token>`. No card fields at all. Failure shows a plain error and keeps the form.
**Staff (`/staff/update`)**: for demo, a shared PIN from env (`STAFF_PIN`, a fictional value, never real credentials); fields: kind (meals / produce / volunteer shifts), count (positive integer ≤ 10,000), unit (prefilled), note (≤ 200 chars, shown verbatim to donors so the page warns "visible to donors; don't include personal info"), optional photo (image only, ≤ 5 MB, resized client-side). After save: shows "recorded" and the new allocation summary count; no donor names displayed.

## 15. Config, security and operations
- **Env (Convex dashboard, not the repo):** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TOKEN_SECRET` (≥ 32 random bytes), `DEMO_INBOXES`, `STAFF_PIN`, `NARRATIVE_MAX_PER_HOUR`, `NARRATIVE_MIN_INTERVAL_MS`. `.env.example` lists names only. `XAI_API_KEY` is unused (D11).
- **CORS:** `/donor-view` allows any origin because the token, not the origin, is the credential; no cookies are used. Staff and donate endpoints are Convex mutations, not open HTTP.
- **Token storage risk:** a token in `localStorage` is readable by scripts on the same origin; accepted for the demo, TTL 30 days, grants read-only access to one donor's own impact. Call this out in Q&A.
- **Rate limiting:** `/donor-view` returns the cached view when available; per-token limit 30 requests/minute (reject with `recognized:false`-shaped empty response, no error detail).
- **Logging:** log ids and outcomes only. Never log tokens, emails, or the narrative text with names. Dashboard shows guard reasons without PII.
- **Costs:** one Claude call per donor per `factsHash` change; ≈ 12 seeded donors × a few regenerations stays far below the cap. Convex and Vercel free tiers suffice; Resend limited by the demo allowlist.
- **Deploy:** Convex prod deployment for functions; Vercel for `layer.js`, `/staff`, `/frontend`, demo sites. `layer.js` URL is baked into the demo sites; keep it stable (`/layer.js`, no hash in the name).
- **Observability for the demo:** a hidden `/staff/health` page (PIN-protected) showing last Claude call source (claude/template), last milestone run, last email result. Helps the live demo and Teammate 2's QA.

## 16. Demo script mapped to the seed (calibrated)
Calibration run (script on `buildSeed(now = 2026-10-24 08:00 UTC)`, window 30 days, meals only, pantry A):
- Demo donor `donor_a01` ($25 to `demo-pantry-a`, 9 days old): **23 meals** estimated before the staff update.
- After staff post "served 80 meals" (new log, same charity): **26.8 meals** (share of the new log ≈ 4.9%). This crosses the 25-meal milestone, so the email fires **only after step 2 of the demo**, which makes the story causal and honest.
- On a 7-day window the same donor shows **0** meals; do not use 7 days.
Caveats: the margin over 25 is small (1.8 meals). Seed numbers depend on `now`; re-run the calibration (a Vitest on seed + allocate + threshold) whenever the seed or window changes. The label always says "about", and the UI rounds down via `roundEstimate()`, so the display may read "about 26 meals".
Demo order (matches PROGRESS.md demo-done checks): (1) $25 test donation → redirected with token, layer shows a short first view; (2) staff post "served 80 meals" with photo → allocations update; (3) milestone email arrives in a team inbox → link → hero story, labeled estimates, next step; (4) staff post another update → reload → "since your last visit" changes; (5) open the site in a private window → normal site; (6) repeat the token view on the second demo site (`demo-pantry-b`, seeded donors have gifts there too).
Note for step 1: a brand-new donor has no staff-logged impact before their gift, so the first view must say less (thin data), not invent one.

## 17. Acceptance by task (Lane A) — one line each
T3: $25 donation row exists; redirect URL has only `ct`. T4: log row + photo stored; allocations count changes. T6b: seeded donor gets `source:"claude"` that passes the guard, or `template` with reasons; cache hit on second call. T7b: tampered token → `recognized:false`; two views → different `sinceLastVisit`. T8: layer smoke on both fixtures, no console errors, strangers untouched. T9: non-allowlisted address never sent; threshold fires once; double run sends once. T19: dashboard queries match the data contract; status/cost-per-meal rules unit-tested.

## 18. Risks and mitigations
| Risk | Mitigation |
|---|---|
| No Convex login / keys at C2 | Run narrative against the engine locally with a mocked Claude call; keep the Convex action thin |
| Claude output keeps failing the guard | Template is the floor; log reasons; tighten prompt, never loosen guard |
| Seed numbers drift from the demo script | Calibration test in §16 |
| Resend delivers only to the account owner | Demo inbox = account owner address; others skipped and logged |
| Live demo network failure | Backup recorded video (C6); `layer.js` fails silent; pre-warm the cache for the demo donor |
| Layer breaks a host site | Slots empty by default; scoped `ct-` classes; zero-specificity styles |

## 19. Open decisions for the lead
1. Confirm the 30-day window and thresholds in §3/§7/§16.
2. Staff auth: shared PIN env var (recommended) vs none for the demo.
3. Claude call cap (60/hour) and regeneration interval (10 min).
4. Where `layer.js` is hosted for the demo before Vercel is ready (local `http://localhost:5174` per contract v1).

### Defaults chosen during the Lane A build (Sat ~1:20 AM PT; lead may override)
1. Window 30 days and thresholds as above; calibration test `engine/calibration.test.ts` passes (22.9 → 26.8 meals).
2. Staff auth: shared `STAFF_PIN` env var for `impact:*` and `dashboard:*` (fails closed when unset).
3. Call cap 60/hour; per-donor regeneration interval 60 s (env `NARRATIVE_MIN_INTERVAL_MS`).
4. `layer.js` gets its API origin at build time (`--define:CT_API_BASE`), so contract v1 is unchanged; local dev keeps `http://localhost:5174/layer.js`.
5. Claude never sees since-last-visit; that slot is rendered from structured records, which keeps `factsHash` stable across visits. `/donor-view` never waits on Claude: it serves the cached story or the template and schedules generation.
