---
name: Chartitable
description: Product landing for the donor-impact layer, dressed as a food pantry's own shelf-label system.
colors:
  shelf-steel: "#2b343a"
  steel-shadow: "#1d2428"
  rail-lip: "#46535b"
  label-stock: "#f4f6f5"
  stockroom-wall: "#d3dadd"
  marker-ink: "#111111"
  muted-ink: "#3f4c53"
  pale-print: "#c3ced3"
  price-gun-orange: "#ff5f1f"
  record-green: "#12803e"
  reject-rust: "#8a2a12"
  masking-tape: "#dccd96"
  capture-mat: "#c5cdd1"
  terminal-steel: "#161c20"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(2.5rem, 5.1vw, 4.4rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(2.1rem, 4.6vw, 3.6rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "0.01em"
  title:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(1.9rem, 3.6vw, 2.6rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "0.02em"
  statement:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.02em"
  label:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.09em"
  label-small:
    fontFamily: "Barlow Condensed, Arial Narrow, Roboto Condensed, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
  body-lead:
    fontFamily: "Commissioner, Segoe UI, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.45
  body:
    fontFamily: "Commissioner, Segoe UI, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.55
  fine:
    fontFamily: "Commissioner, Segoe UI, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, Menlo, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.7
rounded:
  none: "0px"
  track: "10px"
  sticker: "50%"
spacing:
  s1: "0.5rem"
  s2: "1rem"
  s3: "1.5rem"
  s4: "2.5rem"
  s5: "4rem"
  s6: "6rem"
  gutter: "clamp(16px, 4vw, 32px)"
components:
  button-primary:
    backgroundColor: "{colors.price-gun-orange}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 14px 0 30px"
    height: "68px"
  button-primary-hover:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.price-gun-orange}"
  button-steel:
    backgroundColor: "{colors.shelf-steel}"
    textColor: "{colors.label-stock}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 24px"
    height: "52px"
  button-steel-hover:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.label-stock}"
  button-label:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0 20px"
    height: "44px"
  button-label-hover:
    backgroundColor: "{colors.masking-tape}"
    textColor: "{colors.marker-ink}"
  nav-tag:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.label-small}"
    rounded: "{rounded.none}"
    padding: "0 18px"
    height: "44px"
  nav-tag-current:
    backgroundColor: "{colors.shelf-steel}"
    textColor: "{colors.label-stock}"
  price-tag:
    backgroundColor: "{colors.shelf-steel}"
    textColor: "{colors.label-stock}"
    rounded: "{rounded.none}"
    padding: "10px 16px 9px"
  shelf-tag:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.s4}"
  record-card:
    backgroundColor: "{colors.label-stock}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.none}"
    padding: "{spacing.s3}"
  estimate-card:
    textColor: "{colors.label-stock}"
    rounded: "{rounded.none}"
    padding: "{spacing.s3}"
---

# Design System: Chartitable

## Overview

**Creative North Star: "Stockroom Labels"**

The page is dressed as the back room of a small food pantry: galvanized steel shelf rails, white die-cut label stock clipped to them, masking tape for staff notes, and a single orange price-gun strip. Every claim is set as something you could stick on a shelf. The system is flat, square-cornered and dense with labels rather than with cards; depth comes from steel rails and paper sitting on them, not from floating panels.

Hierarchy is carried by inversion, not by size: the active or most important tag is printed white-on-steel, while the surrounding tags stay steel-on-white. Colour is rationed by role. Orange belongs to one action; green and the hollow ring belong to the record/estimate distinction; everything else is steel, paper and ink. The honesty rule is a visual rule here: a logged record and a computed estimate never share a treatment, and the difference is a shape and line pattern that survives grayscale.

The world explicitly refuses the generic SaaS split hero over a row of rounded feature cards.

**Key Characteristics:**
- Square die-cut corners (one clipped corner, top-right and bottom-left) on every label.
- Steel shelf rails with punched slots divide sections.
- Condensed uppercase label print for display and controls, calm humanist sans for reading.
- Inversion (white-on-steel) marks emphasis; type size does not escalate to compete.
- Filled dot = logged record; hollow ring plus dashed edge = estimate.
- One orange element per page.

## Colors

A cold steel-and-paper neutral field with exactly one hot accent and two role-locked signal colours.

### Primary
- **Price-Gun Orange** (`price-gun-orange`): the "See it live" strip in the hero and nothing else. On hover it inverts to ink with orange lettering. Its rarity is the hierarchy.

### Secondary
- **Record Green** (`record-green`): fill of the solid record dot only. Never a background, never text.
- **Reject Rust** (`reject-rust`): the "Rejected" stamp border and lettering in the fact-check demo, and the dot beside an invented sentence. A warning ink, not a brand colour.

### Neutral
- **Shelf Steel** (`shelf-steel`): rails, header, dark sections, price tags, inverted tags and the steel button. Also the browser theme colour.
- **Steel Shadow** (`steel-shadow`): the lower lip of every rail and the footer ground.
- **Rail Lip** (`rail-lip`): the upper highlight edge of rails and code blocks; dashed border on missing-image placeholders.
- **Label Stock** (`label-stock`): every label, tag and card face; text on steel.
- **Stockroom Wall** (`stockroom-wall`): the page background behind the shelves; punch-hole fill on light sections.
- **Marker Ink** (`marker-ink`): primary text and the ink-bordered taped tag.
- **Muted Ink** (`muted-ink`): secondary lines on label stock (captions, fine print, the "small" line under a statement).
- **Pale Print** (`pale-print`): secondary text on steel; the bottom edge strip on demo cards.
- **Masking Tape** (`masking-tape`): tape strips, the presenter note, and the hover face of label-white buttons.
- **Capture Mat** (`capture-mat`): the backing behind screenshots and the off state of the switch track.
- **Terminal Steel** (`terminal-steel`): code-block ground.

### Named Rules
**The One Strip Rule.** Price-Gun Orange appears on the single primary action and nowhere else on a surface. Secondary actions are steel or label-white; the Copy control is label-white with a tape hover.

**The Shape-Not-Hue Rule.** Record vs estimate is told by shape and line: a filled dot and a solid label for a logged record, a hollow ring and a dashed border for an estimate. Green is a bonus, never the only signal.

## Typography

**Display Font:** Barlow Condensed 600/700 (with Arial Narrow, Roboto Condensed), self-hosted woff2 in `landing/fonts`
**Body Font:** Commissioner 400/700 (with Segoe UI, system-ui), self-hosted woff2 in `landing/fonts`
**Label/Mono Font:** system monospace stack (ui-monospace, Cascadia Mono, Consolas, Menlo) for code only

**Character:** a narrow, printed-label voice for anything that is a tag, set uppercase and tracked; a warm, even sans for every sentence a person has to read.

### Hierarchy
- **Display** (`display`): the hero promise only, uppercase, on a large shelf tag; its last line is inverted onto steel.
- **Headline** (`headline`): section headings, either printed on a die-cut label (light sections) or set directly in label stock on steel (dark sections), max about 20ch.
- **Title** (`title`): demo-card headings; step headings use the same face at 1.7rem.
- **Statement** (`statement`): record and estimate lines and guard sentences, the sentences the honesty rule is about.
- **Label** (`label`): buttons, captions, tag text; uppercase, tracked 0.07 to 0.14em.
- **Label small** (`label-small`): nav tags, code-bar titles, card edge strips.
- **Body lead** (`body-lead`): the hero subline, max 36rem; section ledes run 1.15rem, max 40rem.
- **Body** (`body`): running text, lines held to about 30rem inside tags.
- **Fine** (`fine`): disclaimers and sample-data notes, in muted ink or pale print.

### Named Rules
**The Inversion Rule.** To emphasise, invert (label stock on steel); do not enlarge. Headline sizes top out at 3.6rem and the hero alone reaches 4.4rem.

**The About Rule.** Any computed number is printed with "about" or "estimate" in the same line of type, including stickers; a hidden "an estimate" suffix is added for screen readers where the sticker is short.

## Layout

A single centered column (`min(1240px, 100% - 2 * gutter)`) holds every section. Sections are separated by full-bleed steel rails (40px, slotted pattern, 6px lip on top, 5px shadow below) rather than by whitespace alone; section padding is `s6`, dropping to `s5` below 960px. The spacing scale is `s1`–`s6` (0.5 to 6rem) and is used for every gap and padding; the only off-scale values are small optical nudges inside labels.

Grids are asymmetric fractions, never equal columns: hero tag 1.12fr beside screenshots 1fr from 960px; the idea section runs 4/5/3 at 1100px with notes pinned against regions of the screenshot via subgrid; demo cards 1.15fr/1fr with the second dropped by `s5`; how-it-works 1fr/2.1fr; dashboard 4/8. Below 640px everything stacks to one column and the hero shows one capture (the donor view). Breakpoints: 480, 640, 960, 1100px.

## Elevation & Depth

Mostly flat. Depth is physical, not ambient: rails have a lit top lip and a shadowed bottom lip, screenshots sit on a steel shelf lip, and labels are clipped paper. Soft, downward-offset shadows appear only under things that are physically placed on top of something else.

### Shadow Vocabulary
- **Shelf item** (`0 10px 22px -10px rgba(17,17,17,.45)`): screenshots standing on a shelf.
- **Shelf item, forward** (`0 14px 28px -12px rgba(17,17,17,.5)`): the larger donor capture in the idea section.
- **Sticker** (`0 6px 12px -4px rgba(17,17,17,.5)`): record and estimate stickers stuck onto captures.
- **Printed stub** (`0 8px 14px -6px rgba(17,17,17,.4)`): the "Copied" label that feeds out under the code block.

### Named Rules
**The Placed-Object Rule.** A shadow means "this is lying on top of something". Labels on a rail, cards and buttons carry none.

## Shapes

Corners are square. The signature silhouette is die-cut label stock: a polygon clip removes the top-right and bottom-left corners (20px on big tags, 8 to 18px on smaller ones). Large tags carry a 16px punch hole at top-left filled with the colour behind them. The primary strip is notched on both short ends like price-gun tape; tape strips have a zigzag torn edge and sit rotated -4deg. Round forms are reserved for meaning: the record dot, the estimate ring, the round estimate sticker, and the switch track (10px). Borders are 2 to 3.5px, solid for ink and records, dashed for estimates and placeholders.

## Components

### Buttons
- **Shape:** square, die-cut or notched; no radius.
- **Primary (price-gun strip):** orange, ink text in label type, 68px tall, notched ends, with a dashed divider before a down-arrow. Hover inverts to ink with orange text.
- **Steel:** shelf steel with label-stock text, 52px tall, die-cut 10px corner, trailing arrow; hover darkens to ink. Used for "Open Cinderwell", "Open Brindlecote", "Open the dashboard".
- **Taped tag:** paper face with a 2px ink border, a tape strip across the top edge, a two-line label (condensed title, small sans line). Hover inverts to steel.
- **Label-white (Copy, switch):** label stock with ink text, 44 to 48px; hover turns to masking tape.
- **Focus:** 3px outline, ink on light and label stock on dark, offset 3px (inset -7px on clipped shapes so the outline is not cut off).

### Navigation
Header is a steel rail; nav items are small die-cut label tags (44px min) in label-small type. Hover dims to wall grey; the current section inverts to steel with a 2px inset label-stock rule. The three-step strip under the hero is a second rail of the same tags.

### Cards / Containers
- **Shelf tag:** label stock, die-cut, punch hole, generous `s4` padding; holds the hero and the demo cards.
- **Record card:** solid label stock, die-cut 16px, filled dot, statement type.
- **Estimate card:** no fill, 3px dashed label-stock border, hollow ring, statement type; lives on steel.
- **Note:** small die-cut label with a leading dot, ring or arrow icon.

### Price Tag (signature)
A small steel tag printed beside a heading with one countable measurement for that section ("1 script tag", "0 donor logins"). On dark sections it inverts to label stock with ink.

### Stickers (signature)
Stuck onto real screenshots over the region they describe. The record sticker is a tilted rectangle with a filled dot ("150 lb, logged"); the estimate sticker is an 80px round sticker with a 5px steel ring, rotated -8deg, always reading "about".

### Code block
Terminal steel with rail lips top and bottom, a label-small title bar, monospace at 0.8rem/1.7 with horizontal scroll; key attributes in bold white. Copying feeds out a printed stub label (0.7s clip reveal, off under reduced motion).

### Guard demo
A draft card with a rust "Rejected" stamp that peels away (rotate -1.4deg, fade to .82, strikethrough) when the guard is on, above the template sentence the donor reads. Each card ends in a pale edge strip naming what it is.

## Do's and Don'ts

### Do:
- **Do** keep Price-Gun Orange (`#ff5f1f`) on exactly one primary action per surface.
- **Do** mark emphasis by inverting to label stock on shelf steel, not by raising the type size.
- **Do** pair every logged record with a filled dot and solid label, and every estimate with a hollow ring and dashed border, so grayscale still tells them apart.
- **Do** print "about" or "estimate" in the same line as any computed number, stickers included.
- **Do** separate sections with steel rails and keep corners square and die-cut.
- **Do** use Barlow Condensed uppercase only for tag text and headings, Commissioner for every readable sentence, both self-hosted.
- **Do** keep touch targets at 44px minimum and switch all motion off under `prefers-reduced-motion`.

### Don't:
- **Don't** add orange to secondary buttons, links, highlights or decoration.
- **Don't** distinguish records from estimates by colour alone, or give an estimate a solid filled label.
- **Don't** round card or button corners; radius is reserved for dots, rings, stickers and the switch track.
- **Don't** float labels or cards on ambient drop shadows; shadows are only for objects placed on top of something.
- **Don't** build the SaaS split hero over a row of rounded feature cards.
- **Don't** load fonts from a CDN.
