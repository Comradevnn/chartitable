# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS, and vanilla JS. No framework and no build step. Each test host is its own folder under `demo-sites/test-hosts/` and is served with a local static file server.

## Users

People using a small fictional food pantry or food bank website:

- Local donors checking whether a gift did something, often on a phone, often returning from an email link.
- Volunteers looking for the schedule, the address, and how to help.
- Neighbors seeking food, who need hours, location, and what to bring, in plain language.

- Returning donor (T22): someone who gave a modest gift (about $25) once and is coming back, usually on a phone. They want to feel seen and informed, never watched.

Staff dashboards are a different product and are out of scope here.

## Product Purpose

These sites are fictional charity websites that host Chartitable's donor-personalization layer. They exist so the script-tag layer can be tested and demoed before the real demo sites are finished. Success means a first-time visitor sees a complete, trustworthy charity site, and a returning donor sees their own impact in the empty slots without the rest of the page breaking.

## Positioning

The charity site stays the charity's site. Personalization is a layer, not a replacement page: three empty slots and one donate link, filled only for a recognized donor. A generic charity template cannot truthfully claim that strangers see no personalization, that computed numbers stay labeled estimates, and that the same embed works unchanged across different layouts.

## Operating Context

Local demo at Cal Hacks 13.0. Four hosts on ports 5501–5504. The production layer script, when present, loads from `http://localhost:5174/layer.js`. A dev-only preview (`?preview=1`) fills the slots from sample JSON so layouts can be checked before that script exists. Donor links in the real product carry only an opaque `?ct=` token. No names, emails, or other personal data in URLs.

## Returning-donor slots (T22, D15)

Owned by Teammate 1, delivered as `docs/design/ct-slots.css` and bundled into `layer.js`. Three blocks fill the empty slots inside the charity's own site: **hero** (short story, what the pantry logged, the donor's estimated share), **since-last-visit**, and **next-step**. Goal: the donor feels seen and informed. Tone: neighborly, specific, honest. Thin data means a shorter, more modest view; an error or empty state shows nothing at all and the site looks normal. Styles use zero-specificity `:where()` selectors on existing `ct-*` classes only, take colors, font and radius from `--ct-*` with fallbacks, add no markup, no animation and no external requests, so the host's CSS always wins. Records and estimates stay visually distinct, and every estimate carries the word "about" or "estimate".

## Capabilities and Constraints

- Four distinct hosts. Charity ids are only `demo-pantry-a` (hosts 1 and 3) and `demo-pantry-b` (hosts 2 and 4). Display names are chosen later and must be checked against the live web before use.
- Integration contract v1, exact: empty `data-impact-slot` sections (`hero`, `since-last-visit`, `next-step`), `a[data-impact-donate]`, script `data-charity`, `:empty { display: none }`, and `--ct-accent`, `--ct-fg`, `--ct-bg`, `--ct-muted`, `--ct-font`, `--ct-radius`.
- Slots stay completely empty in HTML. The page must look finished with them empty.
- Records and estimates stay visually separate. Every estimate shows the word "about" or "estimate". Site-authored figures are specific, itemized, and dated; a figure without a stated basis is labeled.
- Next steps are never guilt-based. If data is missing, say less.
- Fictional only: invented names, addresses, and phone numbers; no EIN; no real organization names, branding, logos, photos, or copied markup.
- Images are SVG, CSS shapes, or simple gradient scenes in the repo. No downloaded stock photos. No external scripts, CDN fonts, or trackers.
- Accessible: landmarks, labels, contrast, keyboard focus, `prefers-reduced-motion`. Readable at 1280, 768, and 390 px.
- Each host has a second page so navigation is real.
- Voice and the four look directions are fixed by the task brief. Charity display names are not chosen yet.

## Brand Commitments

Voice is neighborly, specific, and plain. Never guilt-based. Never corporate-fundraising. Warmth and trust over persuasion tricks.

Chartitable is the layer's name, not the charity's name. The four hosts must look different from each other: a warm community pantry, a clean regional food bank, a modest volunteer-run site, and a busier community-center site. Those directions are binding; palettes and type live with each site, not in this file.

## Evidence on Hand

- Structure and honest-language patterns: `docs/demo-site-reference.md` (structure only; do not copy real sites).
- Slot behavior: `docs/PRODUCT_SPEC.md` §13 and the integration contract in `PROGRESS.md`.
- `DonorView` shape: `engine/types.ts`. Sample people and numbers for the preview harness are fictional and not written yet.
- No real testimonials, press, accreditation, donor data, or photography exist. Do not invent any of those as if they were real.

## Product Principles

1. A stranger sees the charity's own site, complete, with nothing personalized.
2. Logged facts and computed estimates never share a visual treatment, and estimates always say so.
3. Say only what the page can stand behind. Missing data means a shorter page, not a smoother claim.
4. Write like a neighbor: specific, warm, and free of guilt.
5. The embed contract is exact, and it has to survive a plain page and a cluttered one.

## Accessibility & Inclusion

Neighbors seeking food and donors on phones are primary readers. Plain language, visible labels, keyboard access, sufficient contrast, and no motion unless the visitor allows it. Estimates are labeled in text, not by color alone.
