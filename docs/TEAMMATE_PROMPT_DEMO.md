# Teammate 1 prompt: startup-grade product landing + live dashboard

Setup: `git fetch && git checkout main && git pull --rebase`. Work in your own folders: `/landing` (new), `/dashboard`, `/frontend`, `docs/design/`. Paste everything under the line into Cursor or Claude Code at the repo root. Written Sat Oct 24, 12:45 PM PT. Companion: `docs/OPUS_LANE_A_PROMPT_4.md` (Lane A builds the presenter control panel and publish pipeline in parallel).

---

You are helping Teammate 1 on Chartitable at Cal Hacks 13.0 (Devpost deadline Sun Oct 25, 9:00 AM PT). Goal: the first thing a judge sees should look like a **startup demo**, and the dashboard should show **live data**. Read `CLAUDE.md` (rules, read map), the Lane B parts of `PROGRESS.md` (Snapshot, Blockers, contract v2, last ~20 `[B]` and `[ALL]` log lines), `docs/handoff/teammate1.md`, `docs/DASHBOARD_SPEC.md`, `PRODUCT.md`, `docs/design/README.md`, and `docs/research/` charity-site notes. Do not read or edit `/convex`, `/engine`, `/layer`, `/staff`, `/seed`, `demo-sites/hosts/**`. Never run `git add -A`; stage explicit paths; `git pull --rebase --autostash` before each push; small commits.

## Context (what the lead saw today)
The live host (https://chartitable.vercel.app/sites/cinderwell/ with a donor link) is genuinely good: the page rearranges around the donor, with a labeled estimate and a clear next step. But `https://chartitable.vercel.app/` is an unstyled list of links, the dashboard isn't published and runs on mock data, and nobody learns what Chartitable is. Fix those two things. Everything fictional (D5), every computed number labeled "estimate"/"about", no personal data in URLs, no real org names or copied site text.

## Task 1: product landing page in `/landing` (static HTML/CSS/vanilla JS, no build step)
Lane A's build will publish `/landing/index.html` at the site root `/` (the old link list moves to `/demo-hosts`). Build it with Impeccable (`/impeccable shape` first, then `craft`; `critique`, `audit`, `harden`, `polish` before finishing). One page, scroll story, designed (not a template look; heed Impeccable's anti-patterns):
1. **Hero:** one-line promise ("Your donors' impact, on your own website." or better) + subline for small food pantries without fundraising staff + two buttons: "See it live" (scrolls to the live demo) and "Install in one line".
2. **The idea in one picture:** e-commerce memory ("your coffee beans are here") → Chartitable for donors. A before/after of the same pantry page: stranger vs returning donor (use real screenshots of `/sites/cinderwell/` stranger vs donor view, captured from the live site, committed under `/landing/img/`; no tokens visible).
3. **Live demo block:** two iframes or large cards linking to Cinderwell and Brindlecote (`/sites/cinderwell/`, `/sites/brindlecote/`), plus a short note that the "donor view" is opened from the presenter panel at `/staff/demo` (do not link or reveal the PIN).
4. **How it works in 3 steps:** add one script tag + marked regions; staff post a one-line update (photo optional); donors see what changed. Show the actual embed snippet (copy button).
5. **The honesty rule** as a feature, not fine print: records vs estimates, the fact-check guard, "if data is thin, we say less" (a small visual of a rejected invented number falling back to a plain template).
6. **Dashboard teaser:** screenshot or live iframe of `/dashboard`.
7. **Footer:** fictional-data and test-mode notice, links to GitHub and the README (repo is private until T17: link text only, no URL), team of two.
Performance and a11y: under 300 KB total excluding screenshots, system or local fonts only (no CDN), semantic landmarks, contrast, `prefers-reduced-motion`, works at 390 px and 1280 px. No external trackers.

## Task 2: dashboard on live data (`/dashboard`)
The backend queries exist and are live on Convex dev: `dashboard:overview`, `dashboard:donors`, `dashboard:expenses`, `dashboard:addExpense`, `dashboard:markThanked` (all take a `pin` argument, see `docs/handoff/revnn.md` for the call convention and `docs/DASHBOARD_SPEC.md` "Data contract" for shapes). Keep all data access behind `dashboard/src/data.ts`: add a live adapter using the Convex HTTP API or `convex/browser`'s `ConvexHttpClient` with `VITE_CONVEX_URL` (the build sets it to `https://acoustic-donkey-399.convex.cloud`), PIN entered once at a login screen and kept in memory only (no localStorage), and a clear "Demo data" fallback badge if the backend call fails. Never show donor emails. Honor `hideFromTopDonors`. Label every computed number ("estimate" for cost per meal with its formula on hover/tap). Empty and loading states designed. Publish path: `npm run build` in `/dashboard` must output a static folder with relative base so it works at `/dashboard/` (Lane A's build copies it). Then polish Overview, Donors, Expenses with Impeccable and check at 1280 and 768.

## Process
- Work order: landing first (about 2 hours), then dashboard live adapter (about 1.5 hours), then polish both. Commit and push after each task; each push redeploys Vercel from `main` (the landing and dashboard only appear once Lane A's publish step lands; check `https://chartitable.vercel.app/` after).
- Capture before/after screenshots from the live site for the landing; never include a `?ct=` URL or a token in any screenshot or committed file.
- Append one `[B]` line to the PROGRESS.md Handoff log per finished piece and update your handoff doc. If you need something from Lane A, add a row to PROGRESS.md **Blockers**.
- Quality bar: would this make a skeptical hackathon judge say "this is a real product"? If a section doesn't earn its place, cut it.

## Done when
`/landing` complete and audited; dashboard shows live seeded data after a PIN and degrades gracefully; both build clean; screenshots in `docs/cursor-shots/` or `docs/qa/`; final report listing what shipped, what's rough, and what you'd cut.
