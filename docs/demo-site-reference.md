# Demo site design reference (for Teammate 1: T10, T11)

Source: Haiku read-only survey of 10 real pantry/food bank/charity sites, Fri Oct 23 2026. **Reference for structure and tone only. Do not copy markup, copy, images or logos; demo charities are fictional (D5).** Platform claims marked "inferred" came from URL patterns, not docs.

## Common small-pantry homepage order
header (logo, Donate + Give Monthly, Volunteer, Find Food) > hero (one headline, Donate + Volunteer CTAs) > one impact line or stat row ("$X = N meals") > three cards (Find food, Give, Volunteer) > schedule/location/hours (high up on pantries) > events or news > story/testimonial > newsletter > footer (address, accreditation badges).

## Honest impact language
- Good pattern: price per outcome + the item list + the period ("$35 provides a complete meal for one family", an itemized list); "97 cents of every dollar" style labeled allocations; match offers that state cap and deadline.
- Avoid: "up to N meals" with no basis, stats with no source or date, figures that contradict each other on one site, stale copyright years.

## Donate flow
Most real sites link out to a hosted form (Givebutter, Donorbox, Network for Good, Classy, Neon, Blackbaud-style). Our hosted test-mode donate page + redirect with `?ct=` mirrors that, so the hop looks normal. Hosted campaign pages cannot run a script; the embed must live on the charity's own site. WordPress (most common in the sample) allows header/footer scripts or custom HTML blocks; Squarespace via paid code injection (general knowledge, unverified).

## Two visual directions (placeholder names must be checked against live search before use)
- **Site one `demo-pantry-a` — "Juniper Row Community Pantry":** warm cream + terracotta, rounded corners, photo-led hero, neighbor-first headline, weekly schedule near the top, short volunteer quote, "$35 = one family's meal" block with an itemized list. Serif headings, warm sans body.
- **Site two `demo-pantry-b` — "Northmere Regional Food Bank":** white + deep slate blue with one accent, grid layout, stat row with dates/sources in small print, "where your gift goes" bar, Donate and Donate Monthly in the header, crisp sans-serif.

## Where Chartitable slots fit
Hero slot: right under the header, above the generic hero (collapses when empty). Since-last-visit: just below the impact stat row. Next-step: above the newsletter/footer. Sites must look complete with all slots empty.
