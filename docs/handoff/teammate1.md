# Handoff: Teammate 1 (Lane B: dashboard + demo sites)

Last updated: Sat Oct 24, 11:29 AM PT (Teammate 1's Claude Code session; update when you resume). Update this file whenever you stop or switch tools (Figma ↔ Cursor ↔ Claude Code). Team-wide status lives in `PROGRESS.md`.

## Status (Sat): TEAMMATE_NEXT_PROMPT items done and merged or committed: ct-slots.css fitted and bundled into layer.js, Figma at link in docs/DASHBOARD_SPEC.md, dashboard MVP + donor detail, T21 /frontend rename (649bbe4), dashboard adapter (d0ef8a2). Waiting on Revnn: T22 DEV ?ct= link, dashboard:donorDetail / removeExpense / restoreExpense (T19), deploy of /dashboard

**Newest, self-contained session handoff (Sat Oct 24): `docs/handoff/teammate1-session-handoff.md`. Read it first.**

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
