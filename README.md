# Chartitable

**A personalization layer for small charities' own websites.** Online shops remember you: your last order is front and center when you return. Chartitable gives returning donors the same experience. When a donor comes back to a food pantry's site, the page shows what their gift has done since their last visit and suggests one helpful next step.

Built at Cal Hacks 13.0 (Oct 23–25, 2026). **Status: work in progress.** This README describes what exists today and what is planned, and marks the difference.

## The problem
Small food pantries and food banks run on volunteers and have no fundraising staff. They can't afford to thank and update donors personally, so donors drift away. Donors rarely hear what their gift did.

## What it does
- A charity adds one `<script>` tag and a few empty marked slots to the site it already has. No redesign.
- Returning donors (recognized through a signed link or a remembered token) see their impact in those slots. First-time visitors see the normal site, untouched.
- The layer reuses the site's own elements and styles; it doesn't generate new graphics, so it's cheap to run and looks native.
- A milestone email, "See where your donation has gone," links the donor back to their personalized view.
- A staff dashboard (planned) shows top donors, expenses, cost per meal and a thank-you queue.

## The honesty rule
Donations are pooled, so we cannot claim a specific dollar bought a specific thing. Therefore:
- A gift is credited **proportionally** and always labeled ("about 3% of this week's meals, an estimate").
- **Records** (what staff logged) and **estimates** (what we computed) are shown separately.
- Claude may only narrate facts from a payload we build. A **deterministic fact-check guard** rejects any story containing a number, name or percentage that isn't in that payload, or an estimate without its label, and falls back to a plain template. If data is thin, it says less.
- Suggested next steps are never guilt-based.

## How Claude is used
`claude-sonnet-5-5` turns a donor's structured facts into a short story and picks a next step, returning structured JSON. The guard checks every output before a donor sees it. Where Claude could go wrong (invented numbers, inflated impact, pressure tactics) is exactly what the guard and prompt rules target, and the tests cover those cases.

## Embed contract (v1)
```html
<script src="https://<layer-host>/layer.js" data-charity="<charity-id>" defer></script>
<section data-impact-slot="hero"></section>
<section data-impact-slot="since-last-visit"></section>
<section data-impact-slot="next-step"></section>
<a data-impact-donate href="#donate">Donate</a>
```
Slots stay empty for unrecognized visitors. Donor links carry only a signed opaque `?ct=` token; no personal data appears in URLs. Theming uses `--ct-*` CSS variables, and our default styles have zero specificity so the site's CSS always wins. Full contract: [PROGRESS.md](PROGRESS.md).

## Architecture
| Folder | What |
|---|---|
| `engine/` | Pure TypeScript: proportional allocation, facts payload, prompt, fact-check guard, template fallback, signed tokens. Tested with Vitest. |
| `convex/` | Convex backend: schema, seed loader (narrative action, donor-view endpoint, donate and email actions are planned). |
| `layer/` | The embeddable `layer.js` (esbuild IIFE). Currently a stub. |
| `staff/` | Staff update page and hosted test-mode donate page (planned). |
| `seed/` | Fictional charities, donors, donations and pantry logs. |
| `dashboard/` | Charity dashboard (planned; spec in `docs/DASHBOARD_SPEC.md`). |
| `docs/` | Specs, research and handoff notes. |

## What each tool does
- **Claude (Anthropic API):** writes each donor's story and next step from logged facts only; guarded as described above.
- **Convex:** realtime database, file storage for staff photos, scheduled milestone checks, HTTP actions for the embed API.
- **Vercel:** hosts `layer.js`, the staff and donate pages, and the demo sites on separate origins.
- **Resend:** milestone emails (demo sends only to team inboxes).
- **Figma:** designs for the demo charity sites and the dashboard.
- **Cursor and Grok Bot:** part of the code is written in Cursor, with Grok Bot used for planning and collaboration. Claude Code (an Opus orchestrator with Sonnet coding and Haiku research subagents) wrote and reviewed the rest. See [CLAUDE.md](CLAUDE.md).
- **Impeccable:** design guidance for the dashboard implementation.
- **Cartesia:** possible voice thank-you; stretch goal, not built.

## Run it
```bash
npm install
npm test            # engine and seed tests
npm run typecheck
npm run build       # emits layer/dist/layer.js
npm run dev:layer   # serves the layer on http://localhost:5174
```
Copy `.env.example` to `.env` and fill in keys (`ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `TOKEN_SECRET`, `CONVEX_URL`, `DEMO_INBOXES`). Never commit `.env`. Running the Convex backend requires `npx convex dev` with your own Convex account.

## Known limitations
- **Fictional data only.** All charities, donors and photos are invented. No real organization is represented.
- **Test-mode payments only.** The donate page records test donations; no money moves.
- **Estimates are proportional,** not traced per dollar. That is the point of the honesty rule, but it means figures are approximate.
- **Demo auth is minimal.** The dashboard's staff login is a stub; production use would need real authentication.
- **Emails go only to configured demo inboxes.**
- Several components listed above are not built yet; see [PROGRESS.md](PROGRESS.md) for the live task board.

## Team
Built by a three-person team at Cal Hacks 13.0. Process notes, agent roles and handoffs: [CLAUDE.md](CLAUDE.md), [PROGRESS.md](PROGRESS.md), `docs/handoff/`.
