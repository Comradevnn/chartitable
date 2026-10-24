# docs/design: Lane B deliverables consumed by Lane A

`ct-slots.css` (T22): default styles for the blocks `layer.js` renders inside the three slots. Rules:
- Every selector wrapped in `:where(...)` so site CSS always wins (contract v1).
- Only the `ct-` classes the layer emits: `.ct-story`, `.ct-record`, `.ct-estimate`, `.ct-photo`, plus the headings and lists the T8 prompt describes (`docs/CURSOR_LAYER_STAFF_PROMPT.md`, Stage B). Do not invent markup; ask via PROGRESS.md Blockers.
- Colors, fonts, radius only from `--ct-accent`, `--ct-fg`, `--ct-bg`, `--ct-muted`, `--ct-font`, `--ct-radius`, each with a fallback.
- Records and estimates must look clearly different; estimates always show the visible word "about" or "estimate".
- No images, fonts or external requests; no animation by default.
Lane A bundles this file into `layer.js` (esbuild `--loader:.css=text`). Until it exists, `layer.js` uses its built-in fallback styles.
