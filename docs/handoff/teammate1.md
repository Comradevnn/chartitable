# Handoff: Teammate 1 (Lane B: dashboard + demo sites)

Last updated: Sat Oct 24, evening PT (dashboard v2) (Teammate 1's Claude Code session, Opus orchestrator; update when you resume). Update this file whenever you stop or switch tools (Figma ↔ Cursor ↔ Claude Code). Team-wide status lives in `PROGRESS.md`.
> Dashboard launch steps: [docs/handoff/dashboard-launch.md](dashboard-launch.md)

## Status (Sat): TEAMMATE_NEXT_PROMPT items done and merged or committed: ct-slots.css fitted and bundled into layer.js, Figma at link in docs/DASHBOARD_SPEC.md, dashboard MVP + donor detail, T21 /frontend rename (649bbe4), dashboard adapter (d0ef8a2). Waiting on Revnn: T22 DEV ?ct= link, dashboard:donorDetail / removeExpense / restoreExpense (T19), deploy of /dashboard

**`docs/handoff/teammate1-session-handoff.md` is the older (Sat morning) session handoff: good background for T22 and the dashboard MVP, but this file is the current one. Read the "Dashboard v2" section right below first.**

## Dashboard v2 (Sat evening, branch `dashboard`, commits a162011..860b107, pushed and merged to main (0a62e9b), not yet deployed by Vercel (D16))
Checked in demo mode (1280 and 390) plus build, root tests, both tsc projects and the detector. **Not verified live**: the new features need Lane A's functions (Blockers row "Lane B dashboard v2" in PROGRESS.md), and the lead has not yet signed in with the real PIN to check the existing live features and receipt upload.

**New controls and where they live**
- Donors (`dashboard/src/Donors.tsx`): per-row "Send thank-you" opens the one-donor dialog; "Thank everyone who needs it (N)" opens the bulk dialog; "Mark thanked" (no email) stays. Both dialogs are in `dashboard/src/ThankYouDialog.tsx` (native modal `<dialog>`, focus returns to the opener). The one-donor dialog shows the draft (address always hidden), an optional staff note (max 500 chars, sent as `body`), and a plain reason for every outcome; the bulk dialog sends one at a time, can be stopped, and lists each donor's result.
- Donor detail panel: gift history + "what this donor sees" preview, with loading, error and "Try again" states (live: `dashboard:donorDetail`; never mock content in live mode).
- Expenses (`dashboard/src/Expenses.tsx`): optional receipt photo (JPEG, PNG, WebP, HEIC, up to 5 MB; checks in `receipt.ts`), a "Receipt" link in the ledger's category cell, and Remove / Undo per row.
- Header (`App.tsx`): "Refresh" re-probes the backend and re-reads every screen; the data-mode badge is Live / Demo / Sample-data fallback.
- All data access stays in `dashboard/src/data.ts` (adapters, capability probe, error text); `dashboard/src/mock/data.ts` is the demo source (`overviewFor(ledger)` makes the demo Overview follow the in-memory ledger).

**Capability probe (live mode only)**: after sign-in and on Refresh, `data.ts` calls `removeExpense`, `donorDetail`, `previewThankYou` and `sendThankYou` with `{pin, charityId}` and no `id` / `donorId`. An argument-validation error means "deployed, nothing ran"; "Could not find public function" means missing. `restoreExpense` is assumed to ship with `removeExpense`. So Lane A must keep `id` / `donorId` REQUIRED in those validators, or the probe would execute for real (noted in the Blockers row). Exact reason strings the UI shows:
- Backend function missing: `Needs a backend update that isn't deployed yet.` (the control is disabled, or Remove/Undo hidden, not dead)
- Live data failed and sample data stands in: `Showing sample data because live data didn't load. Refresh to try again.` (every write control is off; writes throw instead of faking success)
- Demo mode (no `VITE_CONVEX_URL`) has every capability, in memory: add / remove / undo change the ledger and the Overview, "Send thank-you" runs the flow but reports "Demo mode: no email is sent." and never changes `thankedAt`.

**Demo-only vs live-ready**: live-ready (written to the contract, unverified against a real backend): thank-you preview/send, donor detail, Remove/Undo, receipt upload (`generateReceiptUploadUrl` -> POST -> `receiptStorageId`), Refresh and the fallback guards. Demo-only: the receipt "photo" is a local object URL; thank-you never sends. All user-visible error and reason text passes through `hideEmails`.

**Known gaps**
- Live is unverified end to end (see above); `sendThankYou`'s `body?` as the staff note is Lane A to confirm.
- A HEIC receipt can't be previewed in most browsers: the chosen-file row shows the file name instead of a thumbnail.
- At 390px the Donors "Thanked" column wraps (two buttons stack).
- Remove is hidden (not disabled) when the backend lacks `removeExpense`: intentional, the brief says to show it only when supported.
- `npm run typecheck` fails under cmd.exe because of `ls convex/*.ts`. Run the two commands in Git Bash: `npx tsc --noEmit -p tsconfig.json` and `npx tsc --noEmit -p convex/tsconfig.json`.
- Root `npm test`: 403 pass; the 6 layer errors are `happy-dom` not installed (pre-existing; `npm i -D happy-dom` if you need them green).
- Checks to rerun: `cd dashboard && npm run build`; `npx impeccable detect --json dashboard/src` (expect `[]`); dev server `cd dashboard && npm run dev` (port 5175, no `.env.local` needed for demo mode).

## State (Sat afternoon): landing + dashboard live mode
- **Landing** (`landing/`, served at `/` by Lane A's `scripts/build-site.mjs`): static HTML/CSS/JS, self-hosted Barlow Condensed + Commissioner (OFL texts in `landing/fonts/`), no external requests. Impeccable direction "Stockroom Labels" (contract `.impeccable/surfaces/landing-index-html.md`; design system recorded in `DESIGN.md` + `.impeccable/design.json`). Sections: hero, the idea in one picture (stranger vs returning donor), live demo (`/staff/demo` as text, no PIN), 3 steps + embed snippet with Copy, honesty rule + guard visual, dashboard teaser, footer (fictional/test-mode notice). Finish review round 3: disposition ship (R1–R3 fixed: phone hero shows only the donor capture, step measures sit under each h3, the 1280x800 step rail fits above the fold). Detector ignores (confirmed in rendered tiles): `cramped-padding` and `tight-leading` on `landing/index.html`.
- **Dashboard live mode** (ec23e08): mode badge "Live data · Convex" / "Demo data"; falls back to sample data with the badge if the backend fails; no emails shown; `hideFromTopDonors` → "Anonymous donor". Built at `/dashboard/` with `VITE_CONVEX_URL` by the site build.
- **How to view:** `python -m http.server 5600 --bind 127.0.0.1 --directory landing` → http://127.0.0.1:5600/. Dashboard: `cd dashboard && npm run build && npx vite preview --port 5590` (no `.env` → Demo data, any PIN). QA shots in `docs/qa/` (landing-desktop-first, landing-1280, landing-mobile-1, dashboard-overview, dashboard-overview-mobile).
- **Open items:** (1) live dashboard check with the real staff PIN not done (Teammate 1 types it in the browser pane; never in chat): real sign-in, wrong PIN and live mutation errors are unverified. (2) The landing's donor capture is Lane A's variant-harness fixture ("Mira", about 22 meals), not live Convex data. (3) T22 DEV live check still blocked on Revnn. (4) T10/T11 rows in PROGRESS.md are stale (superseded by the Cinderwell and Brindlecote hosts); ask Teammate 1 before editing. (5) Landing polish not done: `.legend` wraps under the dot at 390; `.dark ::selection` uses the reserved orange; the dashboard teaser image is unreadable at 390 (caption carries it). (6) Deploy needs Revnn to merge the `dashboard` PR and push an owner commit (D16).

## State this session (Sat)
- Branch `dashboard` now carries two commits that are NOT pushed: 649bbe4 (T21: /frontend renamed to "Sorrel Street Pantry", address "212 Sorrel Street, side door") and d0ef8a2 (dashboard adapter, below). The /frontend redesign is committed (9e120e1) and merged to main via PR #1 (0693ce7); the `docs/design/ct-slots.css` specificity work is committed (956eec5) and on main. The PRODUCT.md rewrite (whole-product scope) is still parked in `git stash` ("PRODUCT.md impeccable init (from b/product-md)"); restore it with `git stash pop` on branch `b/product-md`.
- What changed in `/frontend`: (1) index: log-strip hero, labeled Get food block (hours/where/what to bring/call) before the give path, ledger table with source + as-of, at most 3 donate calls. (2) dashboard: letter + ledger, legend folded into first use, worked share sentence, staff note as signed pull quote, one quiet give link, milestone bar removed. (3) admin: ruled worklist, dignity labels (Quiet lately / Gave before), default sort by total given, sortable status/thank-you, auto-size draft, prev/next in drawer, persistent batch status. (4) Contract v1 and honesty labels intact; numbers unchanged.
- Dashboard adapter (d0ef8a2, `dashboard/src/data.ts`): uses Convex (`ConvexHttpClient` + `anyApi`) only when `VITE_CONVEX_URL` is set; then overview, donors, expenses, addExpense, markThanked are called with `{ pin, charityId }` (`VITE_CHARITY_ID`, default `demo-pantry-a`); sign-in verifies the PIN via `dashboard:overview`; the PIN lives in module memory only. With the env var unset it is the unchanged mock, which is the demo default. `donorDetail`, `removeExpense`, `restoreExpense` have no backend yet and stay mock (real mode: Remove is a no-op, donor detail returns null). Checks: `npm run build` passes, `impeccable detect dashboard/src` = [], Haiku secret scan clean.
- Known gaps in real mode (components untouched): the sign-in copy in `App.tsx` ("This demo accepts any PIN") is inaccurate; a wrong PIN and a backend outage show the same message; Donors/Expenses do not catch rejected mutations.
- T21 is done for Lane B: `/frontend` is Sorrel Street Pantry (web check: no real org by that name). Contract v2 is acknowledged: no change needed to `/frontend` or `/dashboard`; `demo-sites/hosts/**` is Lane A's (D19).
- T22 is blocked on Revnn: `ct-slots.css` is bundled in `layer.js` (`layer/src/layer.ts:3`) and the stub check passed at 1280/390 against the Figma frames (390-only), but the DEV live check has not run: Teammate 1 has no Convex login and received no minted `?ct=` link (Blockers row in PROGRESS.md).
- New tokens/fonts: self-hosted Besley + Commissioner (OFL) in `frontend/fonts/`; cream removed; one `--give` accent for give actions only; estimate amber reserved for the honesty grammar; radius 3px/0; no shadows except overlays; crate illustration removed.
- Where things live: research in `docs/research/charity-sites-2026-10-24.md` (7 sites, 10 principles); Impeccable critique 27/40 in `.impeccable/critique/`.
- How to view: open `frontend/*.html` by double-click, or run `python -m http.server 5590` in `frontend/` (the built-in browser pane shows file:// without CSS/JS).
- Rerun the stub check: `npm run build:smoke -w layer`; serve `layer/dist/layer.smoke.js` as `layer.js` on 5174 with CORS (python with Access-Control-Allow-Origin, or `npm run dev:stub -w layer`); `node layer/test/smoke-server.mjs` (5198); serve `demo-sites/test-hosts/warm-pantry` on 5501 and `regional-bank` on 5502 (`python -m http.server`); open `http://localhost:5501/?ct=demo`. Any token other than slow/junk/bad/hostile returns the rich sample.
- Run the DEV check once a link exists: `npm run build -w layer` (DEV API base baked in), serve dist on 5174, open the test host with `?ct=<token>` from a link minted on DEV by Revnn (`npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'`, and donor_a02 / demo-pantry-b). Never paste tokens into chat, logs or commits.
- Open items: push `dashboard` (649bbe4, d0ef8a2) when Revnn/Teammate 1 say so; the hosts refinement is Lane A's (Blockers row); re-check that the logo does not truncate at 390px under the new name (it truncated as "Tansy Street Pa..." before); the detector ignore for flat-type-hierarchy on `frontend/index.html` is a false positive (font shorthand with var()/clamp()); T22 DEV check still pending a minted link; next if time: Overview hierarchy + donor search in `/dashboard`.

## Start here (new, Sat ~4 AM PT)
Your next prompt is **`docs/TEAMMATE_NEXT_PROMPT.md`**. Priority 1: design the returning-donor experience (T22) and deliver `docs/design/ct-slots.css`. Priority 2: dashboard MVP (T18). Leave the four Cursor test hosts alone (fixtures, D14). Demo names were replaced (T21): `/frontend` was renamed from "Tansy Street Pantry" (flagged as near-identical to a real business name) to "Sorrel Street Pantry" (now Sorrel Street Pantry, 649bbe4; web check found no real org by that name). Vercel shows your pushes as Blocked (expected, see below); tell Revnn when you want a deploy.

## Where things stand (older notes below)
- Not started on the dashboard yet. Spec is in `docs/DASHBOARD_SPEC.md`; your one starting prompt is `docs/TEAMMATE_DASHBOARD_PROMPT.md`.
- Demo sites T10/T11 (fictional pantries `demo-pantry-a`, `demo-pantry-b`) follow integration contract v1 in PROGRESS.md. Visual directions and homepage order are in `docs/demo-site-reference.md`.

## Already pushed
- `/frontend/index.html`, `dashboard.html`, `admin.html` (static, no backend calls yet; the demo charity is the fictional "Sorrel Street Pantry" (renamed from Tansy Street Pantry, 649bbe4), defined only in `frontend/demo-data.js`; live-name check per D5 done, no real org found). Decide whether it becomes the base of `/dashboard` or stays as the donor-facing/demo pages. Name already checked against a live search (D5).

## State of `frontend/` (merged to main, PR #1)
Plain HTML/CSS/JS, no build step, works by double-clicking (file://). Fictional pantry; the name is the demo charity "Sorrel Street Pantry" (was Tansy Street Pantry), kept separate from the product name Chartitable.
- `index.html` pantry home (toggle first-time visitor vs returning donor), `dashboard.html` donor impact page, `admin.html` staff donor list (search, filter, sort, drawer, single and batch send, Reset demo).
- `shared.css` (tokens on `:root`, base, buttons, record/estimate styles, demo bar), `shared.js` (`window.CT`: `allocate`, `donorResult`, `roundEstimate`, tooltips, `initDemoPath`), `demo-data.js` (`window.DEMO_DATA`, the single fictional dataset).
- Fonts: Hanken Grotesk loads without blocking render; if Google Fonts is unreachable the system-font stack in `--font` is used.

### Where to swap in real data
- `window.DEMO_DATA` in `demo-data.js`, marked "DEMO DATA (fictional) — swap for Convex query".
- `load()` and `buildModel()` in `index.html` and `admin.html` (`load()` returns the raw data, `buildModel()` derives what the page shows; only `load()` should need to change).
- `getDonorView()` in `dashboard.html` (stands in for the donor-view query; the `?ct=` token maps to a donor there).
- Estimates must keep coming from `CT.allocate()` / `CT.donorResult()` so the home page and impact page cannot disagree.

### Demo path
A small bar on each page (hidden when the real layer script is present) walks the pitch story: 1 first-time home (`index.html?view=stranger`), 2 returning-donor home (`index.html?ct=<opaque demo token>`, token stripped from the address bar), 3 impact page, 4 staff view. It shows "step N of 4" and a Next link; step 4 offers Start over. Relative links only, no names or emails in URLs. `admin.html` also has "Reset demo", which clears sent flags, search, filter, sort, any open drawer and the preview-state choice, then re-runs `boot()` (load, buildModel, render) without a reload.

### Open items
- Cream `--bg` (#f6f5ef) is still a pending decision for the user; it was not changed.
- The demo charity name is now "Sorrel Street Pantry" (renamed from Tansy Street Pantry in 649bbe4; live search found no real org, D5). Resolved.
- Lane A's seed name "Larkspur Lane Pantry" (`seed/data.ts`) matches a real pantry and should be renamed by the lead (Lane A owns `/seed`). Resolved: seed renamed to Cinderwell Pantry (T21, Lane A).
- Nothing here was browser-tested in the last pass (no-testing instruction): open all three pages and walk the demo path once, including 375px width.

## Next, in order
1. Clone, create branch `dashboard`, read CLAUDE.md, PROGRESS.md, the dashboard spec, `docs/demo-site-reference.md`.
2. `npx impeccable install` then `/impeccable init`.
3. Figma: MVP screens M1 Overview, M2 Donors, M3 Expenses, with empty and sparse states. Put the Figma link in the spec.
4. Build in `/dashboard` on mock data behind `dashboard/src/data.ts`.
5. Demo sites: slots must be empty by default and the site must look complete without them.

## Resume commands
```bash
git fetch && git checkout dashboard && git pull --rebase origin main
```

## Gotchas
- Do not edit `/convex`, `/engine`, `/layer`, `/staff/update*`. Add a row to PROGRESS.md Blockers instead.
- Names, photos and logos must be fictional and not resemble real orgs. Check placeholder names (e.g. Juniper Row, Northmere) against a live search first.
- Every computed number must say "estimate" or "about".

## Open questions
- Which Figma track to target (criteria unseen).
- Own neutral dashboard chrome vs the charity's palette.

## Vercel deploys (read this if your push shows "Blocked")
The Vercel project belongs to Revnn's Hobby account. Hobby blocks any deployment whose commit author isn't the owner, so **your commits show "Blocked" in Vercel; that is expected, not a bug in your code.** Your pages are published at https://chartitable.vercel.app/app/ (built from `/frontend`).
- To get your latest work live: push to `main` (or tell Revnn), and Revnn pushes any commit authored by Revnn on top (even `git commit --allow-empty -m "Redeploy"`). The deploy builds the whole tree, including your files.
- To preview your own work before that: open `frontend/index.html` locally, or `python3 -m http.server 5180 --directory frontend`.
- Alternative: import the repo into **your own** Vercel account with Root Directory `frontend` (your commits are yours there). Needs collaborator access to the private repo.
