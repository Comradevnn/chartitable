# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase, not a greenfield. Backend is Convex (D2). The repo is an npm-workspaces monorepo: a pure-TypeScript `engine` and a `layer` that esbuild bundles into a single `layer.js` IIFE (D9). Vercel hosts everything static (D3). The staff dashboard is a Vite/TSX app in `/dashboard`. The demo host sites are static HTML, CSS, and vanilla JS (no framework, no build step), published by `scripts/build-site.mjs` at `/sites/<name>/`.

## Users

Everyone who touches a small fictional food pantry or food bank, on its website or behind it:

- Returning donors: local people checking whether a gift did something, often on a phone, often returning from an email link. Someone who gave a modest gift (about $25) once and is coming back wants to feel seen and informed, never watched.
- Strangers and first-time visitors: they must see the charity's own site, unmodified and complete.
- Neighbors seeking food: they need hours, location, and what to bring, in plain language.
- Volunteers: they look for the schedule, the address, and how to help.
- Pantry staff: the primary staff user is the pantry coordinator (non-technical, short on time, often on a phone or an old laptop). Secondary is the board member or grant writer, who wants totals and cost per meal for reports.

## Product Purpose

Chartitable is a personalization layer that shows returning donors their own impact on a small charity's website, plus a staff dashboard where the charity sees who gave, what was spent, and what it did. Success means a stranger sees a complete, trustworthy charity site, a returning donor sees their impact on that same site without the rest of the page breaking, and staff can answer "who gave, what did we spend, what did it do, who needs a thank-you" in about 30 seconds.

## Positioning

The charity site stays the charity's site. Personalization is a layer, not a replacement page. Under contract v2 the host authors the donor versions of its own sections (`data-impact-region` plus `<template data-impact-for>`), so the page looks redesigned for the donor rather than having a banner inserted. The v1 slots (`hero`, `since-last-visit`, `next-step`) remain valid and additive. A generic charity template cannot truthfully claim that strangers see no personalization, that computed numbers stay labeled estimates, and that the same embed works unchanged across different layouts.

## Operating Context

Cal Hacks 13.0 demo. Devpost submission is due Sun Oct 25 2026, 9:00 AM PT (hard). The pitch is 3 minutes plus 2 minutes of Q&A, judged live.

Published demo hosts: Cinderwell (`/sites/cinderwell/`, `demo-pantry-a`) and Brindlecote (`/sites/brindlecote/`, `demo-pantry-b`). The four sites under `demo-sites/test-hosts/` are test fixtures only. The layer is served as `/layer.js` on Vercel; the host pages reference `http://localhost:5174/layer.js` for local development and the build rewrites it. Donor links carry only an opaque signed `?ct=` token (D6): no names, emails, or other personal data in URLs. `?preview=1` is the older fake-data harness for checking layouts; the test fixtures can also be served locally on ports 5501–5504.

## Capabilities and Constraints

- Charity ids are only `demo-pantry-a` ("Cinderwell Pantry"; the host site title is "Cinderwell Community Pantry") and `demo-pantry-b` ("Brindlecote Food Bank"). The names are final (T21).
- Integration contract v1: empty `data-impact-slot` sections, `a[data-impact-donate]`, script `data-charity`, `:empty { display: none }`, and the `--ct-*` theming variables. Contract v2 is additive: host-authored regions and templates, conditions, and fields. `PROGRESS.md` → Integration contract is the source of truth for both.
- A stranger's page stays unmodified: slots and regions are empty or default by default, and the page must look finished without any layer.
- Donor states (T24): `just_gave`, `news`, `first_impact`, `repeat`, `lapsed`, `returning`. These are internal keys; UI copy never shows them as labels.
- Live and motion (T27, T28): a visible-tab-only poll about every 6 seconds, view transitions, count-up, estimate draw-in, and live arrivals. All of it is off under `prefers-reduced-motion`. `docs/design/ct-slots.css` itself carries no animation.
- Honesty mechanics: pooled gifts are credited proportionally (D1). Every computed number is labeled "about" or "estimate". Records and estimates stay visually separate. Claude narrates only from the facts payload, and a deterministic guard rejects anything else and falls back to a template (D8).
- Staff dashboard: overview, donors, expenses; mark a donor thanked; donors can opt out of top-donor lists (`hideFromTopDonors`); the staff sign-in is a demo PIN stub (D18). Staff-facing labels protect dignity: "Quiet lately" and "Gave before", never "At risk" or "Lapsed".
- Email goes only to addresses in `DEMO_INBOXES` (D4). Payments are test mode only (D10).
- Fictional only (D5): charities, donors, names, photos, and logos. No real organization names, branding, or copied markup.
- Images are SVG, CSS shapes, or simple gradient scenes in the repo. No downloaded stock photos. No external scripts, CDN fonts, or trackers on the host sites.

## Brand Commitments

Voice is neighborly, specific, and plain. Never guilt-based. Never corporate-fundraising. Warmth and trust over persuasion tricks. If data is missing, say less.

Chartitable is the layer's name, not the charity's name. The charity's own look stays the charity's; the layer takes its colors, font, and radius from the host through `--ct-*` variables.

## Evidence on Hand

- Seed data in `seed/data.ts`: 12 donors, 25 donations, 24 impact logs, and 16 expenses, all fictional.
- Sample donor-view JSON for the hosts and test hosts (`donor-view.sample.json`, `donor-view.empty.json`) and `layer/test/donor-view.json`.
- A Figma file for the returning-donor slots and the staff dashboard (key `jnGjgMPjBGua3ycFOzjQUg`).
- Structure and honest-language patterns: `docs/demo-site-reference.md` (structure only; do not copy real sites). Slot behavior: `docs/PRODUCT_SPEC.md` §13. `DonorView` shape: `engine/types.ts`.
- Absent: no real testimonials, customers, press, accreditation, traction, benchmarks, donor data, or photography. Do not invent any of those.

## Product Principles

1. A stranger sees the charity's own site, complete, with nothing personalized.
2. Honesty over impressiveness. Logged facts and computed estimates never share a visual treatment, and estimates always say so.
3. Say only what the page can stand behind. Missing data means a shorter page, not a smoother claim.
4. Write like a neighbor: specific, warm, and free of guilt.
5. Staff tools preserve donor dignity: thank people, never rank or label them.

## Accessibility & Inclusion

WCAG 2.2 AA. Touch targets at least 44px. Everything keyboard operable with visible focus. `prefers-reduced-motion` respected. Estimates are labeled in text, not by color alone. Plain language throughout, because neighbors seeking food and donors on phones are primary readers. Check layouts at 1280, 768, and 390 px.
