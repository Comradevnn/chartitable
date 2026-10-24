# Product spec — Lane A (donor layer + backend)

Audience: Revnn and the agents working in Lane A (`/convex`, `/engine`, `/layer`, `/staff`, `/seed`). Not needed for Lane B except §6 (the dashboard queries Lane A will expose) and §9 (contract).
Status labels: **BUILT** = exists and tested; **PROPOSED** = decided here, not yet in code; **OPEN** = needs a decision. Last updated Sat Oct 24, ~1 AM PT.
Data shapes live in `engine/types.ts` (source of truth; this file doesn't restate them). The honesty rule (D1/D8) governs everything below.

## 1. End-to-end flow
1. Donor opens a charity site → `layer.js` (contract v1). No token → nothing changes (first-time visitor sees the normal site).
2. Donor clicks the site's donate button → `layer.js` has rewritten its `href` to the hosted donate page `/donate?charity=<id>` (D10).
3. Donate page records a **test-mode** donation (`createDonation`), upserts the donor, signs a token, redirects to `charity.siteUrl?ct=<token>`. **PROPOSED**
4. Staff post an impact update (count, unit, note, optional photo) on the staff page → stored as an `ImpactLog`. **PROPOSED**
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
- **OPEN:** default window for the demo. Proposed: rolling 30 days ending at the latest log.

## 4. Narrative and guard — engine BUILT, action PROPOSED
- Claude sees only `DonorFacts`. Output schema: `{ story, nextStep: { kind, text } }` (`NARRATIVE_JSON_SCHEMA`).
- Guard rejects: numbers/number words not derivable from facts, unlabeled estimates, percentages, names not in facts, pressure language, markup, over-length text. Failure → `templateFallback(facts)` (always passes the guard). `NarrativeResult.source` records which was used; guard reasons are kept for the dashboard's narrative review (dashboard Next N3).
- API error, timeout (set 15 s), or missing key → template fallback; never block the page.
- Regenerate when `factsHash` changes (new log, new gift, new visit window). Otherwise serve the cache.
- Thin data (`thinData: true`) → short story, no padding.
- **OPEN:** per-call cost cap / daily call cap for the demo (propose a hard cap of N calls per hour, fall back to template beyond).

## 5. Tokens and "since last visit" — tokens BUILT, visits PROPOSED
- `signToken/verifyToken`: HMAC-SHA256, opaque ids only, default TTL 30 days; failures: `malformed | bad-signature | expired`. Secret: `TOKEN_SECRET`.
- Each successful `/donor-view` call records a `visits` row. `sinceLastVisit` = records/estimates with `loggedAt` after the donor's previous visit (null on first visit with a token). Anything the response can't support is omitted, not guessed.
- Invalid, expired or missing token → `{ recognized: false }` with no error detail.

## 6. HTTP API — PROPOSED (T7b)
### `GET /donor-view?charity=<id>` — header `Authorization: Bearer <token>`
Response is `DonorView` (see `engine/types.ts`). CORS open to any origin. Never returns email or other donors' data. Records and estimates are separate arrays.
### Donate (Convex mutation) `createDonation(charityId, amountCents, firstName?, email?, hideFromTopDonors?)`
Test mode only. Returns a signed token; the page redirects with only `?ct=`. Email never appears in a URL.
### Dashboard queries (for Lane B; shapes in `docs/DASHBOARD_SPEC.md`, task T19)
`dashboard:overview`, `dashboard:donors`, `dashboard:expenses`, `dashboard:addExpense`. New table `expenses`; new donor fields `hideFromTopDonors`, `thankedAt`.

## 7. Milestones and email — PROPOSED (T9)
- Trigger: a donor's cumulative **estimated** impact (aggregated by kind) crosses a threshold, e.g. 25 / 50 / 100 / 250 meals; threshold id stored in `milestoneEmails` so each fires once.
- Frequency cap: at most one email per donor per 7 days. Quiet by default.
- Content: only guard-passing text; estimates labeled; one link.
- **Safety:** send only to `DEMO_INBOXES`; non-allowlisted addresses are logged and skipped. Resend without a verified domain delivers only to the account owner's address (D4).
- **OPEN:** thresholds are placeholders; pick values that make the demo trigger on seeded data.

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
