# PROGRESS.md — shared context for all agents and humans

> Read this first, but only your lane's parts: see the **Read map** in CLAUDE.md. Tag new Handoff log lines `[A]` product, `[B]` dashboard/demo sites, `[C]` docs/pitch/QA, `[ALL]`. Keep it true. Claim tasks before starting. Append to the Handoff log; never rewrite others' lines.
> Deadline: **Devpost submission Sun Oct 25, 9:00 AM PT.** Pitch: 3 min + 2 min Q&A. Needs: Devpost page, project image, public GitHub repo, demo video.

## Snapshot
- **Project:** Chartitable — personalization layer that shows returning donors their impact on a small charity's own website.
- **Community:** small food pantries/food banks without fundraising staff, and their donors.
- **Tracks:** Anthropic "Claude for Public Benefit" (primary) · Figma · Convex · SpaceXSI (built with Cursor) · stretch: Cartesia
- **Current phase:** build — Lane A backend done in code (T3, T4 backend, T6b, T7b, T9, T19; 254 tests); next: Convex login + env (lead), then T8/T4 page in Cursor
- **Last updated:** Sat Oct 24, 1:35 AM PT

## Team & ownership
| Who | Role | Owns |
|---|---|---|
| Revnn (lead) | Architecture, most code, via Claude Code + Cursor/Grok | `/convex`, `/engine`, `/layer`, `/staff`, `/seed` |
| Teammate 1 (on site) | Figma designs → demo charity websites, Figma tracks | `/demo-sites`, `/frontend` |
| Teammate 2 (arrives Sat afternoon) | QA run-throughs, Devpost, video, pitch (see T13–T15) | `/docs` |

**Tool split:** Claude Code (Opus orchestrator + Sonnet/Haiku subagents) and Cursor/Grok both write code. **Never edit a file owned by an in-progress task from the other tool.** Note the tool in the Owner column, e.g. `Revnn/CC` or `Revnn/Cursor`.

## Decisions
| ID | Decision | Why | Status |
|---|---|---|---|
| D1 | Honesty rule: proportional, labeled estimates; Claude narrates only logged facts | Pooled funds can't be traced per dollar; misleading donors is a real risk | Decided |
| D2 | Realtime backend: **Convex** | TS end to end; built-in file storage (photos), actions (Claude, email), scheduled functions (milestones), HTTP actions (embed API) | Decided |
| D3 | Hosting: **Convex cloud** for API/HTTP endpoints; **Vercel** for `layer.js`, staff page, donate page, and both demo sites (separate URLs) | Two real origins prove "works on any site"; static deploys are fast | Decided |
| D4 | Email: **Resend** (via Convex action). Demo sends only to team inboxes | Simplest API. Without a verified domain Resend only delivers to the account owner's address — acceptable for demo | Decided |
| D5 | Fictional charities only; no real orgs or donor data | Avoid impersonation and privacy issues | Decided |
| D6 | Donor links carry a signed opaque token, no personal data in URLs | Privacy | Decided |
| D7 | Name: **Chartitable** (was ImpactLayer). CSS class prefix `ct-`, storage key prefix `chartitable:` | Lead's choice | Decided |
| D8 | Narrative model `claude-sonnet-5-5`, structured JSON output; a deterministic **fact-check guard** rejects any output containing a number/name not in the facts payload and falls back to a template | Makes the honesty rule enforced, not just prompted — core of the Anthropic pitch | Decided (plan approved) |
| D9 | Monorepo with npm workspaces (no pnpm installed). `engine` is pure TS (no Convex imports) so it's unit-testable with Vitest; `layer` bundles to one IIFE via esbuild | Fast tests, zero framework in the embed | Decided (plan approved) |
| D10 | Donations go through our hosted **test-mode donate page** (`/donate?charity=<id>`), not a form inside the charity site | Mirrors Stripe Checkout redirect; one form serves both sites; returns donor to the site with their token | Decided (plan approved) |
| D11 | Voice slot stays **Cartesia** (stretch, only after DoD 1–6 pass). **Not** using the Grok Imagine/Voice API | Lead's call. Voice must be core for Cartesia; one slot can't serve both. Accepts the risk that the "Make it Legendary with SpaceXAI" track may require Grok Imagine/Voice (PRIZE_RULES §1); the MLH SpaceXSI A-Team track needs only Cursor + Grok Bot | **Decided (lead) — replaces earlier proposal**. Revisit only if the workshop says the Grok API is required AND time remains |
| D12 | Add a **charity dashboard** (staff-facing: top donors, expense tracking, cost per meal, retention, thank-you queue, export). Spec: `docs/DASHBOARD_SPEC.md`. Teammate 1 designs it in Figma first, then implements in `/dashboard` using Impeccable (github.com/pbakaus/impeccable). Built on mock data first; Revnn adds Convex queries/`expenses` table | Lead's call (Sat 12:30 AM). Gives the pantry a home for the honesty rule, a strong Figma-track/Technical story, and the grant-report use case | Decided (lead). **Priority: after DoD 1–6; MVP = Overview, Donors, Expenses.** Lead to confirm cut order below |
| D13 | Keep **Claude** as the only narrative model. Do not switch to Meta. Enter the Meta track by framing (Chartitable strengthens the connection between donors and small charities; Claude is essential, not decorative) | PRIZE_RULES §13: Meta track needs no Meta model, only the theme; switching would weaken Anthropic criterion 4 (thoughtful use of Claude); Meta Model API has no free tier and its cheap tier trains on prompts (donor data risk) | **Decided (lead, Sat 2:20 AM)** |

## Repo structure (proposed)
```
/convex          Convex backend: schema.ts, donations.ts, impact.ts, allocations.ts,
                 narrative.ts (Claude action), tokens.ts, email.ts, milestones.ts, http.ts
/engine          Pure TS: allocate.ts (proportional, time-windowed), facts.ts (facts payload),
                 guard.ts (fact-check), prompt.ts; *.test.ts (Vitest)
/layer           layer.ts → dist/layer.js (esbuild IIFE); default styles; test page
/staff           Static pages: staff update (text + photo), hosted donate page
/demo-sites/one  Fictional pantry site #1 (Teammate 1)
/demo-sites/two  Fictional pantry site #2, different look (Teammate 1)
/seed            Fictional donors, donations, a week of pantry logs, placeholder photos, loader
/frontend        Static HTML/CSS/inline-JS pages: index (landing), dashboard, admin; fictional sample data, no backend calls (Lane B)
/docs            Pitch script, Devpost draft, Q&A prep
.env.example     ANTHROPIC_API_KEY, RESEND_API_KEY, TOKEN_SECRET, CONVEX_URL, DEMO_INBOXES
```

## Integration contract (demo sites ↔ layer) — **v1 LOCKED**
```html
<!-- in <head> or end of <body> -->
<script src="https://<layer-host>/layer.js" data-charity="<charity-id>" defer></script>

<!-- anywhere in the page; leave them EMPTY -->
<section data-impact-slot="hero"></section>              <!-- big personalized impact block -->
<section data-impact-slot="since-last-visit"></section>  <!-- what changed since last visit -->
<section data-impact-slot="next-step"></section>         <!-- one tailored suggestion -->

<!-- the site's donate button -->
<a data-impact-donate href="#donate">Donate</a>
```
- **Charity IDs:** `demo-pantry-a` (site one), `demo-pantry-b` (site two). Display names are Teammate 1's choice — must be fictional (D5).
- **Empty by default:** slots render nothing for unrecognized visitors; the site must look complete without them. Recommended CSS: `[data-impact-slot]:empty { display: none; }`
- **State hooks:** when a donor is recognized, the layer sets `data-impact-active` on `<html>` and `data-impact-state="ready"` on each filled slot. Sites can style around these (e.g. shrink the generic hero).
- **Donate button:** the layer rewrites the `href` of `[data-impact-donate]` to the hosted donate page for this charity. Without JS the site's own href stays.
- **Token:** arrives as `?ct=<token>` (from email link or donate redirect). The layer stores it in `localStorage` under `chartitable:<charity-id>` (try/catch) and removes it from the address bar with `history.replaceState`.
- **Markup the layer injects:** classes prefixed `ct-`. Logged facts use `.ct-record`; computed numbers use `.ct-estimate` and always carry the visible word "estimate"/"about". Photos use `.ct-photo`.
- **Theming:** set CSS variables on `:root` or on a slot: `--ct-accent`, `--ct-fg`, `--ct-bg`, `--ct-muted`, `--ct-font`, `--ct-radius`. Layer default styles use `:where()` (zero specificity) so site CSS always wins.
- **Local dev:** until Vercel is up, use `<script src="http://localhost:5174/layer.js" ...>`.
- Version: **v1** (Fri 10:35 PM). Bump the version and log it in the Handoff log on any change, and tell Teammate 1 directly.

## Task board
Status: `todo` · `doing` · `review` · `done` · `blocked`

| ID | Task | Owner | Status | Files | Acceptance check |
|---|---|---|---|---|---|
| T1 | Repo scaffold: git init, npm workspaces, Convex init, `.env.example`, `.gitignore`, Vitest, esbuild | Revnn/CC | done (convex dev pending lead login) | root | `npm test` runs; `npx convex dev` connects; `git ls-files` shows no secrets |
| T2 | Convex schema: charities, donors, donations, impactLogs (+photo storage id), allocations, visits, narratives | Revnn/CC (Sonnet) | done in code; live deploy BLOCKED (Convex login) | `/convex/schema.ts`, `/convex/seed.ts` | Schema deploys; seed loads into it |
| T3 | Hosted test-mode donate page + `createDonation` mutation; redirects back with `?ct=` | Revnn/CC (Sonnet) | review — built + tested in code; live BLOCKED (Convex login, TOKEN_SECRET, staff/config.js convexUrl) | `/staff/donate*`, `/convex/donations.ts`, `/engine/donate.ts` | $25 test donation appears in DB; redirect carries only token |
| T4 | Staff impact update page (text + count + unit + optional photo) | Revnn/Cursor (page) + CC (backend) | backend done (`convex/impact.ts`: log, generateUploadUrl, recent; PIN-gated); page todo in Cursor — prompt `docs/CURSOR_LAYER_STAFF_PROMPT.md` Part 2 | `/staff/update*` (Cursor), `/convex/impact.ts` (CC) | "Served 80 meals" stored with photo; allocations recompute |
| T5 | Allocation engine (proportional, time-windowed) | Revnn/CC (Sonnet) | done | `/engine/allocate.ts` + tests | Vitest: shares sum ≤ 100%, zero-donation window, late donor, rounding labeled |
| T6 | Claude narrative + next-step (facts in → JSON out) + fact-check guard (D8) | Revnn/CC (Sonnet) | review — T6a + T6b built; live Claude smoke passed (source claude, guard ok, 3.9 s); Convex action live BLOCKED (login + `convex env set ANTHROPIC_API_KEY`) | `/engine/facts.ts`, `/engine/guard.ts`, `/engine/prompt.ts`, `/convex/narrative.ts` | Guard tests: invented number/name rejected → template fallback; estimates labeled |
| T7 | Signed donor tokens (HMAC) + visits table for "since last visit" | Revnn/CC (Sonnet) | review — T7a + T7b built (`GET /donor-view`, visits, `tokens:issue`); live BLOCKED (Convex login, TOKEN_SECRET) | `/engine/token.ts`, `/convex/tokens.ts`, `/convex/http.ts` | Tampered/expired token rejected; no PII in URL |
| T8 | `layer.js` embed: read token, fetch donor view, fill slots, rewrite donate link | Revnn/Cursor (proposed) | todo | `/layer` | Works on 2 demo sites; unknown visitor sees normal site; no console errors |
| T9 | Milestone check (scheduled) + "See where your donation has gone" email via Resend | Revnn/CC (Sonnet) | review — built + tested; live BLOCKED (Convex login, RESEND_API_KEY, DEMO_INBOXES, TOKEN_SECRET; `milestones:setDemoEmail` for donor_a01 before demo step 2) | `/convex/milestones.ts`, `/convex/email.ts`, `/convex/crons.ts`, `/engine/milestones.ts`, `/engine/email.ts` | Email arrives at team inbox; link opens site with personalized view |
| T10 | Demo charity site #1 (fictional food pantry) from Figma | Teammate 1 | todo | `/demo-sites/one` | Includes contract v1 slots + donate button; looks complete with slots empty |
| T11 | Demo charity site #2 (different look) | Teammate 1 | todo | `/demo-sites/two` | Same embed works unchanged |
| T12 | Fictional seed data: donors, donations, a week of pantry logs + photos | Revnn/CC (Sonnet, with T2) | done in code; `npx convex run seed:load` BLOCKED (Convex login) | `/seed` | Clearly labeled fictional; loader is idempotent |
| T13 | End-to-end demo run-through (Definition of done 1–6) | Teammate 2 | todo | — | All six steps pass twice in a row on deployed URLs |
| T14 | Demo video, Devpost write-up, project image | Teammate 2 | todo | `/docs` | Uploaded before 8:30 AM Sun |
| T15 | Pitch script (3 min) + Q&A prep (honesty rule, failure modes) | Teammate 2 + Revnn | todo | `/docs` | Rehearsed twice, timed |
| T16 | Cursor + Grok Bot paper trail (screenshots, Cursor commits, Grok Bot notes in `/docs/cursor-grok-log.md`); project description states how both were used (MLH SpaceXSI track) | Revnn | todo | `/docs/cursor-grok-log.md` | Log has entries before Sun 5:30 AM |
| T17 | Make GitHub repo **public** (required by Devpost): run secret/PII scan over tree + history, add README stating each sponsor tool's role, then `gh repo edit Comradevnn/chartitable --visibility public --accept-visibility-change-consequences` | Revnn (lead approves) | todo | repo | Public by Sun 8:30 AM; scan clean; README present |
| T18 | Dashboard (first-pass static pages already in `/frontend`: `index.html`, `dashboard.html`, `admin.html`, pushed by `naelqdl`; decide to keep or move into `/dashboard`): Figma design (M1–M3) then `/dashboard` build on mock data per `docs/DASHBOARD_SPEC.md`; one-prompt handoff in `docs/TEAMMATE_DASHBOARD_PROMPT.md` | Teammate 1 | todo | `/dashboard`, `docs/DASHBOARD_SPEC.md` | Figma by Sat 1 PM; 3 screens on mock data by Sat 7 PM; labels for records vs estimates verified |
| T19 | Dashboard backend: `expenses` table, `donors.hideFromTopDonors`/`thankedAt`, queries `dashboard:overview/donors/expenses`, `addExpense`; swap the mock adapter | Revnn/CC (Sonnet) | review — backend built + tested (all functions take `pin`); swapping Lane B's mock adapter waits for `/dashboard` | `/convex/dashboard.ts`, `/convex/schema.ts`, `/engine/dashboard.ts` | Matches the data contract in the spec; Vitest on status/cost-per-meal rules |
| T20 | Four fictional test host sites (ports 5501–5504) + `?preview=1` dev harness, Impeccable initialised; prompt in `docs/CURSOR_TEST_SITES_PROMPT.md` | Revnn/Cursor | review | `/demo-sites/test-hosts/**`, `docs/cursor-shots/`, `docs/cursor-grok-log.md` | Each site complete with empty slots; filled correctly with `?preview=1`; audited; no real org names |

## Definition of done (demo)
1. $25 donation on a demo site → recorded
2. Staff posts "served 80 meals" + photo → allocations update
3. Milestone email → link → personalized impact + labeled estimates + next step
4. Reload after another update → "since your last visit" changes
5. First-time visitor sees the normal site
6. Same embed works on two different demo sites

## Plan to Sunday 9:00 AM (PT) — APPROVED
| When | Work | Parallel lanes | Checkpoint |
|---|---|---|---|
| Fri 10:35–11:15 PM | Lead: Convex login, Vercel login, put keys in `.env`. CC: T1 scaffold | Teammate 1 starts Figma for site #1 against contract v1 | — |
| Fri 11:15 PM–1:15 AM | T2 schema + T12 seed · T5 allocation engine · T7 tokens (pure part) | 3 Sonnet subagents, disjoint files | **C1 1:15 AM:** seed loads; allocation + token tests green |
| Sat 1:15–3:00 AM | T6 narrative + guard on seed data · T3 donate page | 2 subagents | **C2 3:00 AM:** a seeded donor gets a real Claude story that passes the guard |
| Sat 3:00–7:30 AM | **Sleep** (lead). Teammate 1 sleeps on their own schedule | — | — |
| Sat 7:30–11:00 AM | T8 `layer.js` (Cursor) + `/donor-view` HTTP endpoint · T4 staff page (Cursor) | CC does HTTP endpoint; Cursor does layer + staff page | **C3 11:00 AM:** DoD 1, 2, 5 pass on site #1 (or a stub) |
| Sat 11:00 AM–2:00 PM | "Since last visit" (visits) · T9 milestone email · first deploy to Convex prod + Vercel | — | **C4 2:00 PM:** DoD 1–5 on deployed site #1 |
| Sat 2:00–3:00 PM | Onboard Teammate 2 (read this file; T13 first run-through) | — | — |
| Sat 3:00–7:00 PM | Site #2 integration · bug fixes from T13 · honesty polish (labels, empty-data cases) | Teammate 2 drafts Devpost + pitch | **C5 7:00 PM:** DoD 1–6 end to end, twice |
| Sat 7:00–10:00 PM | Design polish (Figma track) · stretch only if C5 passed (Cartesia voice thank-you) | — | **10:00 PM feature freeze** |
| Sat 10:00 PM–1:00 AM | Bug bash · record **backup demo video** · README | — | **C6 1:00 AM:** backup video exists |
| Sun 1:00–5:30 AM | **Sleep** | — | — |
| Sun 5:30–8:30 AM | Final video, Devpost, project image, secret scan, repo public, rehearse pitch twice | — | **8:30 AM submitted** (30 min buffer) |
| **Sun 9:00 AM** | Hard deadline | | |

**Cut order if behind** (drop from the bottom first): Cartesia → dashboard Next/stretch items → site #2 visual polish → photos in email → CSV import → staff page photo upload (use seeded photos). Never cut: guard (D8), labeled estimates, first-time visitor untouched.

## Blockers
| Blocker | Who can unblock | Since |
|---|---|---|
| Convex account login (`npx convex dev` is interactive) | Revnn | Fri 10:35 PM |
| ~~`ANTHROPIC_API_KEY`~~ (in `.env`, verified Fri 11:35 PM; still needs `npx convex env set` after Convex login) · `RESEND_API_KEY` in `.env`; name the Resend account-owner inbox for demo | Revnn | Fri 10:35 PM |
| Vercel account login (needed by C4, not before) | Revnn | Fri 10:35 PM |
| Someone on site picks up the X Premium code at the SpaceXSI booth; sign in to Grok Bot (x.ai/bot) with the Cursor account (no Grok API key needed, see D11) | Revnn / Teammate 1 | Fri 11:00 PM |
| At the SpaceXSI workshop (Fri 8 PM) or booth: is the Grok Imagine/Voice requirement enforced? What counts as "built with Cursor"? How is Grok Bot proof shown? Devpost fields still unreleased | Revnn / Teammate 1 | Fri 11:00 PM |
| C1 "seed loads": run `npx convex dev` (link deployment), then `npx convex run seed:load` | Revnn | Fri 11:05 PM |
| Convex env for Lane A (after login): `TOKEN_SECRET` (≥32 chars), `ANTHROPIC_API_KEY`, `STAFF_PIN`, `DEMO_INBOXES`, `RESEND_API_KEY`, `DONATE_PAGE_URL`; then `milestones:setDemoEmail` for donor_a01 and `staff/config.js` convexUrl. Exact commands: `docs/handoff/revnn.md` | Revnn | Sat 1:35 AM |
| Lane B dashboard adapter: Convex dashboard functions need a `pin` arg (STAFF_PIN) in addition to the DASHBOARD_SPEC data contract | Teammate 1 | Sat 1:35 AM |
| Seed charity names ("Larkspur Lane Pantry", "Copperfield Table Food Bank") are placeholders — Teammate 1 picks final display names; tell orchestrator to update `seed/data.ts` | Teammate 1 | Fri 11:05 PM |

## Handoff log
<!-- Append only. Format: `- [Sat 10:42 AM PT] <who/tool>: <what changed, files, what's next>` -->
- [Fri 10:15 PM PT] Claude (planning chat): Created MASTER_PROMPT.md and PROGRESS.md. Next: open D2–D4, propose plan, lock contract.
- [Fri 10:19 PM PT] Claude Code (Opus orchestrator): Imported PROGRESS.md into the project root (Chartitable/). Repo is otherwise empty, not yet a git repo. Next: answer D2–D4, then T1 scaffold.
- [Fri 10:35 PM PT] Claude Code (Opus orchestrator): D2 Convex, D3 Convex+Vercel, D4 Resend, D7 renamed to Chartitable. Proposed D8–D10, repo structure, hour plan. **Locked integration contract v1** (charity ids, donate button, state hooks, token param, theming vars) — Teammate 1 can build now. Next: lead approves plan → T1 scaffold.
- [Fri 10:43 PM PT] Claude Code (Opus orchestrator): T1 done. Root package with npm workspaces `engine`, `layer`; `convex/` lives at root (Convex CLI convention, root has the `convex` dep), not a workspace. Vitest at root (`engine/**`, `seed/**` tests), `npm run build` → `layer/dist/layer.js` (IIFE), `npm run dev:layer` serves :5174. TS 7, Vitest 5, esbuild 0.28, convex 1.48. Lead still needs to run `npx convex dev` once to link a deployment.
- [Fri 10:48 PM PT] Claude Code (Opus orchestrator): Wrote `/engine/types.ts` (shared contract: Charity, Donor, Donation, ImpactLog, Allocation, DonorFacts, NarrativeOutput/Result, TokenPayload, DonorView draft). Lanes import, never edit. Convex tables reference engine string ids (not `v.id`). Token API is async (Web Crypto) so it runs in Convex's default runtime. Launching C1 lane: T2+T12, T5, T7a (Sonnet) + H1 (Haiku). Subagents report their handoff line; orchestrator appends it (avoids concurrent edits to this file).
- [Fri 10:47 PM PT] Sonnet/T7a: Added /engine/token.ts (async HMAC-SHA256 signToken/verifyToken via Web Crypto, DEFAULT_TOKEN_TTL_MS 30d) + token.test.ts; 8 tests green. Check order: structure → signature → expiry. T7b can import directly.
- [Fri 10:50 PM PT] Sonnet/T5: /engine/allocate.ts + allocate.test.ts (allocate, roundEstimate); 11 tests green. Rule: a donation is eligible for a log if same charity and window.from <= createdAt <= loggedAt; share = donor cents / eligible cents; roundEstimate floors (<1 → 0, <100 → integer, >=100 → multiple of 5).
- [Fri 10:58 PM PT] Claude Code (Opus orchestrator): Gated T5 + T7a (re-ran tests, read code, Haiku H2/H3 scan: PASS; the only "@" is a negative test that rejects a token carrying an email). Committed. Saved H1 Convex cheat sheet to `convex/CONVEX_NOTES.md` — later Convex lanes read it first. Waiting on T2+T12.
- [Fri 10:50 PM PT] Sonnet/T2+T12: convex/schema.ts (8 tables, engine string keys + by_key indexes), convex/seed.ts (idempotent upsert loader via internalMutationGeneric), seed/data.ts (pure fictional seed: 2 charities, 12 donors, 25 donations over 21 days, 7 days of logs; edge cases: donor_a05 no recent gift, donor_a12 late donor, pantry A empty day), 8 tests, 3 placeholder SVGs. Demo donor = donor_a01 "Mira", $25 to demo-pantry-a.
- [Fri 11:05 PM PT] Claude Code (Opus orchestrator): Gated T2+T12. Fixed loader so re-seed never resets `impactLogs.photoStorageId`. Haiku H2/H3/H4: PASS (no secrets/real orgs/PII; schema mirrors types; photoStorageId is `Id<"_storage">` in DB vs string in engine — fine). **C1 status: allocation + token + seed tests green (27/27), typecheck clean; "seed loads" BLOCKED on lead's Convex login.** Started T6a early (facts/guard/prompt/template, pure engine).
- [Fri 11:00 PM PT] Sonnet/T6a: engine/facts.ts (buildFacts, hashFacts), prompt.ts (buildPrompt, NARRATIVE_JSON_SCHEMA), guard.ts (deterministic fact-check), template.ts (templateFallback) + tests. Template never echoes staff notes; next-step rule: thinData → give_again, new records since last visit → share, else volunteer.
- [Fri 11:25 PM PT] Claude Code (Opus orchestrator): Gated T6a. Tightened guard: estimate credited to the donor ("your gift provided 80 meals") must be labeled even when it equals a record; "$N" must be a real gift/total; markup rejected. Prompt now states every rule the guard enforces (fewer needless fallbacks). Added engine/pipeline.test.ts (seed → allocate → facts → template → guard for every donor). 156/156 tests green. Haiku H5 audit PASS. **Caller contract for T6b:** JSON.parse → guard(parsed, facts) → on any failure templateFallback; cache only guarded output by hashFacts; layer renders as text (textContent), never HTML. Known guard limits for Q&A: lowercase invented names, names inside staff notes are allowed (notes are records), "one" unchecked.
- [Fri 11:00 PM PT] Claude Code (Opus orchestrator): Read PRIZE_RULES.md. Added D11 (Grok Voice, proposed), T16, two blockers (X Premium code/Grok key; workshop questions). Also noted: table pitch is ≤5 min, so update T15 (3-min script still fits); re-check prizes page Sat evening and Sun AM; README to state each sponsor tool's role. Next: lead confirms D11, then T1 scaffold.
- [Fri 11:05 PM PT] Sonnet/T1: Verified existing scaffold; added XAI_API_KEY to .env.example, --cors-origin=* to layer dev server (CORS header confirmed on :5174), docs/.gitkeep. npm test 156/156, build emits layer/dist/layer.js, typecheck clean, git add -n shows only .env.example. Next: lead runs `npx convex dev`.
- [Fri 11:10 PM PT] Claude Code (Opus orchestrator): Lead rejected D11 as proposed. Cartesia stays the voice stretch; no Grok Voice/Imagine. T16 reduced to the Cursor/Grok Bot paper trail; XAI_API_KEY no longer needed (left in .env.example, unused). Risk logged: SpaceXAI main track may be out of reach; still ask at the workshop.
- [Fri 11:35 PM PT] Claude Code (Opus orchestrator): ANTHROPIC_API_KEY stored in git-ignored `.env` (mode 600), verified with a free models-list call (HTTP 200). Convex actions read Convex env, not `.env`: after login run `npx convex env set ANTHROPIC_API_KEY …`. T6b unblocked for local/mocked work.
- [Fri 11:40 PM PT] Claude (main chat): Lead supplied organizer-email findings; appended as PRIZE_RULES §11. Impacts: Anthropic prize = $5K credits + Max 20x (workshop Sat, time TBD, worth attending for multi-agent advice); Convex prize listed as hardware not cash; Cartesia details 'later' (keep it last priority); no Grok API requirement in emails (supports D11 rejection); venue bans hotspots (Wi-Fi only); Teammate 2 needs Hacker Pass for check-in. Open: get Hacker Guide + Devpost link contents.
- [Fri 11:55 PM PT] Claude (main chat): Read the Devpost page (PRIZE_RULES §12). Confirmed hard requirements: **GitHub repo + project image + demo (video recommended on Devpost)**, 3-min pitch + 2-min Q&A (plan unchanged), at venue by Sun 8 AM, submit with teammates by 9 AM. No Anthropic or Annapurna row on Devpost, so ask at the Anthropic booth how to enter the track. Convex prize is $1,308 + hardware; Cartesia $1,516. SpaceXSI wants real space data + Cursor, with no Grok API requirement: a long shot for us, keep T16 paper trail only for the raffle/MLH track. Best People-First Social Impact + MLH Commit Fellowship fit Chartitable: opt in at submission. The public GitHub repo is now a confirmed requirement.
- [Fri 11:59 PM PT] Claude (main chat): Created PRIVATE repo https://github.com/Comradevnn/chartitable (secret scan of history + pending files clean), committed pending files, pushed main. Added T17 (go public before submission). Other orchestrator session: pull nothing needed, just `git push` as you commit.
- [Sat 12:35 AM PT] Claude (main chat): Lead decided on a charity dashboard (D12). Wrote `docs/DASHBOARD_SPEC.md` (MVP M1–M3, Next, idea pool, privacy rules, mock data contract) and `docs/TEAMMATE_DASHBOARD_PROMPT.md` (one prompt: Figma first, then `/dashboard` with Impeccable, branch `dashboard`). Added T18 (Teammate 1) and T19 (backend, Revnn). Open: teammate needs a repo invite (private repo); Figma track pick; staff login = PIN stub proposed.
- [Sat 1:05 AM PT] [ALL] Claude (main chat): Added `docs/PRODUCT_SPEC.md` (Lane A spec: flow, rules, API, failure modes, tests; OPEN items marked) and a Read map in CLAUDE.md saying which files each role reads or skips. Log lines are now tagged by lane.
- [Sat 12:13 AM PT] [ALL] Nael/CC: Added `/frontend` (index, dashboard, admin static pages; fictional data, no backend calls) in 92a7ba8, merged to main e37e7bf; `/frontend` owned by Nael (naelqdl).
- [Sat 1:30 AM PT] [ALL] Claude (main chat): `naelqdl` pushed `/frontend` (landing, donor dashboard "My Impact", staff donors page) under the name "Second Helping". Assigned to Lane B in CLAUDE.md. TODO before it counts for T18: check the name is not a real org, check estimates are labeled, confirm it follows contract v1 (it has no fetch/Convex calls yet). Not yet reviewed.
- [Sat 2:10 AM PT] [ALL] Claude (main chat): Meta research done (PRIZE_RULES §13). Proposed D13: keep Claude, enter the Meta track on theme alone. Template search found no license-clean ready-made charity site; build our own from `/frontend` with Impeccable (HTML5 UP CC BY 3.0 as an attributable base if needed).
- [Sat 2:20 AM PT] [A] Claude (main chat): D13 confirmed by lead (keep Claude, no Meta). Added T20 and the Cursor prompt for test host sites (`docs/CURSOR_TEST_SITES_PROMPT.md`). Writes only under `/demo-sites/test-hosts/`, so it does not collide with Teammate 1's `/demo-sites/one|two` or `/frontend`.
- [Sat 12:47 AM PT] [A] Cursor/Grok 4.7: T20 Stage A. Installed Impeccable 4.7.0 into `.cursor` (project scope). Wrote root `PRODUCT.md` from the T20 brief (static fictional charity hosts, honest labels, neighborly voice). Live mode not configured; no pages yet. Next: build-path answer, then Stage B preview harness.
- [Sat 1:13 AM PT] [A] Cursor/Grok 4.7: T20 in review. Four fictional hosts in `demo-sites/test-hosts/` (Cinderwell Pantry :5501, Trestlebin Regional Food Bank :5502, Pellam Street Pantry :5503, Osier Court Community Center :5504) plus `?preview=1` harness. Names searched; no real-org match. Screenshots in `docs/cursor-shots/`. DESIGN.md not written (four separate looks). Next: lead review.
- [Sat 1:10 AM PT] [A] Claude Code (Opus orchestrator, Lane A run): Step A committed — schema (expenses, donor hideFromTopDonors/thankedAt, narrative guardReasons, narrativeCalls, milestoneEmails thresholdId/status), `engine/config.ts` (30-day window, caps, thresholds), dashboard + milestone types in `engine/types.ts`, typed Convex builders without codegen (`convex/lib/*`), `context:forDonor`, `allocations:recompute`, `@anthropic-ai/sdk`. Calibration test (§16) committed: demo donor 22.9 → 26.8 meals, crosses 25 only after the 80-meal log.
- [Sat 1:05 AM PT] [A] Sonnet/T6b: `engine/narrative-run.ts` (+14 tests), `convex/narrative.ts` (cached, callStats, store, recordCall, getOrGenerate). Stores only claude/rejected outcomes; no_key/capped/error retry later.
- [Sat 1:05 AM PT] [A] Sonnet/T7b: `engine/donor-view.ts` (+13 tests), `convex/http.ts` (only router; GET/OPTIONS /donor-view), `convex/visits.ts` (30/min limit), `convex/tokens.ts` (siteFor, issue). Page never waits on Claude: cached story or template now, generation scheduled.
- [Sat 1:05 AM PT] [A] Sonnet/T3: `engine/donate.ts` (+10 tests), `convex/donations.ts` (create, charityInfo), `staff/donate.{html,js,css}`, `staff/config.js` (convexUrl empty until deploy). Always a new donor; redirect carries only `?ct=`.
- [Sat 1:05 AM PT] [A] Sonnet/T19: `engine/dashboard.ts` (+20 tests), `convex/dashboard.ts` (overview, donors, expenses, addExpense, markThanked, generateReceiptUploadUrl; all take `pin`), 16 fictional seed expenses, donor_a07 hidden from top donors. Lane B: same names/shapes as the DASHBOARD_SPEC data contract, plus a `pin` arg.
- [Sat 1:05 AM PT] [A] Sonnet/T4-backend: `engine/impact.ts` (+6 tests), `convex/impact.ts` (log returns donorsCredited count; generateUploadUrl; recent).
- [Sat 1:10 AM PT] [A] Claude Code (Opus orchestrator): Gated wave 1 (read diffs, 223/223 tests, typecheck, build; Haiku contract/secret/PII/guard/auth/CORS check PASS). Live Claude smoke for donor_a01 via the real pipeline: source claude, guard passed first try, 3.9 s. Decisions: NARRATIVE_MIN_INTERVAL_MS default 60 s (spec said 10 min) so demo steps 3→4 still get a Claude story; narrative facts exclude since-last-visit (that slot renders from structured data, keeps factsHash stable); donor-view never waits on Claude. Wrote `docs/CURSOR_LAYER_STAFF_PROMPT.md` (T8 + T4 page). T9 running.
- [Sat 1:20 AM PT] [A] Sonnet/T9: `engine/milestones.ts` + `engine/email.ts` (+22 tests), `convex/milestones.ts` (firedFor, claim, setStatus, candidates, check, setDemoEmail), `convex/email.ts`, `convex/crons.ts` (5 min). Allowlist checked in planner and again in sender.
- [Sat 1:35 AM PT] [A] Claude Code (Opus orchestrator): Gated T9; glue: milestone check skips the whole run until RESEND_API_KEY + DEMO_INBOXES are set (thresholds not burned early) and runs right after `impact:log`. H5 honesty audit found a guard false accept (unlabeled estimate in a donor sentence when the number also equals a gift/record) → fixed, plus thin-data stories may not quote estimates and a wider pressure list; template reworded so it always passes. H3 secret/PII scan of tree + history: PASS (note for T17: commit author metadata includes a local-machine email). Live Claude smoke re-run on the tightened guard: source claude, 2.7 s. Spec → v0.3 (BUILT labels, chosen defaults), `docs/handoff/revnn.md` rewritten, `.env.example` lists all Convex env names. 254 tests green.
