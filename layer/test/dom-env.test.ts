// @vitest-environment happy-dom
// Proves the DOM test environment for the layer (contract v2 region tests build on this).
import { describe, expect, it } from "vitest";

describe("layer test environment", () => {
  it("clones template content and writes text, not markup", () => {
    document.body.innerHTML = '<template id="t"><p data-ct-text="story"></p></template><div id="r"></div>';
    const tpl = document.getElementById("t") as HTMLTemplateElement;
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    const p = frag.querySelector("[data-ct-text]");
    if (p) p.textContent = '<img src=x onerror="alert(1)">';
    document.getElementById("r")?.replaceChildren(frag);
    expect(document.querySelector("#r img")).toBeNull();
    expect(document.querySelector("#r p")?.textContent).toContain("<img");
  });
});
