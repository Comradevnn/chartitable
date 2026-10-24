---
version: 1
slug: "landing-index-html"
primary_target: "landing/index.html"
related_targets: []
---

# Surface brief: Chartitable product landing (`landing/index.html`, published at `/`)

Mode: Persuade. Build path: code-led (recorded default).

Audience and job: a hackathon judge (and, behind them, a small food-pantry coordinator without fundraising staff) lands on chartitable.vercel.app and must understand within seconds what Chartitable is, believe it is a real product, and click "See it live". Proof on hand: the live Cinderwell and Brindlecote hosts (stranger vs returning-donor view), the one-line embed, the honesty rule (records vs estimates, fact-check guard, template fallback), the staff dashboard. No invented customers, metrics, prices or testimonials; all data fictional (D5).

Sections (from the brief): hero with two actions; the idea in one picture (stranger vs returning donor, real screenshots); live demo block (Cinderwell, Brindlecote; donor view opened from the presenter panel at /staff/demo, no PIN shown); how it works in 3 steps with the real embed snippet + copy button; the honesty rule as a feature; dashboard teaser; footer (fictional-data + test-mode notice, GitHub/README as text only, team of two).

Constraints: static HTML/CSS/vanilla JS, no build step, local fonts only (no CDN), no trackers, under 300 KB excluding screenshots, semantic landmarks, WCAG 2.2 AA, 44px targets, prefers-reduced-motion, works at 390 and 1280. No `?ct=` URLs or tokens anywhere.

## Direction contract

THESIS: Chartitable is the pantry's own label system: every claim on the page is a tag someone could stick on a shelf, and the honesty rule is visible in the stickers themselves. It refuses the SaaS split hero over a row of rounded feature cards.

OWN-WORLD: galvanized steel shelf rails (deep blue-grey steel) carrying white die-cut label stock; one price-gun orange strip reserved only for the primary action; inventory dot stickers by role only (solid green dot = logged record, hollow ring = estimate, readable in grayscale); marker-black type and masking-tape strips for staff notes; condensed label-print display face over a calm humanist sans. Hierarchy by inversion (white-on-steel tag = active/primary), never by ever-larger type. Raised lines: one measured step per section, its measurement printed on its tag (from forge); colour rationed strictly by role (from Bauhaus); hierarchy by inversion (from the four-shade handheld); record vs estimate by pattern, not hue (from the one-bit desktop).

STORY: the visitor sees the same pantry page twice (stranger, returning donor) and gets the idea at once; believes it because the numbers carry their own record/estimate stickers and the guard is shown rejecting an invented number; acts by opening the live Cinderwell page or copying the one-line install.

FIRST VIEWPORT: a steel shelf-edge rail across the top carries the nav as small shelf tags. Left, one large white shelf tag (punch hole, die-cut corner) holds the promise in condensed label print, the subline, the orange price-gun strip "See it live" and a taped "Install in one line" tag, with a solid-dot / hollow-ring legend. Right, the two shelf items: STRANGER and RETURNING DONOR captures of the real Cinderwell page, each tagged, the donor one stickered "about 16 meals" with a hollow ring. The next section's shelf rail peeks at the bottom.

FORM: Stockroom Labels, candidate 5 of 7 on the ordered list (assigned by the roll). seed:b23c5683315826fe

Signature interaction: the "Copy" price-gun strip on the embed snippet prints a fresh label (a short, reduced-motion-safe label-feed animation) and confirms "Copied"; the honesty section toggles one invented number being peeled off and replaced by the plain template sentence.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
