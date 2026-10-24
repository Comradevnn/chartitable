# Session handoff: Teammate 1 (Lane B), Sat Oct 24 2026

Paste this to a fresh Claude session as its first message: "Read `docs/handoff/teammate1-session-handoff.md`, then `CLAUDE.md` and `docs/handoff/teammate1.md`, and continue from 'What to do next'."

Deadline: Devpost submission **Sun Oct 25 2026, 9:00 AM PT (hard)**. Prefer a working narrow product over a broad broken one.

Project root (nested, not a git repo here): `C:\Users\Nael\Documents\Hackathons\Calhacks 13.0\chartitable\chartitable`

## Who and what
Teammate 1 (GitHub `naelqdl`) owns Lane B: `/frontend`, `/dashboard`, `/demo-sites`, `docs/DASHBOARD_SPEC.md`, `docs/design/`. Do not edit `/convex`, `/engine`, `/layer`, `/staff`, `/seed` (Lane A, Revnn). Need a change there? Add a row to `PROGRESS.md` Blockers and keep working against mocks. Log every stop with a `[B]` line in the PROGRESS.md Handoff log.

## What is done (all of `docs/TEAMMATE_NEXT_PROMPT.md`)
- **T22 returning-donor experience.** `docs/design/ct-slots.css` (~144 lines) styles the three slots (`data-impact-slot="hero" | "since-last-visit" | "next-step"`, keyed on `[data-impact-state="ready"]`). Zero-specificity `:where()` selectors, existing `ct-*` classes only, `--ct-accent/--ct-fg/--ct-bg/--ct-muted/--ct-font/--ct-radius` with fallbacks, no animation, no external requests; the host CSS always wins. Fitted to the real markup in `layer/src/layer.ts` and tested at 1280 on two palettes (text contrast at least 6.9:1). Includes mobile (max 480px) and `forced-colors` rules.
- **Honesty design language.** Records are a tinted block with a solid dot and bold text. Estimates are dashed, italic, muted, and always say "about"/"(estimate)". `frontend/shared.css` was aligned to match.
- **Figma:** https://www.figma.com/design/jnGjgMPjBGua3ycFOzjQUg (file key `jnGjgMPjBGua3ycFOzjQUg`). Page "Returning donor" has 6 frames (warm pantry and regional bank, each with thin, rich and empty states). Page "Staff dashboard" has M1 Overview, M2 Donors with detail, M3 Expenses. Linked in `docs/DASHBOARD_SPEC.md`.
- **T18 staff dashboard MVP** in `dashboard/` (Vite 7, React 19, TypeScript, standalone `package.json`, not in root workspaces). All data goes through `dashboard/src/data.ts`; the mock lives in `dashboard/src/mock/data.ts` (8 fictional donors, 7 expenses, NOW = Oct 24 2026). The mock accepts any non-empty PIN, held in memory only.
  - Overview: "needs attention" row, 4 tiles (Raised, Donors 2 new · 5 returning · 1 gave before, Meals served, Cost per meal estimate with formula toggle), latest updates.
  - Donors: "Needs a thank-you (N)" filter, sort chips, "Mark thanked" per row, labels New / Active / Quiet lately / Gave before, anonymous donors distinguishable by first-gift date, detail panel (gift history plus "what this donor sees" preview) with Close and Esc, focus restored.
  - Expenses: add form with strict amount parsing (`$1,200` ok; `0.004`, `12abc`, empty, `0`, future dates rejected with specific inline errors), remove with Undo, period label.
- **Formal Impeccable critique** (dual-agent) scored the dashboard 24/40. Its 3 P1 and 2 P2 issues are fixed. Snapshot: `.impeccable/critique/2026-10-24T10-27-09Z__dashboard-src.md`.
- **Checks last run:** `npm run build` in `dashboard/` passes; `impeccable detect --json dashboard/src` returns `[]`; verified in the browser at desktop and 390px (tables fit, no sideways scroll). All dev ports (5175, 5190, 8400) are closed.

## What is not done / waiting on Revnn
1. Bundle `docs/design/ct-slots.css` into `layer.js` (it currently injects `FALLBACK_STYLES`). **T22 stays `review` until a live check after that.**
2. Wire `/dashboard` into `scripts/build-site.mjs` and deploy. Vercel Hobby blocks teammate-authored deploys (D16); Revnn ships.
3. Confirm demo names (T21). "Tansy Street Pantry" is flagged as near-identical to a real business; "Larkspur Lane Pantry" (Lane A seed) matches a real pantry. Don't ship either until Revnn confirms.
4. Convex queries the dashboard needs (listed in the PROGRESS.md Blockers row): `dashboard:markThanked(pin, donorId)`, `dashboard:removeExpense` / `restoreExpense`, `dashboard:donorDetail(pin, donorId)`. Then swap the mock adapter for Convex using the staff PIN (never commit it). Receipt photos on expenses are also not built.

## Open design items (deliberately left alone)
- Cream background `#f6f5ef`: the detector flags it; a lead decision is pending (also used in `/frontend`). Don't change it unasked.
- Pantry warmth/character, donor search and sortable headers, a period selector, stronger Overview hierarchy.
- Striped progress fill in `frontend/dashboard.html` is the intentional estimate hatch.
- The Impeccable overlay never rendered (live-server truncates `detect.js` on Windows); the URL scan and manual measurements stood in.
- 1280px check on demo hosts 3 and 4 not done. Leave the four Cursor test hosts alone (fixtures, D14).

## What to do next (in order)
1. Read `CLAUDE.md`, `docs/handoff/teammate1.md`, and the `PROGRESS.md` parts it names (Snapshot, Blockers, contract, Decisions, Lane B rows, last ~20 log lines). Check whether Revnn has landed the layer.js bundle, the T21 names, or the Convex queries.
2. If `layer.js` now includes `ct-slots.css`: open a demo host with a `?ct=` token at 1280 and 390, check the three slots against the Figma frames, then set T22 to `done`.
3. If the Convex queries exist: replace the bodies in `dashboard/src/data.ts` only (components should not change); keep the mock as fallback for the demo.
4. Otherwise pick from the open design items; the highest value for judges is Overview hierarchy and donor search. Run `impeccable critique` again afterward and save the snapshot.
5. Before stopping: update `docs/handoff/teammate1.md` and append a `[B]` line to PROGRESS.md.

## Resume commands
```bash
cd dashboard && npm install && npm run dev        # http://localhost:5175
python -m http.server 5190                        # from the repo root: static preview of /frontend, /demo-sites, /docs/design
cd dashboard && npm run build                     # tsc --noEmit && vite build
npx impeccable detect --json dashboard/src        # design detector, expect []
```
Stop the servers when done (target only your own processes; Get-NetTCPConnection on 5175 and 5190).

## Gotchas learned this session
- Real layer markup: `p.ct-story`; `h2.ct-heading`; `ul.ct-facts` > `li.ct-record` (text "date · count unit", optional `span.ct-note`, `img.ct-photo`); `li.ct-estimate`; `p.ct-disclaimer`; `h2.ct-since-heading`; `p.ct-next`; `a.ct-next-link`. Style these, not the preview harness's guesses.
- Host CSS overrides absolute-positioned decoration; the record dot is an inline-block `::before` for that reason. Impeccable bans side-tab and top-accent borders.
- In `demo-sites/test-hosts/*`, `donor-view.sample.json` and `preview.js` are pointer files; the real ones are in `/demo-sites/test-hosts/_preview/`.
- The browser may serve a stale cached `shared.css`; verify with computed styles after a fresh navigation.
- Long multi-file bash heredocs failed on this machine; use the Write tool. PowerShell chains that mix stopping vite with appending to files were rejected; do them as separate calls.
- Copy rules: every computed number says "estimate" or "about"; dignity labels (no "At risk"/"Lapsed" in the UI; the enum values stay in the data contract); fictional names, photos and logos only; no personal data in URLs.
- Keyboard: focus moves to `main` only after sign-in, not on tab change (the critique flagged the latter as harmful).
