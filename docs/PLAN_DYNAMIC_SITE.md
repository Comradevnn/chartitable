# Plan: from "page swaps one template" to "page that adapts" (Lane A)

Status: **APPROVED Sat 8:30 AM PT with all §7 defaults (D19).** Wave 0 done 8:35 AM (types, contract v2 in PROGRESS.md, test env, task rows T24–T32). Written by the Opus orchestrator.
Deadline: Devpost Sun Oct 25, 9:00 AM PT (hard). Feature freeze stays **Sat 10:00 PM PT**. That leaves about 13 working hours today.

Starting point (verified by reading the code, commit `aefe51e`):
- `layer/src/layer.ts` has v1 slots plus the v2 region engine (`paintRegions`/`fillNode`/`fillFact`). Two of the gaps in Cinderwell's NOTES are already fixed in that commit: repeater `data-ct-text` stripping, and the start gate now accepts `[data-impact-region]`. The hidden `data-impact-slot="regions"` on Cinderwell is no longer needed.
- `/donor-view` records a `visits` row on **every** call, and "since your last visit" means "since the previous call". That matters a lot for live updates (§3.4).
- `scripts/build-site.mjs` publishes only `demo-sites/test-hosts/`, and the seed's `siteUrl` points at `/sites/warm-pantry/` and `/sites/regional-bank/`. **The new hosts are not deployed, and email/donate links would not land on them.** This is a must-fix.
- `nextStep.href` is set only for give kinds, and the `nextStep.kind` comes from Claude or the template rule. Nothing classifies the donor.
- Context loads only donations inside the 30-day window, so the backend can't see a donor's older gifts today.

---

## 1. Ranked scope

Effort = wall-clock for one Sonnet task, including the orchestrator gate.

### Must-have (by the 2:30 PM checkpoint)
| # | Item | Effort | Demo moment it buys |
|---|---|---|---|
| M1 | **Ship the new hosts**: publish `demo-sites/hosts/*` at `/sites/cinderwell/` and `/sites/brindlecote/`; repoint the seed `siteUrl`; reseed | 0.5 h | Email and donate links land on the real-looking sites, not the fixtures |
| M2 | **Region engine v2.1** in the layer: when-expressions (AND/OR/NOT), several templates per region chosen by donor state, `nextLabel`, host-declared next-step hrefs, donate links rewritten inside cloned templates, `body`/`headline` fields. Split into testable modules, with **tests** | 2.5 h | The same page composes differently for different donors |
| M3 | **Donor state on the backend**: deterministic `state` + `traits`, next-step kind chosen by rule, `label`, `href` always resolvable, number-free template headline, story `body` without the repeated thank-you, the donor's own gifts, `rev` | 2 h | "The site knows where you are in your story", backed by rules a judge can read |
| M4 | **Live updates**: `GET /donor-pulse` (cheap rev check), `/donor-view?peek=1` (no visit row), layer polls every 6 s only while the tab is visible and only for a recognized donor | 2 h | Staff log "served 80 meals" and the open donor page updates in front of the judge |
| M5 | **Core motion**: recognition swap (View Transitions, with a fade fallback), record count-up, estimate draw-in, "Just logged" arrival. `prefers-reduced-motion` respected throughout | 2 h | The page visibly turns into *their* page, and the new record arrives with a moment |
| M6 | **Hosts on v2**: convert Brindlecote to regions + templates; add state variants to Cinderwell | 2.5 h | Two different sites, two different compositions, one embed |
| M7 | **Warm narrative on change**: the milestone sender schedules `narrative:getOrGenerate` before emailing, and the pulse picks up the upgraded story | 0.75 h | The email link opens on a Claude story, not the template |
| M8 | **Contract v2 published**: PROGRESS.md section, version bump, log line, Lane B told | 0.3 h (Opus) | Required by the rules |

### Should-have (by the 10 PM freeze, in this order)
| # | Item | Effort | Moment |
|---|---|---|---|
| S1 | **Claude headline under the guard**: output schema gains `headline`; the guard checks every field; `PROMPT_VERSION` goes into the facts hash | 1.5 h | "Claude writes each line, and the guard checks each line." Strong for the Anthropic track |
| S2 | **Give again as the same donor**: the layer appends `ct` to the donate link; the hosted donate page shows "last time: $25 on Oct 15" (a record), presets that amount, and credits the gift to the same donor | 2 h | The donor gives again, comes back, and the page shows two gifts |
| S3 | Log `state` on each visit row; `ops:health` shows counts by state | 0.5 h | Q&A: "we can measure which composition people saw" |
| S4 | Scroll reveals for below-the-fold donor regions; sections glide to their new order (`view-transition-name`) | 0.75 h | The re-composition reads as a designed transformation |
| S5 | Cinderwell inner pages (about/donate/get-food) on v2 regions | 1 h | The token carries across pages, and every page adapts |
| S6 | Fictional SVG scene "photos" for the seed logs, replacing the grey placeholders | 0.75 h | Record tiles look real |

### Cut (and why)
- **Convex WebSocket subscription in the layer.** It needs `convex/browser` in the embed (estimated at tens of KB, against an 8 KB budget; not measured). It also needs a public query that takes the token as an argument, and queries can't read the wall clock, so token expiry and the window would depend on a time the client passes in. Polling a cheap pulse gives the same demo moment.
- **Section-read behaviour signals and beacons.** They need client tracking plus a new write endpoint. That is a privacy surface for little demo value.
- **Retention-by-variant dashboard.** Seed data can't produce a real retention number, so anything shown would look made up. Keep S3, which only logs the state.
- **"Volunteer-minded" state.** No volunteer signal exists in the data, so the state would be invented.
- **Nav re-ordering by behaviour.** No behaviour data justifies it. State-keyed CSS re-composition covers the visible part.
- **Claude-generated CTA labels and subheads.** Labels stay a deterministic table: zero guard risk, same look.
- **Monthly-giving mechanics.** Nothing in the data model recurs. `give_monthly` is chosen only if S2 ships with an honest "monthly (test mode, nothing recurs)" option. Otherwise repeat donors get `give_again`.
- **Lapsed-state demo.** The rule exists, but tokens live 30 days, so there's no honest way to demo it.

### Drop order if behind (first to go at the top)
S6 → S5 → S3 → S4 → S2 → S1 → M7 → M5 extras (keep the swap and the arrival, drop count-up and draw-in) → M4 (fallback: step 4 is a reload, as today) → M6 Brindlecote stays on v1 slots. **DoD 6 still passes on v1**, so this is a safe floor.
Never cut: the guard, labeled estimates, first-time-visitor behaviour, M1.

---

## 2. Contract v2 spec (template language)

Version: **v2** (v1 stays valid; v2 is additive). Host-facing; this text goes into PROGRESS.md once approved.

### 2.1 Markup
```html
<script src="https://chartitable.vercel.app/layer.js" data-charity="demo-pantry-a" defer></script>

<!-- A region keeps its default markup for strangers. -->
<div data-impact-region="hero" data-impact-requires="story|records"> …default hero… </div>

<!-- One or more templates per region. The first whose data-impact-when matches wins;
     a template without data-impact-when is the region's default donor template. -->
<template data-impact-for="hero" data-impact-when="state:just_gave" data-impact-variant="just-gave"> … </template>
<template data-impact-for="hero" data-impact-when="since" data-impact-variant="news"> … </template>
<template data-impact-for="hero" data-impact-variant="thanks"> … </template>
```
- No `data-impact-slot` is needed on a v2 page.
- If no template matches, or the filled template is empty, the region keeps its default markup.

### 2.2 Conditions: one grammar everywhere
Used by `data-impact-requires` (region), `data-impact-when` (template) and `data-ct-if` (element).
```
expr := term ("|" term)*      OR
term := atom ("+" atom)*      AND
atom := "!"? key              NOT
```
Keys: `firstName story body headline records estimates since sinceRecords sinceEstimates sinceDate photos next nextHref gifts thin repeat`, plus `state:<name>` and `trait:<name>`. An unknown key is false. Expressions longer than 120 characters are ignored (treated as false). Examples: `story|records`, `since+!thin`, `state:first_impact|state:news`.

### 2.3 Fields (all filled with `textContent`)
| Attribute | Keys |
|---|---|
| `data-ct-text` (scalar) | `firstName`, `headline` (number-free), `story` (full), `body` (story minus a leading thank-you sentence), `nextText`, `nextLabel` (≤ 4 words, from a fixed table), `sinceDate`, `lastGiftDate`, `lastGift` ("$25", the donor's own record), `giftCount` |
| `data-ct-each` + `data-ct-limit` | `records`, `estimates`, `sinceRecords`, `sinceEstimates`, `gifts` |
| Inside a record item | `count`, `unit`, `record` ("80 meals"), `date`, `note`, `kind`; `img[data-ct-photo]` |
| Inside an estimate item | `estimate` → always "about N unit"; `unit`. **`count` and `record` return nothing inside estimate items** |
| Inside a gift item | `amount`, `date` |
| `data-ct-href` | `next`: the API href for give kinds, else the host's own `data-ct-href-<kind>` attribute (e.g. `data-ct-href-volunteer="#volunteer"`), else the element is removed. `donate`: the hosted donate URL |
| `data-ct-animate` | `count` (records only; ignored on estimates), `draw` (estimate container), `reveal` (scroll-in), `arrive` (live-inserted items) |
| `data-ct-live` | On a `data-ct-each` list: live-arriving records are inserted here and marked `data-ct-new` |

### 2.4 Hooks the layer sets (host CSS and JS may use them)
- `html[data-impact-active]`: unchanged.
- `html[data-impact-donor="<state>"]`: lets host CSS re-compose per state.
- On a region: `data-impact-state="ready"`, and `data-impact-variant="<name>"` from the chosen template.
- `html[data-impact-live]` while polling.
- Events on `document`: `chartitable:ready` and `chartitable:update`, with `detail = { state, variant map }`. No names, no numbers.
- Every `a[data-impact-donate]` inside a cloned template is rewritten. This replaces Cinderwell's MutationObserver workaround.

### 2.5 Safety rules (unchanged in spirit, now tested)
- API strings reach the DOM only through `textContent`. API URLs pass `safeUrl`. Host-authored attributes (templates, `data-ct-href-<kind>`) are trusted as host markup.
- An estimate number has exactly one path to the page: the `estimate` key, which the layer writes as "about N unit". It also gets `class="ct-estimate"` and `data-ct-kind="estimate"`. Records get `ct-record`. Hosts must label estimate containers visibly ("Your share, an estimate"); a Haiku audit checks this per host.
- Strangers: no network call, no injected style, no class or attribute writes except the donate-href rewrite (v1 behaviour).

### 2.6 Backward compatibility
- v1 slot pages render exactly as today. A v1 layer ignores the new response fields (they are additive).
- v2 adds no required host changes. The `data-impact-slot="regions"` on-switch is obsolete; it's harmless if left in place.

### 2.7 `/donor-view` response: additive fields
```ts
// engine/types.ts (orchestrator writes this before Wave 1)
type DonorState = "just_gave" | "news" | "first_impact" | "repeat" | "lapsed" | "returning";
type DonorTrait = "named" | "has_photos" | "regular";            // regular = ≥3 visits in 30 days
hero: { firstName; story; source; headline: string; body: string };
nextStep: { kind; text; href: string | null; label: string };
donor: { state: DonorState; traits: DonorTrait[]; gifts: DonationFact[]; giftCount: number };
rev: string;                                                       // opaque change marker
live: { pollMs: number } | null;                                   // null = don't poll
```

---

## 3. Backend plan

### 3.1 Donor-state classification: `engine/donor-state.ts` (pure, tested)
Inputs: the donor's own gifts at this charity (all-time, bounded `take(50)` on `by_donor`), `DonorFacts` (estimates, `thinData`, `sinceLastVisit`), visit count over the last 30 days, and `now`. The first rule that matches wins:
1. `just_gave`: newest gift ≤ 48 h old and no estimates yet. ("Thank you. Here is what happens next.")
2. `news`: `sinceLastVisit` has ≥ 1 record.
3. `first_impact`: exactly 1 gift and ≥ 1 estimate.
4. `repeat`: ≥ 2 gifts.
5. `lapsed`: newest gift older than `LAPSED_AFTER_DAYS` (90).
6. `returning`: everything else.

Traits: `named`, `has_photos`, `regular`.
Next-step kind by rule: just_gave → `share`; news → `share`; first_impact → `volunteer`; repeat → `give_again` (`give_monthly` only if S2 ships with monthly); lapsed → `give_again`; returning → `volunteer`.
The kind is passed into the facts as `nextStepKind`. Claude writes only the text, and the guard rejects output whose kind differs. Labels come from a fixed table (`Share the update`, `See volunteer shifts`, `Give again`).

### 3.2 Response changes
- `context.forDonor` additionally returns the donor's all-time gifts here (ids/amounts/dates only) and the visit count.
- `buildDonorView` adds `state`, `traits`, `gifts`, `label`, `headline`, `body` and `rev`.
- `headline` is a deterministic, number-free template per state, e.g. `Thank you{, Mira}.` or `New from the pantry since your last visit`. S1 can upgrade it to Claude.
- `body` = the story with a leading "Thank you…" sentence removed. This fixes the repeated headline even for cached stories.
- `rev` = short hash of (newest log id in the window, narrative `createdAt`, newest gift id).

### 3.3 Narrative and guard extension (S1)
- Output schema `{ headline, story, nextStep }`. Headline ≤ 70 characters, **no digits or number words**, names limited to `firstName` and the charity, pressure-word check applies.
- The guard runs per field. Any failure means the whole output falls back to the template (unchanged policy: false rejects are fine, false accepts are not).
- Add `PROMPT_VERSION` to `hashFacts` input so cached old-schema stories regenerate. Prompt rule: "do not open the story with thanks; the page shows a headline".
- Tests: invented number in the headline, invented name in the headline, kind mismatch, headline over length.

### 3.4 Live updates: polling, not a subscription
- `GET /donor-pulse?charity=…` with a Bearer token. It verifies the token (HMAC), runs one indexed read (newest log for the charity, newest narrative for the donor, newest gift), and returns `{ rev }` or `{ recognized:false }`. No visit row. CORS is the same as `/donor-view`.
- `GET /donor-view?charity=…&peek=1` returns the full view **without inserting a visit**, with `previousVisitAt` = the visit before the newest one. This keeps "since your last visit" anchored to the visit before this page load. **Without peek, every poll would consume "since your last visit".**
- Layer: start polling only after a successful recognized paint, every `live.pollMs` (6000 ms), only while `document.visibilityState === "visible"`, and stop after 10 minutes. On a changed `rev`, fetch with peek and repaint changed regions only.
- Over CORS from a third-party page: plain `fetch` with an `Authorization` header triggers a preflight. `Access-Control-Max-Age: 86400` is already set, and browsers cap it (Chrome at 2 h; not verified here). After the first poll it is one GET per 6 s. That's realistic.
- Rate limiting: the pulse is read-only and cheap. The per-token 30/min limit applies to non-peek views only. Proper per-token throttling would use `@convex-dev/rate-limiter` (the Convex guidelines recommend it). **Default: skip it for the demo** (same reasoning as D18) and log the decision.

### 3.5 Warm narrative (M7)
In `milestones` (before the send), and in `impact:log` for donors who visited in the last 30 days (at most 5), schedule `narrative:getOrGenerate`. The caps (60/h, 60 s per donor) still apply.

### 3.6 Measurement (S3 only)
`visits` gets an optional `state` field (optional, so no backfill issue). `ops:health` adds counts by state. No beacons and no variant-to-donation matching.

---

## 4. Animation and motion spec

Principles: motion explains a change; it doesn't decorate. Only `opacity` and `transform` are animated. Each moment is ≤ 600 ms and the whole recognition sequence is ≤ 1.2 s. No looping (the arrival pulse runs 2 cycles and stops). No confetti, no progress-to-goal bars, no countdowns: anything that reads as "you're 2 meals from a milestone" is pressure and is excluded.

| Moment | Trigger | Motion | Duration / easing | Reduced motion |
|---|---|---|---|---|
| **A. Recognition swap** | First recognized paint | `document.startViewTransition` around all region swaps in one callback: default content crossfades into the donor template; the headline morphs (`view-transition-name: ct-headline` on both). Fallback without VT: region fades from .3 to 1 opacity | 420 ms, `cubic-bezier(.2,.7,.2,1)` | Swap instantly, no VT |
| **B. Re-composition** | Same transition as A | Host sections carry `view-transition-name`; the reorder under `html[data-impact-active]` glides instead of jumping (S4) | Same transition | Instant |
| **C. Record count-up** | Record number enters the viewport (IntersectionObserver, once) | `data-ct-animate="count"`: the final value is in the DOM from the start (screen readers read it); a visual-only `aria-hidden` overlay counts 0 → N | 700 ms ease-out, max 30 steps | Final value only |
| **D. Estimate draw-in** | After C, or on entering the viewport | Dashed outline draws (scaleX on a pseudo-element), then "about N meals" fades in. **Estimates never count up**: counting implies precision | 500 ms + 200 ms delay | Shown static |
| **E. Scroll reveal** | Below-the-fold donor regions entering the viewport | translateY(8px) → 0 plus opacity | 380 ms ease-out, once | None |
| **F. Live arrival** | A pulse finds a new record | New tile inserted with `data-ct-new`, a "Just logged" tag, 2-cycle soft ring on the tag; region-level VT so neighbours slide over. Polite `aria-live` text: "The pantry just logged 80 meals." The estimate updates through D again | 450 ms insert, ring 2 × 1.2 s | Insert instantly; the aria-live text stays |
| **G. Story upgrade** (template → Claude) | A pulse finds a new narrative | Crossfade the story, **only if the hero is off-screen or within 3 s of load**; otherwise wait for the next load. Never change text someone is reading | 300 ms | Instant, same rule |

Layout shift and first-time visitors:
- Strangers: the layer injects nothing (no style tag, no attributes beyond the donate href, no network call). All motion CSS ships in the layer's own style block, injected only after recognition, and keyed on `[data-impact-state=ready]` / `html[data-impact-active]`. Default content is never hidden while a fetch is in flight, so a failed fetch leaves a normal page with no flash.
- Donors: before swapping, the layer pins each region's `min-height` to its current height and releases it after the transition. Hosts keep `min-height` on hero regions (Cinderwell already does). Live inserts happen at the top of a list and are announced.
- Animation runs only when `matchMedia("(prefers-reduced-motion: reduce)")` is false and the tab is visible.
- **Worth it for the 3-minute demo: A, C, D and F.** E and G are nice-to-have; B comes with S4.

---

## 5. Task breakdown (PROMPTS.md Part B/B2 style)

Every Sonnet prompt also gets: "read PROGRESS.md (Snapshot, contract v2, your row); append one `[A]` Handoff log line; report the files changed", plus the excerpt of §2/§3/§4 it needs.

**Wave 0: Opus, 30 min, sequential.** `engine/types.ts` additions (§2.7); contract v2 into PROGRESS.md; new task rows T24–T32; Blocker rows for Lane B; add `happy-dom` as a root devDependency and `layer/test/**/*.test.ts` to the Vitest include.

| ID | Owner/model | Goal | May edit | Must not edit | Interface | Acceptance check | Wave |
|---|---|---|---|---|---|---|---|
| T24 | Sonnet | Donor state, next-step rule, labels, headline/body, rev | `engine/donor-state.ts`(+test), `engine/donor-view.ts`(+test), `engine/next-step.ts`(+test) | `engine/types.ts`, `engine/guard.ts`, `engine/prompt.ts`, `engine/template.ts`, `convex/**`, `layer/**` | §2.7, §3.1–3.2 | `npm test`, `npm run typecheck`; table test for each state; rev changes on new log/narrative/gift only | 1 |
| T25 | Sonnet | Region engine v2.1 split into `layer/src/regions.ts`, `expr.ts`, `fields.ts`; wire into `layer.ts`; tests | `layer/src/**`, `layer/test/*.test.ts` | `engine/**`, `convex/**`, `demo-sites/**`, `docs/design/**` | §2.1–2.6 | `npm test`, `npm run typecheck`, `npm run build`; gzip ≤ 6 KB; region tests below | 1 |
| T26 | Sonnet | Publish `demo-sites/hosts/*`; repoint seed `siteUrl` to `/sites/cinderwell/` and `/sites/brindlecote/`; keep test-hosts published | `scripts/build-site.mjs`, `seed/data.ts`, seed tests | `demo-sites/**`, `convex/**` | — | `npm run build:site` serves both hosts with `/layer.js` rewritten; `npm test` (calibration still 22.9 → 26.8) | 1 |
| T27 | Sonnet | Convex: all-time gifts and visit count in context, `peek=1`, `/donor-pulse`, optional `visits.state`, warm narrative | `convex/http.ts`, `convex/visits.ts`, `convex/context.ts`, `convex/schema.ts`, `convex/milestones.ts`, `convex/impact.ts` | `engine/**` (imports only), `layer/**` | §3.2, §3.4, §3.5 | typecheck; orchestrator pushes to dev, then a live check: peek adds no visit row, pulse rev changes after `impact:log`, smoke script 8/8 | 2 (after T24) |
| T28 | Sonnet | Live polling and motion: `layer/src/live.ts`, `motion.ts`, `motion.css` (bundled; not `docs/design`) | `layer/src/**`, `layer/test/*.test.ts` | as T25 | §3.4 layer part, §4 | build; tests: polling stops when hidden or after 10 min, no duplicate items, reduced motion shows final values; gzip ≤ 8 KB | 2 (after T25; same files) |
| T29 | Sonnet (Lane B folder, see Q1) | Brindlecote → v2 regions with ≥ 3 hero variants; Cinderwell state variants, `body`/`headline`/`nextLabel`, host hrefs per kind, `view-transition-name`s; drop the MutationObserver and hidden-slot workaround; refresh the `donor-view.sample.json` files with v2 fields for `?preview=1` | `demo-sites/hosts/**` | everything else | §2 | Preview at 1280/768/390 with no horizontal overflow; strangers see unchanged pages; estimates labeled; ≥ 44 px targets | 2 (parallel with T27/T28) |
| T30 | Sonnet | S1 headline under the guard plus `PROMPT_VERSION` | `engine/guard.ts`, `engine/prompt.ts`, `engine/template.ts`, `engine/narrative-run.ts`, `engine/facts.ts`, their tests | `engine/types.ts`, `convex/**`, `layer/**` | §3.3 | `npm test` (all existing guard tests still pass); live: donor_a01 gets `claude` with a headline | 2–3 (Convex push only after T27 lands; see the gotcha) |
| T31 | Sonnet | S2 give-again: `ct` on the donate link, donate-page prefill, same-donor credit | `staff/donate.*`, `convex/donations.ts`, `engine/donate.ts`(+test), `layer/src/layer.ts` (donate rewrite only) | everything else | token only in the URL; email never | Redirect carries only `ct`; same donorId; calibration re-run | 3 |
| T32 | Sonnet | S3 + S6: `visits.state`, health counts, SVG scene photos | `convex/ops.ts`, `engine/ops.ts`, `seed/photos/**` | — | — | tests; health page shows states | 3 |
| H1 | Haiku | Diff vs contract v2 + honesty audit per wave: no API string via innerHTML, estimates only via `estimate`, labels visible, no PII in URLs or logs, no real org names | read-only | — | — | Report | after each wave |
| H2 | Haiku | Browser acceptance on deployed hosts: stranger = 0 Convex requests and no injected style; donor = variants per state, no console errors; reduced-motion run | read-only | — | — | Screenshots to the orchestrator | after Wave 2 |

Parallel sets: **Wave 1 = T24 ∥ T25 ∥ T26** (disjoint). **Wave 2 = T27 ∥ T28 ∥ T29**, with T30 starting once T27 is pushed. **Wave 3 = T31 ∥ T32** (T31 touches `layer.ts` only after T28 is merged).
Gotcha: a Convex push bundles the working tree's `engine/`, so the orchestrator never pushes while T30 is mid-edit.

**v2 region engine tests (T25/T28, happy-dom):**
- Stranger: DOM unchanged except donate hrefs, and no fetch.
- No template → default kept. `requires` false → default kept. Empty fill → default kept.
- `when` selection: first match wins, else the no-`when` default.
- Expression AND/OR/NOT and unknown keys.
- A story containing `<img onerror>` renders as text.
- `estimate` always begins "about "; `count`/`record` inside an estimate item are removed.
- `data-ct-limit`; `javascript:` photo/href rejected; host `data-ct-href-<kind>` fallback; donate links inside clones rewritten.
- A ready region isn't re-swapped; the html hooks are set.
- Live repaint marks `data-ct-new` without duplicates; reduced motion shows final numbers immediately.

**Known gaps → where each is fixed:** next href null → T25 host href fallback plus T24 `label`. No short label → T24 `nextLabel`. No OR logic → T25 grammar. Story repeats the headline → T24 `body` (and T30). No `data-ct-if` for `sinceDate` → T25 key. Grey photos → T32. No v2 tests → T25/T28. `.ct-next-link` 42 px → Lane B blocker (`docs/design/ct-slots.css`, `min-height: 44px`); v2 regions don't use it.

Schedule: Wave 0 8:30–9:00 · Wave 1 9:00–11:30 · Wave 2 11:30–2:30 → **C-dyn 2:30 PM: live pulse + variants on deployed Cinderwell** · Teammate 2 onboarding 2:30–3:00 with the new script · Wave 3 + H2 + rehearsal 3:00–6:00 · C5 (DoD 1–6 twice, including the live step) 7:00 PM · motion tuning and an Impeccable critique of the donor state 7–10 PM · freeze 10 PM.

---

## 6. Demo script (3 minutes)

Setup before going on stage: `seed:resetDemo` + `seed:load`. Pre-warm donor_a01. Open **Tab D** (donor_a01 via a `tokens:issue` link) once so a previous visit exists, then reload it so it shows the "returning" composition. Have Tab S (staff page, PIN typed), the inbox, and a private window ready. Check that macOS Reduce Motion is **off**. Hard-refresh to bust the cached `layer.js`.

| Time | Beat | On screen |
|---|---|---|
| 0:00–0:20 | Problem: small pantries can't afford donor follow-up, and pooled gifts can't be traced dollar by dollar | — |
| 0:20–0:40 | **First-time visitor**: Cinderwell in the private window, an ordinary charity site. "No request to us at all." | Optional: network panel |
| 0:40–1:05 | **Donate**: $25 test-mode gift → redirected → the site recognizes a `just_gave` donor: short thank-you, "nothing logged yet, here is what happens next". It says less because there is less | Hosted donate page, test-mode banner |
| 1:05–1:50 | **Live impact**: in Tab S, staff log "served 80 meals" + photo. Within about 6 s, Tab D shows "Just logged · 80 meals" (count-up), and the estimate redraws as "about 26 meals, an estimate". Then the email arrives (milestone 25) | Split screen S / D, then the inbox |
| 1:50–2:20 | **Email link** → `news` composition: Claude story checked by the guard, records and estimates visibly separate, next step "Share the update" | Tab from the email |
| 2:20–2:40 | **Honesty**: "Every number is either a logged record or a labeled estimate. Claude writes the words; a deterministic guard rejects any number or name not in the facts and a template takes over." | One slide, or `/staff/health` showing the source |
| 2:40–2:55 | **Second site**: Brindlecote, different design, same script tag, different composition for a pantry-B donor | Brindlecote tab |
| 2:55–3:00 | Close | — |

Failure modes to rehearse:
1. The smoke script runs during step 2, so the milestone check skips and no email arrives.
2. Tab D reloaded twice before step 2, so "since your last visit" is empty. Peek polling doesn't consume it, but reloads do.
3. Email link opens on the template: warm-on-change (M7) plus a pre-warm; the pulse upgrades the story within seconds.
4. Venue Wi-Fi fails: backup video (C6); the layer fails silently.
5. Milestone already fired from a rehearsal: run `seed:resetDemo`.
6. Step 1's gift dilutes donor_a01's share: the margin holds up to about $450; S2 give-again goes last or not at all on stage.
7. Reduce Motion is on, or the browser lacks View Transitions: the fade fallback looks fine; check it once.
8. Tab D in the background: polling pauses, so keep it visible in the split.
9. Stale `layer.js` from the CDN: hard refresh, or add `?v=` on the demo hosts.
10. Vercel blocks a teammate's commit: owner-authored redeploy (D16).

---

## 7. Risks and open questions (defaults chosen; override any)

1. **Who owns `demo-sites/hosts/**`?** It is Lane B's folder, but Lane A built it (like T20's test hosts). *Default:* Lane A claims it as T29 with a PROGRESS row and a note to Teammate 1. Teammate 1 stays on `/dashboard`, `/frontend` and `ct-slots.css`.
2. **Centerpiece hosts:** *Default:* Cinderwell (A) is the main demo and Brindlecote (B) is second. Seed links move to `/sites/cinderwell/` and `/sites/brindlecote/`; test-hosts stay published so old links don't 404.
3. **Live mechanism:** *Default:* 6 s visible-only polling of `/donor-pulse` with no rate limiter (logged as a demo trade-off, like D18). Alternative: add `@convex-dev/rate-limiter` (+30 min).
4. **Give-again as the same donor (S2):** credits a new gift to the token's donor (never looked up by email). *Default:* yes, if time; it's done last on stage, if at all, because it shifts the calibration.
5. **Headline source:** *Default:* deterministic number-free headline now (M3); Claude headline under the guard (S1) if time.
6. **Monthly:** *Default:* no monthly mechanics; repeat donors get `give_again`.
7. **Story upgrade while the page is open:** *Default:* only if the hero is off-screen or within 3 s of load.
8. **New devDependency `happy-dom`** for layer tests. *Default:* yes.

Smaller risks: View Transitions support outside Chromium is not verified; the layer gzip budget is tight with live + motion (target ≤ 8 KB); Wave 2 concurrency with Convex pushes; a teammate or Cursor editing the same checkout (stage explicit paths only).

---

## Appendix: what this plan was based on
Read: `CLAUDE.md`; `PROGRESS.md` (Snapshot, Decisions, contract v1, Task board, Blockers, last ~20 log lines); `docs/PRODUCT_SPEC.md`; `engine/types.ts`; `PROMPTS.md` (Part A/B headers and template); `layer/src/layer.ts`; `layer/package.json`; `demo-sites/hosts/cinderwell/{NOTES.md,index.html,site.js}` + motion/active rules in `styles.css` + the head of `donor-view.sample.json`; `demo-sites/hosts/brindlecote/NOTES.md` + slot/section lines of its HTML; `convex/{http,visits,narrative,context,impact,donations,tokens}.ts`; `convex/milestones.ts` (first 80 lines); `convex/schema.ts` (tables/indexes); `convex/_generated/ai/guidelines.md` (first 250 of 286 lines); `engine/{donor-view,config,template}.ts`; `engine/guard.ts` (header + exports); `engine/facts.ts` (header); `engine/prompt.ts` (nextStep lines); `seed/data.ts` (siteUrl lines); `scripts/build-site.mjs` (hosts lines); `docs/handoff/revnn.md` (last 30 lines); `PRODUCT.md`; `.impeccable/critique/test-hosts-2026-10-24.md`.
Not verified: View Transitions support in Firefox/Safari versions at the venue; `crypto.subtle` inside Convex queries (only matters for the cut subscription path); `convex/browser` bundle size; browser preflight cache caps; whether Vercel's CDN caches `layer.js`; all effort estimates; Brindlecote's CSS and other pages in detail; `engine/milestones.ts`, `engine/narrative-run.ts`, `convex/allocations.ts`, `convex/ops.ts` (not opened).
