// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { donateHrefFor, donateHrefWithToken, paintRegions, rewriteDonate } from "../src/regions";
import { parseView } from "../src/view";

const PLAIN = donateHrefFor("https://example.test/donate.html", "demo-pantry-a");
const TOKEN = "eyJh+b/c=.sig-_x"; // chars that need encoding
const PAGE = `
<a id="head" data-impact-donate href="/old">Give</a>
<div data-impact-region="next"><p>Default</p></div>
<template data-impact-for="next" data-impact-variant="v">
  <p data-ct-text="story"></p><a id="tpl" data-impact-donate href="#">Give again</a>
</template>`;

function view() {
  const v = parseView({
    recognized: true,
    hero: { firstName: "Ada", story: "Thanks, Ada.", headline: null, body: null },
    sinceLastVisit: null,
    nextStep: null,
    records: [],
    estimates: [],
    photos: [],
  });
  if (!v) throw new Error("view");
  return v;
}

describe("donate links carry ct only for recognized donors", () => {
  it("a stranger keeps the plain URL", () => {
    document.body.innerHTML = PAGE;
    rewriteDonate(document, PLAIN);
    const href = document.getElementById("head")!.getAttribute("href")!;
    expect(href).toBe("https://example.test/donate.html?charity=demo-pantry-a");
    expect(href).not.toContain("ct=");
  });

  it("a recognized donor's header and template links end with &ct=<encoded token>", () => {
    document.body.innerHTML = PAGE;
    rewriteDonate(document, PLAIN); // strangers' rewrite runs first, as in layer.ts
    const withToken = donateHrefWithToken(PLAIN, TOKEN);
    rewriteDonate(document, withToken);
    const suffix = "&ct=" + encodeURIComponent(TOKEN);
    expect(document.getElementById("head")!.getAttribute("href")!.endsWith(suffix)).toBe(true);
    paintRegions(document, view(), withToken);
    const tpl = document.getElementById("tpl")!.getAttribute("href")!;
    expect(tpl).toBe(PLAIN + suffix);
    expect(tpl.endsWith(suffix)).toBe(true);
  });

  it("uses ? when the base has no query, and adds nothing when donate is unconfigured", () => {
    expect(donateHrefWithToken("https://x.test/d", "a.b")).toBe("https://x.test/d?ct=a.b");
    expect(donateHrefWithToken("", "a.b")).toBe("");
  });
});
