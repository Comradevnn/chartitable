# Chartitable

**A personalization layer that any charity can drop onto its own website.** Online shops remember you: your last order is front and center when you return. Chartitable gives returning donors the same experience. When a donor comes back to a charity's site, the page rearranges itself around them: what their gift has done since their last visit, a thank-you, and one helpful next step. Charities also get a staff dashboard.

Built at Cal Hacks 13.0 (Oct 23–25, 2026) by a **two-person team**. Live at **https://www.chartitable.biz** (domain registered through GoDaddy, hosted on Vercel, with a Convex dev deployment behind it). Hosts and the API are also reachable at https://chartitable.vercel.app. This README describes what exists and what doesn't.

## For judges: try the staff side
Staff pages are PIN-protected. Demo PIN: **`6767`** (demo data only, test mode, no real payments).

- Charity dashboard: https://chartitable.vercel.app/dashboard/
- Demo panel: https://chartitable.vercel.app/staff/demo.html

## The problem
Picture giving $25 to a small charity. A month later you get the same website, the same photo and the same Donate button, with no sign your gift did anything. Small charities usually have no fundraising staff to write back, so donors quietly drift away.

We built for two groups at small, under-resourced charities:
- **Donors** (first-time and returning), who give modest amounts and want to know it mattered.
- **Charity staff**: a coordinator or volunteer who is short on time and needs to see, in about 30 seconds, who to thank and who has gone quiet.

## What it does
- A charity adds one `<script>` tag and a few marked regions to the site it already has. No redesign.
- Returning donors (recognized by a signed link or a token remembered in the browser) see the page adapt: hero, since-last-visit and next-step regions fill with their story, and different layouts appear depending on donor state (just gave, news since last visit, first impact, repeat, lapsed). First-time visitors see the normal site, untouched.
- The layer reuses the host site's own elements and styles and doesn't generate new graphics, so it is cheap to run and looks native.
- Staff post updates (count, unit, note, optional photo) on a staff page; donors' views update within seconds while the page is open (the layer polls, it does not use Convex subscriptions).
- A milestone email, "See where your donation has gone", links the donor back to their view (the demo sends only to team inboxes).
- A staff dashboard shows who gave, what was spent and who needs a thank-you. Staff can mark donors thanked and record expenses.

## The honesty rule
Donations are pooled, so we cannot claim a specific dollar bought a specific thing. Therefore:
- A gift is credited **proportionally** and every computed number is labeled ("about", "estimate").
- **Records** (what staff logged) and **estimates** (what we computed) are shown separately.
- Claude may only narrate facts from a payload we build. A **deterministic fact-check guard** rejects any text containing a number not backed by a fact of the same kind, a name that isn't the charity's or the donor's first name, a percentage or vague quantity, an unlabeled estimate, a link, markup, or pressure language, and falls back to a plain template. If data is thin, the template says less. The guard fails safe: it accepts the occasional false rejection to avoid any false acceptance.
- Suggested next steps are never guilt-based and are limited to four kinds: give again, give monthly, volunteer, share.

## How Claude is used
`claude-sonnet-5-5` turns a donor's structured facts into a headline, a short story and a next step, constrained to a JSON schema. The facts payload is a whitelist: no email, no donor ID and nothing about other donors. The prompt requires every estimate to be introduced with "about" and described as an estimate of a pooled share, and never to add records into a total. The guard checks every output before a donor sees it, and the first view after a data change shows the template while Claude's version is generated for the next view. Where Claude could go wrong (invented numbers, inflated impact, invented names, pressure) is exactly what the guard and the tests target.

## How we built it (honest account)
- **Two people, two lanes.** The lead built the product side (engine, Convex backend, layer, donate and staff pages, deploys). The teammate owns the dashboard and the design work (Figma first, then implementation, with Impeccable for design quality). Process, ownership and handoffs are in [CLAUDE.md](CLAUDE.md), [PROGRESS.md](PROGRESS.md) and `docs/handoff/`.
- **Claude Code** did most of the product engineering: an Opus orchestrator planning and reviewing, Sonnet subagents writing scoped code, and Haiku subagents doing read-only research, audits and secret scans. After every agent returned, the orchestrator read the diff and re-ran the tests, typecheck and build itself, and a Haiku agent checked for contract drift, secrets and personal data before committing. Everything is tracked in PROGRESS.md.
- **Cursor (running Grok 4.7)** built the donor-facing front end: the first `layer.js` embed (reads the signed `?ct=` token, stores it per charity, fills the hero, since-last-visit and next-step slots from the donor-view endpoint), the staff impact-update page and four fictional test-host sites, using Impeccable for automated design checks. The test hosts are fixtures for testing the layer, not the polished demo. Later layer work (regions, live updates, motion) came back through Claude Code. Cursor activity and screenshots are logged in `docs/cursor-grok-log.md` and `docs/cursor-shots/`.
- **Grok Bot** was used to plan the work and shape the product flow and design, including how a returning donor moves from a private link to their impact page to giving again, and to coordinate across the two lanes. It was also used to create the project's presentation slides ([deck](docs/presentation/Chartitable.pptx), pitch plan in [docs/PITCH.md](docs/PITCH.md)).
- **Figma** holds the donor-slot and dashboard designs.
- All implementation was done during the hackathon; no code was reused from earlier projects.

## Status (what works today, what doesn't)
**Works, tested, and live on the dev deployment:**
- Allocation engine, guarded Claude narrative with template fallback, signed tokens, `/donor-view` API (first view template, later views Claude), visits and "since last visit", test-mode donate page, staff update page with photos, milestone emails with an allowlist, and a health page. Engine and seed logic are covered by Vitest unit tests; `scripts/e2e-smoke.mjs` runs the donation → staff update → donor view path against the live backend.
- `layer.js` (about 8.5 KB gzipped) with conditional regions, several layouts per donor state, live polling and motion, running on the Vercel-hosted fictional charity sites.
- Staff dashboard (Overview, Donors, Expenses; a Vite + React app in `/dashboard`) with a live mode that reads from Convex (set `VITE_CONVEX_URL`) and a sample-data fallback if the backend is unavailable.

**Not done:**
- Real payments. The donate page is test mode only; a live payment processor is the next step.
- Real staff authentication (today a shared demo PIN).
- Cartesia voice (stretch) is not built. We chose not to use the Grok Voice API.
- Convex is a **development** deployment, not production.
- Live updates use polling and one-shot requests, not Convex reactive queries. Reactive queries are something we'd add next.

## What's next
- Real payments through a live payment processor, so gifts flow straight into each donor's impact record.
- Donation milestones that link across every charity a donor gives to.
- Recommendations for where to give next, based on previous donations.
- More dynamic features, starting with images that change with a donor's impact.
- Performance-based pricing: a small subscription fee that only starts once a charity's monthly giving rises more than 30% above its own average from before it adopted Chartitable. This is a plan, not built.

## Embed contract
```html
<script src="https://chartitable.vercel.app/layer.js" data-charity="<charity-id>" defer></script>
<section data-impact-slot="hero"></section>
<section data-impact-slot="since-last-visit"></section>
<section data-impact-slot="next-step"></section>
<a data-impact-donate href="#donate">Donate</a>
```
v1 slots stay empty for unrecognized visitors. v2 (additive) lets a site author its own regions with `<template>` variants per donor state; the layer fills `data-ct-*` fields with text only, never HTML. Donor links carry only a signed opaque `?ct=` token; no personal data appears in URLs. Theming uses `--ct-*` CSS variables. Full contract: [PROGRESS.md](PROGRESS.md), rationale in `docs/PLAN_DYNAMIC_SITE.md`.

## Architecture
| Folder | What |
|---|---|
| `engine/` | Pure TypeScript: allocation, facts, prompt, guard, template fallback, tokens, donor state, milestones. Vitest. |
| `convex/` | Backend: schema, narrative action, `/donor-view` HTTP endpoint, donations, impact logs, milestones and email, dashboard queries, health. |
| `layer/` | The embeddable `layer.js` (esbuild IIFE): regions, conditions, live updates, motion. |
| `staff/` | Test-mode donate page and staff update page (static). |
| `demo-sites/` | Fictional charity host sites (test fixtures and contract-v2 hosts). |
| `dashboard/` | Charity dashboard (Vite + React + TypeScript), live Convex mode with sample-data fallback. |
| `frontend/` | First-pass static pages (landing, donor view, staff donors). |
| `seed/` | Fictional charities, donors, donations, expenses and impact logs. |
| `scripts/` | `build-site.mjs` (assembles what Vercel serves), `e2e-smoke.mjs`. |
| `docs/` | Specs, research, design, prompts, handoffs. |

## Built with
TypeScript, JavaScript, HTML, CSS, React 19, Vite, esbuild, Vitest, happy-dom, npm workspaces, Convex, the Anthropic API (Claude Sonnet 5.5), Resend, Vercel, GoDaddy (domain), Figma, Impeccable, Cursor, Grok, Claude Code.

## What each tool does
- **Claude (Anthropic API):** writes each donor's story from logged facts only, behind the guard.
- **Convex:** typed database, scheduled functions, a 5-minute milestone cron, file storage for staff photos and receipts, and HTTP endpoints for the embed.
- **Vercel:** hosts `layer.js`, the staff and donate pages and the demo sites. Only built static files are served.
- **GoDaddy:** registered the domain (www.chartitable.biz).
- **Resend:** milestone emails (team inboxes only).
- **Figma + Impeccable:** design for the slots and the dashboard.
- **Cursor (Grok 4.7):** rapid prototyping of the layer, staff page and test sites.
- **Grok Bot:** planning, product flow and design, team coordination, and the project slides.
- **Claude Code:** product engineering, review and research as described above.

## Run it
```bash
npm install
npm test            # engine and seed tests
npm run typecheck
npm run build       # layer/dist/layer.js
npm run build:site  # assembles dist-site/ exactly as Vercel serves it
npm run dev:layer   # serves the layer on http://localhost:5174
```
Copy `.env.example` to `.env` and fill in keys (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TOKEN_SECRET`, `DEMO_INBOXES`, `STAFF_PIN`). Never commit `.env`. The backend needs your own Convex account (`npx convex dev`); environment variables are set with `npx convex env set`.

## Known limitations
- **Fictional data only.** All charities, donors, photos and numbers are invented. No real organization is represented.
- **Test-mode payments only.** The donate page records test donations; no money moves.
- **Estimates are proportional,** not traced per dollar. That is the point of the honesty rule, but figures are approximate.
- **Minimal auth.** Staff and dashboard access use a shared demo PIN; the donor token sits in `localStorage` for 30 days. Production use would need real authentication.
- **Emails go only to configured demo inboxes.**
- A returning donor who donates again through the demo page is treated as the same donor only when they arrive with their link; the system never looks donors up by email.
- See [PROGRESS.md](PROGRESS.md) for the live task board.

## Team
Two people at Cal Hacks 13.0: the lead (product engineering, deploys, orchestration of the Claude Code agents) and a teammate (dashboard, design, Figma, Impeccable).
