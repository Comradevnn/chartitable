# Design sample prompts: Cinderwell Pantry, three directions

Source critique: `.impeccable/critique/test-hosts-2026-10-24.md`. Subject: Cinderwell Pantry (`demo-sites/test-hosts/warm-pantry`, charity `demo-pantry-a`), home page, in both states: first-time visitor (slots empty) and returning donor (`?preview=1`, slots filled with the layer's markup and `docs/design/ct-slots.css` behavior).

## Shared brief (every direction)
- Static HTML/CSS/vanilla JS, no framework, no build. Fictional only. No external fonts, CDN, scripts or trackers; fonts only from `warm-pantry/fonts/` (copy what you use) or system stacks. Imagery is SVG/CSS only.
- Keep content truth: hours, address, the itemized $35 breakdown with "weight is an estimate", honest copy. Restyle and re-compose; don't invent facts or numbers.
- Integration contract v1 exact: empty `data-impact-slot="hero|since-last-visit|next-step"` sections in the HTML, `a[data-impact-donate]`, `:empty{display:none}`, `--ct-*` vars. Page must look finished with slots empty.
- Fix the critique's issues in the host CSS: (1) `.ct-next-link` must stay readable (set its colors explicitly with host-level specificity, AA contrast); (2) don't restyle `.ct-record`/`.ct-estimate` weight so records and estimates stay visually distinct (record = solid, estimate = dashed/italic/muted, always the word "about"); (3) slot sections align to the host's content column and `figure` margin zeroed; (4) greeting styled coherently as the host's own heading or a clear eyebrow; (5) hero is compact on mobile (photo capped or hidden under 480px); (6) `.ct-note` is block, never runs into the date; (7) tap targets >= 44px, display-heading line-height >= 1.2.
- Each sample must work at 1280, 768, 390 with no horizontal overflow, honor `prefers-reduced-motion`, keep focus states and landmarks.
- Output: a self-contained folder `design-samples/cinderwell-<name>/` with `index.html`, `styles.css`, any fonts, and symlinks/copies of `preview.js`, `donor-view.sample.json`, `donor-view.empty.json`, `preview-crate.svg` from `demo-sites/test-hosts/_preview/` (copy files, not symlinks, so the folder is portable). Include `layer-slots.css`, a copy of `docs/design/ct-slots.css` loaded by the page so the layer-on look is visible (the dev harness does not inject it). Do not edit anything outside your folder.

## A. "Bulletin Board" (`cinderwell-bulletin`)
A tactile community notice board. Warm paper and cork-free flat color blocks, index cards, masking-tape corners in CSS, handwritten-feel via type pairing (Besley italic accents) not script fonts. Hours as a pinned card first. The donor block is a pinned "note from the pantry" card, record rows as typed lines, estimate rows as a pencil-dashed line. Slight, still rotation (max 0.6deg, off at <480px). Palette: clay, flour, pine, one marker-yellow.

## B. "Open Ledger" (`cinderwell-ledger`)
Quiet editorial. One ink, one signal color, generous whitespace, big Besley headlines, tabular figures, hairline rules. Everything reads like a well-kept ledger: the $35 breakdown is the hero object; hours in a plain two-column strip. The donor block is a ledger slip: "What the pantry logged" (solid rule) vs "About your share, an estimate" (dashed rule), each group labelled so the estimate has a subject. No photo for donors. No cards, no shadows.

## C. "Daylight Signage" (`cinderwell-signage`)
Wayfinding and neighbor-first. Hours, address and "what to bring" in the first screen on mobile; huge condensed-feeling type via Atkinson 700 at large sizes, strong 2-color blocks, a pictogram row in inline SVG (door, bag, clock). Brand color flood sections, thick rules, very high contrast (AAA for body). The donor block is a slim status strip above the fold (greeting heading, one line of story, expandable details via `<details>` for records and estimates) so it never pushes the neighbor's hours down.
