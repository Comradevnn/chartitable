# Brindlecote Food Bank (demo host, charity id demo-pantry-b)
- Structure: utility bar, header (6 nav items, Donate + Give Monthly), hero, three-card row, FY2025 stat band, since-last-visit slot, dollar bar, events, news, partner marks, next-step slot, newsletter, 4-column footer. Pages: index, donate, get-help, about.
- Slots: three empty `data-impact-slot` sections inside `.wrap` containers (hero under header, since-last-visit under stat band, next-step above newsletter); `[data-impact-slot]:empty{display:none}`. Every link to donate.html except Give Monthly (`donate.html?monthly`) carries `data-impact-donate`.
- Layer: `layer.js` script tag with `data-charity="demo-pantry-b"`; `--ct-*` vars on :root. No rules on `.ct-*`, no bare element color rules, no `section`/`h2`/`p` element selectors (layer :where() rules win).
- Palette: white, ink blue #12263f, slate #4a5b70, soft #f3f6f9, one warm accent #b34a08 (#f2a65a on dark). Font: Commissioner 400/500/700 self-hosted in fonts/.
- Art: generated SVG scenes in img/ (warehouse hero, card, news, banner scenes, logo mark, partner marks). No photos, no real logos. Content is fictional (Tarnwick County, 555 phone, .example emails).
- Preview: `preview.js` + `donor-view.*.json` (copied from _preview; sample nextStep href changed to index.html#volunteer so it works on every page). Use `?preview=1` or `?preview=empty`.
- Serve: `python3 -m http.server 5522 --directory demo-sites/hosts/brindlecote`.
- Verified at 1280/768/390, plain and ?preview=1, all 4 pages: no horizontal overflow, no duplicate ids, internal links and anchors resolve, text contrast AA (Donate white on #b34a08 = 5.4:1), mobile menu (aria-expanded, Escape), tap targets >=44px except the layer's own `.ct-next-link` (42px tall, from ct-slots.css).
