# Cursor prompt: test charity sites (task T20)

Use: open the repo in Cursor, set the model as below, paste everything under the line as your first message. Owner: Revnn/Cursor. Writes only to `/demo-sites/test-hosts/`, `docs/cursor-shots/` and `docs/cursor-grok-log.md`.

## Model and settings (Cursor docs, checked Sat Oct 24 ~2:30 AM PT)
Third-party models (Claude, GPT, Gemini) bill at API price from prepaid credit on Premium. Cursor's own models are covered by the weekly pool: **Grok 4.7, Grok 4.6, Grok 4.5, Composer 2.5**.
- **Main model: Grok 4.7**, Fast **off**, effort **high** if the picker offers it (medium if you are short on pool). Default 256k context is enough; do not pick the 500k variant (2x the cost, no need). Fast mode doubles the cost and isn't needed.
- **Cheaper model for mechanical steps: Composer 2.5** (Fast off): README, port table, repetitive per-site edits, screenshots notes, log entries. Switch back to Grok 4.7 for `shape`, `craft`, `critique` and anything visual.
- Mode: **Agent**. Start a new chat per site (fresh context beats a long thread); each chat re-reads `CLAUDE.md`, the contract and `PRODUCT.md`.
- Using Grok models in Cursor also strengthens the SpaceXSI "built with Cursor" evidence: record the model names in `docs/cursor-grok-log.md`.
- Grok and Composer follow long multi-part prompts less reliably than Opus, so the prompt below is split into stages with checkpoints. Do not skip them.

---

You are Cursor's agent (a Grok or Composer model, not Claude). You are building **test host websites** for Chartitable at Cal Hacks 13.0 (Devpost deadline Sun Oct 25, 9:00 AM PT). These are fictional small-charity sites used to test and demo a script-tag personalization layer before the real demo sites are finished. You work in Cursor; keep going autonomously and report at the end.

## Read first (and nothing else you don't need)
1. `CLAUDE.md` (rules and read map), then `PROGRESS.md` sections: Snapshot, **Integration contract v1** (exact markup you must support), Blockers, last ~20 Handoff log lines.
2. `docs/demo-site-reference.md` (homepage structure, honest-language patterns, two visual directions) and `docs/PRODUCT_SPEC.md` §13 (how `layer.js` behaves).
3. `engine/types.ts` only for the shape `DonorView` (sample data below mirrors it). Do not read or edit `/convex`, `/engine`, `/layer`, `/staff`, `/dashboard`, `/frontend`, or the other `/demo-sites/*` folders.

## Step 1: initialise Impeccable
From the repo root: `npx impeccable install --providers=cursor --scope=project`, then reload Cursor. If `/impeccable` is not recognized, Impeccable's README says Cursor skills may need Settings → Beta → Nightly channel and Settings → Rules → Enable Agent Skills; do that, reload, and retry. Then run `/impeccable init`. Answer from this context: product = fictional small-charity websites that host a donor-personalization layer; audience = local donors, volunteers and neighbors seeking food (trust and warmth, plain language, accessible); constraint = fictional only, honest labels, static HTML/CSS/JS with no build step; voice = neighborly, specific, never guilt-based. Let it write `PRODUCT.md` (and `DESIGN.md` later via `/impeccable document`). Then use `/impeccable shape` per site before `craft`, and `critique`, `audit`, `harden`, `polish` on each before finishing. Heed its anti-pattern list (no generic AI-template look).

## Step 2: build 4 distinct test charity sites in `/demo-sites/test-hosts/`
Static HTML/CSS/vanilla JS, no framework, no build step, each in its own folder with its own `index.html` (and a second page like `about.html` or `programs.html` so navigation feels real). All fully **fictional**: invented name, address, phone, EIN-free, no real logos, no real photos. Before using a name, web-search it and pick another if it resembles a real organization (D5). Do not copy markup, copy or images from real sites; use `docs/demo-site-reference.md` for structure only. Images: generate SVG illustrations or CSS shapes or simple gradient scenes in the repo; no downloaded stock photos.

| Folder | Charity id (`data-charity`) | Look and feel | Port |
|---|---|---|---|
| `warm-pantry` | `demo-pantry-a` | Warm community pantry: cream + terracotta, serif headings, schedule near top, volunteer quote, "$35 = one family's meal" itemized block | 5501 |
| `regional-bank` | `demo-pantry-b` | Clean regional food bank: white + deep slate-blue + one accent, grid, stat row with dates and sources in small print, "where your gift goes" bar, Donate and Donate Monthly in header | 5502 |
| `volunteer-run` | `demo-pantry-a` | Minimal volunteer-run pantry that looks like a simple WordPress/Squarespace site: plain header, single-column text, small hero, a basic donate button; deliberately modest and slightly dated | 5503 |
| `church-community` | `demo-pantry-b` | Community-center style with events calendar and news cards, bolder color, more cluttered header with a pop-up-style appeal banner (tests that slots survive busy pages) | 5504 |

(Only two charity ids exist; hosts 3 and 4 reuse them to test different layouts against the same data.)

### Every site must satisfy integration contract v1 exactly
```html
<script src="http://localhost:5174/layer.js" data-charity="<id>" defer></script>
<section data-impact-slot="hero"></section>
<section data-impact-slot="since-last-visit"></section>
<section data-impact-slot="next-step"></section>
<a data-impact-donate href="#donate">Donate</a>
```
- Put the three empty slots in sensible places per `docs/demo-site-reference.md` ("Where Chartitable slots fit"): hero right under the header, since-last-visit below the impact stat row, next-step above the newsletter/footer. Leave them **completely empty** in the HTML.
- Add `[data-impact-slot]:empty { display: none; }` in each site's CSS.
- Each site must look **complete and polished with the slots empty** (that is what first-time visitors see).
- Each site defines theming variables on `:root`: `--ct-accent`, `--ct-fg`, `--ct-bg`, `--ct-muted`, `--ct-font`, `--ct-radius`, matched to that site's palette. Optionally style `html[data-impact-active]` (e.g., shrink the generic hero) and `[data-impact-state="ready"]`.
- Existing impact numbers on the site (e.g., "$35 provides one family's meal") must be honest: specific, itemized, with a period, and never "up to N" without a basis. Any figure not backed by the site's own stated basis gets a small "estimate" or "about" label. Made-up statistics must be plausible, clearly fictional, and dated.
- Accessible: semantic landmarks, labels, contrast, keyboard focus, `prefers-reduced-motion`. Responsive at 1280, 768 and 390 px.

## Step 3: dev-only preview harness (so layouts can be tested before the real `layer.js` exists)
In `/demo-sites/test-hosts/_preview/`: `donor-view.sample.json` (one `DonorView` with `recognized: true`, a short story, 2 records, 2 estimates each with "about", a sinceLastVisit block, a nextStep) and `preview.js`, a tiny dev-only script that fills the slots on any test host from the sample JSON using the contract's classes (`.ct-record`, `.ct-estimate` with visible "about", `.ct-photo`), text nodes only (no `innerHTML`), sets `data-impact-state="ready"` per slot and `data-impact-active` on `<html>`, and activates only when the URL has `?preview=1`. Label it clearly as NOT the production layer. Also a mock empty-state sample. All sample people and numbers are fictional. This lets you screenshot "slots empty" vs "slots filled" for every site.

## Step 4: run, verify, document
- `README.md` in `/demo-sites/test-hosts/` with the serve commands, e.g. `python3 -m http.server 5501 --directory demo-sites/test-hosts/warm-pantry` (one per site), the preview URL pattern, and the port table.
- For each site, open it at 1280 and 390 px with and without `?preview=1`; confirm no layout break, no console errors, slots hidden when empty, filled state readable. Use Impeccable `audit` and `critique` and fix what they flag. Take screenshots into `docs/cursor-shots/` (Cursor evidence for the SpaceXSI track).
- Append notes to `docs/cursor-grok-log.md` (create if missing): date/time, what Cursor did, which Impeccable commands ran, links to the screenshots. Keep it factual.
- A Haiku or manual check: no real org names (web search each name), no secrets, no external tracking scripts or CDN trackers, no copied text.

## Working style (stages and checkpoints)
1. Stage A: install and init Impeccable. Stop and show me `PRODUCT.md` summary.
2. Stage B: build `_preview/` harness and the shared README skeleton.
3. Stage C: one site at a time, in this order: `warm-pantry`, `regional-bank`, `volunteer-run`, `church-community`. For each site: re-read the contract block above, `shape`, build, run the self-check list, `critique`, `audit`, fix, commit, then log. Never start a site before the previous one passes its self-check.
Self-check list per site (answer yes/no in your commit message): contract markup exact; three slots completely empty in HTML; `:empty` hide rule present; `--ct-*` variables defined; no external scripts or trackers; no real org names (searched); no downloaded images; looks complete with `?preview` off; filled state readable with `?preview=1`; works at 390 px.
4. Stage D: final README, screenshots, `docs/cursor-grok-log.md`, update PROGRESS.md row T20, final report.

## Rules
- Fictional only (D5). No real donor data. No secrets. No personal data in URLs. Estimates always labeled.
- Edit only `/demo-sites/test-hosts/**`, `docs/cursor-shots/**`, `docs/cursor-grok-log.md`, and your own line in `PROGRESS.md` (new task row T20 status plus one Handoff log line tagged `[A]`). Do not touch other lanes' files. If you need something outside this scope, add a row to PROGRESS.md **Blockers** and carry on.
- Commit small and descriptive from Cursor on `main`, `git pull --rebase` before each push, use plain commit messages (do not add Claude attribution lines; the author is Cursor with Grok/Composer, which the log records).

## Done when
Four distinct sites run on ports 5501–5504, each complete with empty slots and correct filled with `?preview=1`, Impeccable initialised (`PRODUCT.md` present) and each site audited, README and screenshots committed, T20 marked `review`, and a final report listing the site names you chose, any Impeccable findings left unfixed, and anything blocking.
