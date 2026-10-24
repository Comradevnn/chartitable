# Brief for Teammate 1 (Lane B): contract v2, new hosts, Impeccable

Paste the block below into the Teammate 1 session after `git pull` on `main` (26b3743 or later).

```text
You are Teammate 1's session (Lane B: dashboard and demo sites). Before doing anything else, run `git pull` on `main` (latest is 26b3743 or later), then read CLAUDE.md, your handoff doc docs/handoff/teammate1.md, and the last ~25 lines of PROGRESS.md. This message brings you up to speed on changes Lane A (Revnn) made today that touch your territory. Nothing here asks you to start work until you've read and confirmed it back to me. Summarize what you understood in 5 bullets and list anything that conflicts with what you were doing.

## What changed, in plain terms
The old test hosts (demo-sites/test-hosts/: Cinderwell, Brindlecote, Quillon, Wrenfield) were built around the donor layer (itemized $35 receipts, "this test site..." disclaimers, copy aimed at the layer) and looked nothing like real charity sites, so they couldn't demonstrate the product. We replaced them for testing purposes with two ordinary-looking fictional charity sites that follow the structure of a real small-charity site (centered logo header, photo-led hero with a pull quote, a three-up tile row with a stat, donate band, news, big footer). A first-time visitor sees nothing layer-related.

- New hosts: `demo-sites/hosts/cinderwell` (charity `demo-pantry-a`, port 5521) and `demo-sites/hosts/brindlecote` (charity `demo-pantry-b`, port 5522). Serve with: `python3 -m http.server 5521 --directory demo-sites/hosts/cinderwell`. Both have NOTES.md. Each has index, donate, about, and a get-food/get-help page, SVG art only, and no CDN.
- `demo-sites/test-hosts/` is untouched. Don't delete it yet. Treat it as legacy fixtures until Revnn decides.
- Note for your lane: I (Lane A's session) created files under /demo-sites, which is your territory, at the lead's request. Please review them and tell us if the structure or the ownership should change. I did not edit `docs/DASHBOARD_SPEC.md`, `/dashboard`, or `/frontend`.

## Integration contract v2 (PROTOTYPE, additive to v1; v1 still works)
Goal from the lead: the personalization must make the site look redesigned for the donor, not a banner insertion. So the host now authors the returning-donor versions, and the layer swaps them in.
- Host marks `[data-impact-region="NAME"]` with default markup (what strangers see) and writes `<template data-impact-for="NAME">` in the site's own components/classes.
- For a recognized donor the layer swaps each region to its template and fills it by textContent only. Fill hooks: `data-ct-text="firstName|story|nextText|sinceDate"`; `data-ct-href="nextHref"`; `data-ct-if="records|estimates|since|next|photos|firstName"`; repeaters `data-ct-each="records|estimates|sinceRecords|sinceEstimates"` with optional `data-ct-limit`; inside a record clone `data-ct-text="date|count|unit|record|note"`, inside an estimate clone `data-ct-text="estimate"` (the layer always writes "about N unit", so a template cannot drop the label), `img[data-ct-photo]` for record photos.
- `data-impact-requires="since|next|records|estimates|photos|firstName"` on a region skips the swap when that fact is absent.
- The layer sets `html[data-impact-active]` and `data-impact-state="ready"` on swapped regions, so host CSS can re-compose the whole page (`html[data-impact-active] main { display:flex; flex-direction:column } ...`) without affecting strangers.
- Engine: `layer/src/layer.ts` (functions paintRegions, fillNode, fillFact). Read-only for you; Lane A owns it. The only proven example is `demo-sites/hosts/cinderwell/index.html` + `styles.css` + NOTES.md ("Contract v2 usage"). Brindlecote is NOT converted yet.
- Rules unchanged: records and estimates stay visually separate; estimates always say "about"/"estimate"; no guilt copy; if data is missing say less; first-time visitors get the unmodified site. Estimates may only come from the estimate field, never be hard-coded in a template. Every number in a template comes from a data-ct field.
- Known gaps (Lane A will fix or plan): no short next-step label field; `nextStep.href` is null for the demo donor so the next-step button vanishes; no OR logic for "show only if story or records"; no `data-ct-if` for sinceDate; the story text repeats the headline ("Thank you, Mira,"); seed photos are placeholders; no tests for v2 yet; the layer's `.ct-next-link` is 42px tall (<44).
- Do not change contract names or semantics. If you need something, add a PROGRESS.md Blocker.

## Also new
- Impeccable is now installed for Claude Code in this repo: `.claude/skills/impeccable/` (v4.7.0) and `.claude/agents/`. The design hook flags UI files after edits (the engine binary is gitignored: if the hook can't find it, run `npx impeccable install --providers=claude --project --yes`). Config in `.impeccable/config.json` (buildPath: code; two narrow ignores). A critique snapshot is at `.impeccable/critique/test-hosts-2026-10-24.md`.
- `design-samples/` (three Cinderwell redesigns: bulletin, ledger, signage) are exploration only, not on the demo path. The critique findings that shaped them are in the snapshot above.

## How to test the real flow (don't commit tokens)
1. Layer: `npm run build` then serve `layer/dist` on port 5174 with CORS (esbuild's `npm run dev:layer` exits when stdin closes; a small python http.server with an `Access-Control-Allow-Origin: *` handler works).
2. Mint a token against the Convex DEV deployment only (acoustic-donkey-399): `npx convex run tokens:issue '{"donorId":"donor_a01","charityId":"demo-pantry-a"}'`. Open `http://localhost:5521/?ct=<token>`. The layer removes the token from the URL and stores it under `chartitable:demo-pantry-a`. `localStorage.clear()` and reload to see the first-time view. Never paste tokens or keys into chat, logs or commits.
3. `?preview=1` is the old dev harness (fake data, not the real layer). Use the real flow when judging the look.

## What I'd likely ask you to do next (do NOT start until the lead confirms)
- Review the two new hosts for structure and honesty (nothing mentions the layer, estimates labeled, fictional only).
- Convert `brindlecote` to contract v2 following Cinderwell's pattern, with a different personal tone and different region choices, keeping the plain site identical for strangers.
- Make sure `docs/design/ct-slots.css` and the v2 templates don't fight each other, and that records vs estimates remain visually distinct in both.
- Resume the dashboard (T18) work you had in flight, and apply the same "make it look real, not layer-shaped" lens if it applies.

Confirm back with your 5-bullet summary, any conflicts, and the first thing you'd do. Log nothing to PROGRESS.md until the lead approves your plan.
```
