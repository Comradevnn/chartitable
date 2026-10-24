# Handoff: Teammate 1 (Lane B: dashboard + demo sites)

Last updated: Sat Oct 24, ~2:00 AM PT. Update this file whenever you stop or switch tools (Figma ↔ Cursor ↔ Claude Code). Team-wide status lives in `PROGRESS.md`.

## Where things stand
- Not started on the dashboard yet. Spec is in `docs/DASHBOARD_SPEC.md`; your one starting prompt is `docs/TEAMMATE_DASHBOARD_PROMPT.md`.
- Demo sites T10/T11 (fictional pantries `demo-pantry-a`, `demo-pantry-b`) follow integration contract v1 in PROGRESS.md. Visual directions and homepage order are in `docs/demo-site-reference.md`.

## Already pushed
- `/frontend/index.html`, `dashboard.html`, `admin.html` (static, no backend calls yet; the demo charity is the fictional "Tansy Street Pantry", defined only in `frontend/demo-data.js`, pending the user's confirmation and a live-name check per D5). Decide whether it becomes the base of `/dashboard` or stays as the donor-facing/demo pages. Check the name against a live search (D5).

## State of `frontend/` (uncommitted on `dashboard`)
Plain HTML/CSS/JS, no build step, works by double-clicking (file://). Fictional pantry; the name is the demo charity "Tansy Street Pantry", kept separate from the product name Chartitable.
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
- The demo charity name "Tansy Street Pantry" is pending confirmation (check it against a live search, D5).
- Lane A's seed name "Larkspur Lane Pantry" (`seed/data.ts`) matches a real pantry and should be renamed by the lead (Lane A owns `/seed`).
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
