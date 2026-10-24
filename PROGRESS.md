# PROGRESS.md — shared context for all agents and humans

> Read this first. Keep it true. Claim tasks before starting. Append to the Handoff log; never rewrite others' lines.
> Deadline: **Devpost submission Sun Oct 25, 9:00 AM PT.** Pitch: 3 min + 2 min Q&A. Needs: Devpost page, project image, public GitHub repo, demo video.

## Snapshot
- **Project:** Chartitable — personalization layer that shows returning donors their impact on a small charity's own website.
- **Community:** small food pantries/food banks without fundraising staff, and their donors.
- **Tracks:** Anthropic "Claude for Public Benefit" (primary) · Figma · Convex · SpaceXSI (built with Cursor) · stretch: Cartesia
- **Current phase:** build — plan approved Fri 10:40 PM; C1 lane running
- **Last updated:** Fri Oct 23, 10:50 PM PT

## Team & ownership
| Who | Role | Owns |
|---|---|---|
| Revnn (lead) | Architecture, most code, via Claude Code + Cursor/Grok | `/convex`, `/engine`, `/layer`, `/staff`, `/seed` |
| Teammate 1 (on site) | Figma designs → demo charity websites, Figma tracks | `/demo-sites` |
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
| T2 | Convex schema: charities, donors, donations, impactLogs (+photo storage id), allocations, visits, narratives | Revnn/CC (Sonnet) | doing | `/convex/schema.ts`, `/convex/seed.ts` | Schema deploys; seed loads into it |
| T3 | Hosted test-mode donate page + `createDonation` mutation; redirects back with `?ct=` | Revnn/CC | todo | `/staff/donate*`, `/convex/donations.ts` | $25 test donation appears in DB; redirect carries only token |
| T4 | Staff impact update page (text + count + unit + optional photo) | Revnn/Cursor (proposed) | todo | `/staff/update*`, `/convex/impact.ts` | "Served 80 meals" stored with photo; allocations recompute |
| T5 | Allocation engine (proportional, time-windowed) | Revnn/CC (Sonnet) | doing | `/engine/allocate.ts` + tests | Vitest: shares sum ≤ 100%, zero-donation window, late donor, rounding labeled |
| T6 | Claude narrative + next-step (facts in → JSON out) + fact-check guard (D8) | Revnn/CC | todo | `/engine/facts.ts`, `/engine/guard.ts`, `/engine/prompt.ts`, `/convex/narrative.ts` | Guard tests: invented number/name rejected → template fallback; estimates labeled |
| T7 | Signed donor tokens (HMAC) + visits table for "since last visit" | Revnn/CC (Sonnet: pure part) | doing (T7a pure) | `/engine/token.ts`, `/convex/tokens.ts`, `/convex/http.ts` | Tampered/expired token rejected; no PII in URL |
| T8 | `layer.js` embed: read token, fetch donor view, fill slots, rewrite donate link | Revnn/Cursor (proposed) | todo | `/layer` | Works on 2 demo sites; unknown visitor sees normal site; no console errors |
| T9 | Milestone check (scheduled) + "See where your donation has gone" email via Resend | Revnn/CC | todo | `/convex/milestones.ts`, `/convex/email.ts` | Email arrives at team inbox; link opens site with personalized view |
| T10 | Demo charity site #1 (fictional food pantry) from Figma | Teammate 1 | todo | `/demo-sites/one` | Includes contract v1 slots + donate button; looks complete with slots empty |
| T11 | Demo charity site #2 (different look) | Teammate 1 | todo | `/demo-sites/two` | Same embed works unchanged |
| T12 | Fictional seed data: donors, donations, a week of pantry logs + photos | Revnn/CC (Sonnet, with T2) | doing | `/seed` | Clearly labeled fictional; loader is idempotent |
| T13 | End-to-end demo run-through (Definition of done 1–6) | Teammate 2 | todo | — | All six steps pass twice in a row on deployed URLs |
| T14 | Demo video, Devpost write-up, project image | Teammate 2 | todo | `/docs` | Uploaded before 8:30 AM Sun |
| T15 | Pitch script (3 min) + Q&A prep (honesty rule, failure modes) | Teammate 2 + Revnn | todo | `/docs` | Rehearsed twice, timed |

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

**Cut order if behind** (drop from the bottom first): Cartesia → site #2 visual polish → photos in email → CSV import → staff page photo upload (use seeded photos). Never cut: guard (D8), labeled estimates, first-time visitor untouched.

## Blockers
| Blocker | Who can unblock | Since |
|---|---|---|
| Convex account login (`npx convex dev` is interactive) | Revnn | Fri 10:35 PM |
| `ANTHROPIC_API_KEY`, `RESEND_API_KEY` in `.env`; name the Resend account-owner inbox for demo | Revnn | Fri 10:35 PM |
| Vercel account login (needed by C4, not before) | Revnn | Fri 10:35 PM |

## Handoff log
<!-- Append only. Format: `- [Sat 10:42 AM PT] <who/tool>: <what changed, files, what's next>` -->
- [Fri 10:15 PM PT] Claude (planning chat): Created MASTER_PROMPT.md and PROGRESS.md. Next: open D2–D4, propose plan, lock contract.
- [Fri 10:19 PM PT] Claude Code (Opus orchestrator): Imported PROGRESS.md into the project root (Chartitable/). Repo is otherwise empty, not yet a git repo. Next: answer D2–D4, then T1 scaffold.
- [Fri 10:35 PM PT] Claude Code (Opus orchestrator): D2 Convex, D3 Convex+Vercel, D4 Resend, D7 renamed to Chartitable. Proposed D8–D10, repo structure, hour plan. **Locked integration contract v1** (charity ids, donate button, state hooks, token param, theming vars) — Teammate 1 can build now. Next: lead approves plan → T1 scaffold.
- [Fri 10:43 PM PT] Claude Code (Opus orchestrator): T1 done. Root package with npm workspaces `engine`, `layer`; `convex/` lives at root (Convex CLI convention, root has the `convex` dep), not a workspace. Vitest at root (`engine/**`, `seed/**` tests), `npm run build` → `layer/dist/layer.js` (IIFE), `npm run dev:layer` serves :5174. TS 7, Vitest 5, esbuild 0.28, convex 1.48. Lead still needs to run `npx convex dev` once to link a deployment.
- [Fri 10:48 PM PT] Claude Code (Opus orchestrator): Wrote `/engine/types.ts` (shared contract: Charity, Donor, Donation, ImpactLog, Allocation, DonorFacts, NarrativeOutput/Result, TokenPayload, DonorView draft). Lanes import, never edit. Convex tables reference engine string ids (not `v.id`). Token API is async (Web Crypto) so it runs in Convex's default runtime. Launching C1 lane: T2+T12, T5, T7a (Sonnet) + H1 (Haiku). Subagents report their handoff line; orchestrator appends it (avoids concurrent edits to this file).
