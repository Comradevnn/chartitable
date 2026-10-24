# Critique: four test hosts, plain + returning-donor state (2026-10-24)

Method: dual-agent (A: design review, B: detector + browser evidence). Heuristics 5, 9, 10 n/a (no transactions/errors, Persuade-mode); scored /28 applicable max. Overall: roughly 19/28 plain, 15/28 returning-donor.

## Specificity
- Cinderwell (warm-pantry): authored (hours board, itemized invoice, SVG bag). Template below the `.meal` card.
- Brindlecote (regional-bank): category-correct, least personal; "18,420 pounds" repeated, flat hierarchy.
- Quillon Street (volunteer-run): most convincing; layer slot sits inside `.column`. Empty `.shelf` gradient with a false aria-label.
- Wrenfield Lane (church-community): busy only in the top 900px.
- Four hosts are distinct in palette/type/density; weakest axis is voice and detail. All share one skeleton.

## Priority issues
- **P0** `.ct-next-link` unreadable on all four hosts once layer CSS loads (host bare `a {color}` beats `:where()`): contrast 1:1 (Wrenfield), ~1.4 (Cinderwell), ~1.7 (Quillon), ~2 (Brindlecote).
- **P1** Estimates read as bold facts, records as footnotes (host `.ct-estimate{font-weight:700}` overrides layer); estimates have no subject ("about 4 meals" whose?).
- **P1** Injected blocks not aligned to host column (slots outside `.wrap`; full-bleed at 390; UA figure margin offsets photo).
- **P1** Greeting is a `<p>` that merges host heading + layer eyebrow styles (huge tracked amber caps on Brindlecote); no semantic heading.
- **P2** Hero ~1.5 screens tall at 390 before host content; story duplicates the lists. Same large hero on inner pages.
- **P2** `.ct-note` runs into date inline.
- **P3 (real, detector confirmed)** Brindlecote header Donate: `.nav-list a` beats `.button`; #17324a on #8f4a12 = 1.98:1. Also on network.html.

## Detector (B)
11 warnings: cream-palette x4 (intentional), cramped-padding x4 church (8px gutter, partly false positive, still tight), low-contrast x2 bank (real), tight-leading x1 warm-pantry (h1/h2 at 1.15 on multi-line display). No console errors, no 390px overflow. Tap targets <44px: brand links, skip links, church phone/News/Give.

## Questions
Is the hero's best moment its absence? Should it say what $25 did in host units instead of "86 meals"? Does a returning donor need the same crate SVG on every host?
