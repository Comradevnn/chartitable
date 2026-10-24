/**
 * Default slot styles, one string so T22 can replace this with
 * docs/design/ct-slots.css (esbuild --loader:.css=text). Every selector is
 * inside :where() so a host stylesheet always wins.
 */
export const FALLBACK_STYLES = `
:where([data-impact-state="ready"]){color:var(--ct-fg,#1c1917);background:var(--ct-bg,transparent);font-family:var(--ct-font,inherit);border-radius:var(--ct-radius,0);margin:1rem 0;padding:.75rem 0;max-width:100%;overflow-wrap:anywhere}
:where(.ct-story,.ct-next){margin:0 0 .75rem;max-width:65ch;line-height:1.45}
:where(.ct-heading,.ct-since-heading){margin:.85rem 0 .35rem;font-size:1.15rem;line-height:1.25;font-weight:700}
:where(.ct-facts){margin:0 0 .75rem;padding:0;list-style:none}
:where(.ct-record,.ct-estimate){margin:0;padding:.35rem 0}
:where(.ct-estimate,.ct-note,.ct-disclaimer){color:var(--ct-muted,#57534e)}
:where(.ct-disclaimer){margin:.25rem 0 0;max-width:65ch;font-size:.9rem;line-height:1.4}
:where(.ct-photo){display:block;width:auto;max-width:min(100%,280px);height:auto;margin:.6rem 0 0;border-radius:var(--ct-radius,0)}
:where(.ct-next-link){color:var(--ct-accent,#1f4d3a);font-weight:700}
@media (prefers-reduced-motion:reduce){:where(.ct-story,.ct-next,.ct-heading,.ct-since-heading,.ct-facts,.ct-record,.ct-estimate,.ct-note,.ct-disclaimer,.ct-photo,.ct-next-link){animation:none;transition:none}}
`.trim();
