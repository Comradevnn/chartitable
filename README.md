# Chartitable

**A personalization layer for small charities' own websites.** Online shops remember you: your last order is front and center when you return. Chartitable gives returning donors the same experience. When a donor comes back to a food pantry's site, the page rearranges itself around them: what their gift has done since their last visit, a thank-you, and one helpful next step.

Built at Cal Hacks 13.0 (Oct 23–25, 2026) by a **two-person team**. Live demo hosts and backend: https://chartitable.vercel.app (Convex dev deployment behind it). This README describes what exists and what doesn't.

## The problem
Small food pantries and food banks run on volunteers and have no fundraising staff. They can't afford to thank and update donors personally, so donors drift away. Donors rarely hear what their gift did.

## What it does
- A charity adds one `<script>` tag and a few marked regions to the site it already has. No redesign.
- Returning donors (recognized by a signed link or a token remembered in the browser) see the page adapt: hero, since-last-visit and next-step regions fill with their story, and different layouts appear depending on donor state (just gave, news since last visit, first impact, repeat, lapsed). First-time visitors see the normal site, untouched.
- The layer reuses the host site's own elements and styles and doesn't generate new graphics, so it is cheap to run and looks native.
- Staff post updates (count, unit, note, optional photo) on a staff page; donors' views update live while the page is open.
- A milestone email, "See where your donation has gone", links the donor back to their view (demo sends only to team inboxes).
- A staff dashboard shows top donors, expenses and cost per meal (see "Status" for how far it is).

## The honesty rule
Donations are pooled, so we cannot claim a specific dollar bought a specific thing. Therefore:
- A gift is credited **proportionally** and always labeled ("about", "estimate").
- **Records** (what staff logged) and **estimates** (what we computed) are shown separately.
- Claude may only narrate facts from a payload we build. A **deterministic fact-check guard** rejects any text containing a number, name or percentage not in that payload, an unlabeled estimate, or pressure language, and falls back to a plain template. If data is thin, it says less.
- Suggested next steps are never guilt-based.

## How Claude is used
`claude-sonnet-5-5` turns a donor's structured facts into a headline, a short story and a next step, as structured JSON. The guard checks every output before a donor sees it, and the first view after a data change shows the template while Claude's version is generated for the next view. Where Claude could go wrong (invented numbers, inflated impact, pressure) is exactly what the guard and the tests target.

## How we built it (honest account)
- **Two people, two lanes.** The lead built the product side (engine, Convex backend, layer, donate and staff pages, deploys). The teammate owns the dashboard and the design work (Figma first, then implementation, with Impeccable for design quality). Process, ownership and handoffs are in [CLAUDE.md](CLAUDE.md), [PROGRESS.md](PROGRESS.md) and `docs/handoff/`.
- **Claude Code** did most of the product engineering: an Opus orchestrator planning and reviewing, Sonnet subagents writing scoped code, and Haiku subagents doing read-only research, audits and secret scans. Every change goes through a gate (read the diff, run tests, contract and secret checks) and the whole thing is tracked in PROGRESS.md.
- **Cursor** is where rapid website prototyping happens. Cursor (Grok 4.7 and Composer models) built the first `layer.js`, the staff update page and the four fictional test-host sites, using Impeccable for design guidance. The test hosts are fixtures for testing the layer, not the polished demo. Later layer work (regions, live updates, motion) came back through Claude Code. Cursor activity and screenshots are logged in `docs/cursor-grok-log.md` and `docs/cursor-shots/`.
- **Grok Bot** has so far been used only to create the project's presentation slides. It was not used for planning or for code.
- **Figma** holds the donor-slot and dashboard designs.
- All implementation was done during the hackathon; no code was reused from earlier projects.

## Status (what works today, what doesn't)
**Works, tested, and live on the dev deployment:**
- Allocation engine, guarded Claude narrative with template fallback, signed tokens, `/donor-view` API (first view template, later views Claude), visits and "since last visit", test-mode donate page, staff update page with photos, milestone emails with an allowlist, and a health page. 435 unit tests; `scripts/e2e-smoke.mjs` runs the donation → staff update → donor view path against the live backend.
- `layer.js` (about 8 KB gzipped) with conditional regions, several layouts per donor state, live polling and motion, running on the Vercel-hosted fictional charity sites.

**In progress or not done:**
- The staff dashboard UI (Overview, Donors, Expenses, a Vite app in `/dashboard`) is built on mock data. The backend queries it needs exist and are live; connecting the two is not finished. Static first-pass pages are in `/frontend`.
- The demo host sites are test fixtures; the design polish went into the layer and the slots.
- Cartesia voice (stretch) is not built. We chose not to use the Grok Voice API.
- Convex is a **development** deployment, not production.

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
| `dashboard/` | Charity dashboard (Vite + React + TypeScript), mock data for now. |
| `frontend/` | First-pass static pages (landing, donor view, staff donors). |
| `seed/` | Fictional charities, donors, donations, expenses and pantry logs. |
| `scripts/` | `build-site.mjs` (assembles what Vercel serves), `e2e-smoke.mjs`. |
| `docs/` | Specs, research, design, prompts, handoffs. |

## What each tool does
- **Claude (Anthropic API):** writes each donor's story from logged facts only, behind the guard.
- **Convex:** database, file storage for staff photos, scheduled milestone checks, HTTP endpoints for the embed.
- **Vercel:** hosts `layer.js`, the staff and donate pages and the demo sites. Only built static files are served.
- **Resend:** milestone emails (team inboxes only).
- **Figma + Impeccable:** design for the slots and the dashboard.
- **Cursor:** rapid prototyping of the layer, staff page and test sites.
- **Grok Bot:** the project slides.
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
