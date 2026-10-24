// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import { announceReady, donateHrefFor, paintRegions, rewriteDonate, setHooks } from "../src/regions";
import { parseView, type View } from "../src/view";

const DONATE = "https://example.test/donate?charity=demo-pantry-a";

function viewOf(extra: Record<string, unknown> = {}): View {
  const v = parseView({
    recognized: true,
    hero: { firstName: "Ada", story: "Thanks, Ada. You helped.", headline: "Thank you", body: "You helped." },
    sinceLastVisit: {
      sinceDateLabel: "Oct 18",
      records: [{ logId: "s1", count: 1, unit: "meals", dateLabel: "Oct 22", note: null }],
      estimates: [{ unit: "meals", approxQuantity: 3 }],
    },
    nextStep: { kind: "give_again", text: "Give again soon", href: "/donate", label: "Give again" },
    records: [
      { logId: "a", count: 80, unit: "meals", dateLabel: "Oct 20", note: "Served lunch" },
      { logId: "b", count: 1, unit: "volunteer shifts", dateLabel: "Oct 21", note: null },
      { logId: "c", count: 5, unit: "meals", dateLabel: "Oct 22", note: null },
    ],
    estimates: [{ unit: "meals", approxQuantity: 26 }],
    photos: [{ logId: "a", url: "https://img.test/a.jpg" }, { logId: "b", url: "javascript:alert(1)" }],
    donor: { state: "just_gave", traits: ["named"], gifts: [{ amountDollars: 1250, dateLabel: "Oct 1" }, { amountDollars: 25, dateLabel: "Sep 1" }], giftCount: 2 },
    ...extra,
  });
  if (!v) throw new Error("view");
  return v;
}

function page(html: string): void {
  document.documentElement.removeAttribute("data-impact-active");
  document.documentElement.removeAttribute("data-impact-donor");
  document.body.innerHTML = html;
}

const region = (): HTMLElement => document.querySelector("[data-impact-region]") as HTMLElement;

describe("strangers", () => {
  it("no view: nothing changes, only donate links are rewritten", () => {
    const html =
      '<div data-impact-region="hero"><h1>Default</h1></div><template data-impact-for="hero"><p data-ct-text="story"></p></template><a data-impact-donate href="donate.html">Donate</a>';
    page(html);
    const before = document.body.innerHTML;
    const res = paintRegions(document, null, DONATE);
    expect(res.count).toBe(0);
    expect(document.body.innerHTML).toBe(before);
    expect(document.documentElement.hasAttribute("data-impact-active")).toBe(false);
    rewriteDonate(document, DONATE);
    expect(document.querySelector("a")?.getAttribute("href")).toBe(DONATE);
    expect(region().innerHTML).toBe("<h1>Default</h1>");
    expect(region().hasAttribute("data-impact-state")).toBe(false);
    expect(document.head.querySelector("style")).toBeNull();
  });
  it("donateHrefFor encodes the charity and handles empty", () => {
    expect(donateHrefFor("https://x.test/d", "a b")).toBe("https://x.test/d?charity=a%20b");
    expect(donateHrefFor("https://x.test/d?z=1", "a")).toBe("https://x.test/d?z=1&charity=a");
    expect(donateHrefFor("", "a")).toBe("");
  });
});

describe("region selection", () => {
  beforeEach(() => page(""));

  it("no template: default kept", () => {
    page('<div data-impact-region="hero"><h1>Default</h1></div>');
    expect(paintRegions(document, viewOf(), DONATE).count).toBe(0);
    expect(region().innerHTML).toBe("<h1>Default</h1>");
  });
  it("requires false: default kept", () => {
    page('<div data-impact-region="hero" data-impact-requires="photos+!records"><h1>Default</h1></div><template data-impact-for="hero"><p>Hi</p></template>');
    expect(paintRegions(document, viewOf(), DONATE).count).toBe(0);
    expect(region().innerHTML).toBe("<h1>Default</h1>");
  });
  it("requires true fills", () => {
    page('<div data-impact-region="hero" data-impact-requires="firstName|nothing"><h1>Default</h1></div><template data-impact-for="hero"><p data-ct-text="firstName"></p></template>');
    expect(paintRegions(document, viewOf(), DONATE).count).toBe(1);
    expect(region().textContent).toBe("Ada");
    expect(region().getAttribute("data-impact-state")).toBe("ready");
  });
  it("empty fill (no element children): default kept", () => {
    page('<div data-impact-region="hero"><h1>Default</h1></div><template data-impact-for="hero"><p data-ct-text="lastGift"></p></template>');
    const v = viewOf({ donor: undefined });
    expect(paintRegions(document, v, DONATE).count).toBe(0);
    expect(region().innerHTML).toBe("<h1>Default</h1>");
    expect(region().hasAttribute("data-impact-state")).toBe(false);
  });
  it("first matching when wins; no-when template is the default; variant reflected", () => {
    page(
      '<div data-impact-region="hero"><h1>Default</h1></div>' +
        '<template data-impact-for="other"><p>other</p></template>' +
        '<template data-impact-for="hero" data-impact-when="state:lapsed" data-impact-variant="lapsed"><p>lapsed</p></template>' +
        '<template data-impact-for="hero" data-impact-when="state:just_gave|state:news" data-impact-variant="fresh"><p>fresh</p></template>' +
        '<template data-impact-for="hero" data-impact-when="state:just_gave" data-impact-variant="second"><p>second</p></template>' +
        '<template data-impact-for="hero" data-impact-variant="thanks"><p>thanks</p></template>',
    );
    const res = paintRegions(document, viewOf(), DONATE);
    expect(region().textContent).toBe("fresh");
    expect(region().getAttribute("data-impact-variant")).toBe("fresh");
    expect(res.variants).toEqual({ hero: "fresh" });

    page(
      '<div data-impact-region="hero"><h1>Default</h1></div>' +
        '<template data-impact-for="hero" data-impact-when="state:lapsed"><p>lapsed</p></template>' +
        '<template data-impact-for="hero" data-impact-variant="thanks"><p>thanks</p></template>',
    );
    paintRegions(document, viewOf(), DONATE);
    expect(region().textContent).toBe("thanks");
    expect(region().getAttribute("data-impact-variant")).toBe("thanks");
  });
  it("no matching template at all: default kept; variant attr absent when template has none", () => {
    page('<div data-impact-region="hero"><h1>Default</h1></div><template data-impact-for="hero" data-impact-when="state:lapsed"><p>x</p></template>');
    expect(paintRegions(document, viewOf(), DONATE).count).toBe(0);
    page('<div data-impact-region="hero"></div><template data-impact-for="hero"><p>x</p></template>');
    const res = paintRegions(document, viewOf(), DONATE);
    expect(res.count).toBe(1);
    expect(region().hasAttribute("data-impact-variant")).toBe(false);
    expect(res.variants).toEqual({});
  });
  it("a ready region is not re-swapped on a second paint", () => {
    page('<div data-impact-region="hero"><h1>Default</h1></div><template data-impact-for="hero"><p data-ct-text="firstName"></p></template>');
    expect(paintRegions(document, viewOf(), DONATE).count).toBe(1);
    const second = viewOf({ hero: { firstName: "Bo", story: "s" } });
    expect(paintRegions(document, second, DONATE).count).toBe(0);
    expect(region().textContent).toBe("Ada");
  });
});

describe("fields", () => {
  it("story with markup renders as text", () => {
    page('<div data-impact-region="hero"></div><template data-impact-for="hero"><p data-ct-text="story"></p></template>');
    paintRegions(document, viewOf({ hero: { firstName: "Ada", story: "<img src=x onerror=alert(1)>" } }), DONATE);
    expect(region().querySelector("img")).toBeNull();
    expect(region().textContent).toBe("<img src=x onerror=alert(1)>");
  });
  it("scalars, data-ct-if and attribute cleanup", () => {
    page(
      '<div data-impact-region="hero"></div><template data-impact-for="hero"><div>' +
        '<h1 data-ct-text="headline"></h1><p data-ct-text="body"></p><b data-ct-text="lastGift"></b><i data-ct-text="lastGiftDate"></i><u data-ct-text="giftCount"></u><s data-ct-text="nextLabel"></s>' +
        '<em data-ct-if="state:lapsed">lapsed</em><span data-ct-if="repeat+!thin">kept</span><a data-ct-text="bogus">x</a></div></template>',
    );
    paintRegions(document, viewOf(), DONATE);
    const r = region();
    expect(r.querySelector("h1")?.textContent).toBe("Thank you");
    expect(r.querySelector("p")?.textContent).toBe("You helped.");
    expect(r.querySelector("b")?.textContent).toBe("$1,250");
    expect(r.querySelector("i")?.textContent).toBe("Oct 1");
    expect(r.querySelector("u")?.textContent).toBe("2");
    expect(r.querySelector("s")?.textContent).toBe("Give again");
    expect(r.querySelector("em")).toBeNull();
    expect(r.querySelector("span")?.textContent).toBe("kept");
    expect(r.querySelector("a")).toBeNull();
    expect(r.innerHTML).not.toContain("data-ct-");
  });
  it("old backend (no v2 fields): headline/body/gift elements removed, nothing throws", () => {
    page(
      '<div data-impact-region="hero"></div><template data-impact-for="hero"><div><h1 data-ct-text="headline">H</h1><p data-ct-text="body">B</p><p data-ct-text="story"></p>' +
        '<b data-ct-text="lastGift">G</b><ul><li data-ct-each="gifts"><span data-ct-text="amount"></span></li></ul><a data-ct-href="next">n</a></div></template>',
    );
    const v = viewOf({ hero: { firstName: "Ada", story: "Only story." }, donor: undefined, nextStep: { text: "t", href: null }, rev: undefined });
    expect(() => paintRegions(document, v, DONATE)).not.toThrow();
    const r = region();
    expect(r.querySelector("h1")).toBeNull();
    expect(r.querySelector("b")).toBeNull();
    expect(r.querySelectorAll("p")).toHaveLength(1);
    expect(r.querySelector("li")).toBeNull();
    expect(r.querySelector("a")).toBeNull();
    expect(r.textContent).toBe("Only story.");
  });
  it("records: fields, limit, photo via safeUrl, classes", () => {
    page(
      '<div data-impact-region="hero"></div><template data-impact-for="hero"><ul>' +
        '<li data-ct-each="records" data-ct-limit="2"><img data-ct-photo alt="" /><b data-ct-text="record"></b><i data-ct-text="count"></i><u data-ct-text="unit"></u><s data-ct-text="date"></s><em data-ct-text="note"></em><small data-ct-text="kind"></small></li></ul></template>',
    );
    paintRegions(document, viewOf(), DONATE);
    const items = region().querySelectorAll("li");
    expect(items).toHaveLength(2);
    const [a, b] = [items[0] as HTMLElement, items[1] as HTMLElement];
    expect(a.classList.contains("ct-record")).toBe(true);
    expect(a.getAttribute("data-ct-kind")).toBe("record");
    expect(a.querySelector("b")?.textContent).toBe("80 meals");
    expect(a.querySelector("img")?.getAttribute("src")).toBe("https://img.test/a.jpg");
    expect(a.querySelector("img")?.getAttribute("alt")).toBe("Served lunch");
    expect(a.querySelector("em")?.textContent).toBe("Served lunch");
    expect(b.querySelector("b")?.textContent).toBe("1 volunteer shift");
    expect(b.querySelector("u")?.textContent).toBe("volunteer shift");
    expect(b.querySelector("img")).toBeNull();
    expect(b.querySelector("em")).toBeNull();
  });
  it("estimates always say about; count/record/anything else is removed", () => {
    page(
      '<div data-impact-region="hero"></div><template data-impact-for="hero"><ul>' +
        '<li data-ct-each="estimates"><img data-ct-photo><b data-ct-text="count"></b><i data-ct-text="record"></i><u data-ct-text="note"></u><s data-ct-text="date"></s><span data-ct-text="estimate"></span><small data-ct-text="unit"></small></li>' +
        '<li data-ct-each="sinceEstimates"><span data-ct-text="estimate"></span></li></ul></template>',
    );
    paintRegions(document, viewOf({ estimates: [{ unit: "meals", approxQuantity: 26 }, { unit: "meals", approxQuantity: 1 }] }), DONATE);
    const items = Array.from(region().querySelectorAll("li"));
    expect(items).toHaveLength(3);
    expect(items[0]?.querySelector("span")?.textContent).toBe("about 26 meals");
    expect(items[1]?.querySelector("span")?.textContent).toBe("about 1 meal");
    expect(items[2]?.querySelector("span")?.textContent).toBe("about 3 meals");
    for (const li of items) {
      expect(li.classList.contains("ct-estimate")).toBe(true);
      expect(li.classList.contains("ct-record")).toBe(false);
      expect(li.getAttribute("data-ct-kind")).toBe("estimate");
      for (const t of ["b", "i", "u", "s", "img"]) expect(li.querySelector(t)).toBeNull();
    }
    expect(items[0]?.querySelector("small")?.textContent).toBe("meals");
  });
  it("gift items and since lists", () => {
    page(
      '<div data-impact-region="hero"></div><template data-impact-for="hero"><ul><li data-ct-each="gifts"><b data-ct-text="amount"></b><i data-ct-text="date"></i><u data-ct-text="count"></u></li></ul>' +
        '<p data-ct-each="sinceRecords"><b data-ct-text="record"></b></p><p data-ct-text="sinceDate"></p></template>',
    );
    paintRegions(document, viewOf(), DONATE);
    const gifts = region().querySelectorAll("li");
    expect(gifts).toHaveLength(2);
    expect(gifts[0]?.querySelector("b")?.textContent).toBe("$1,250");
    expect(gifts[1]?.querySelector("b")?.textContent).toBe("$25");
    expect(gifts[0]?.querySelector("i")?.textContent).toBe("Oct 1");
    expect(gifts[0]?.getAttribute("data-ct-kind")).toBe("gift");
    expect(gifts[0]?.querySelector("u")).toBeNull();
    expect(region().textContent).toContain("1 meal");
    expect(region().textContent).toContain("Oct 18");
  });
});

describe("links", () => {
  const tpl = (inner: string): string => '<div data-impact-region="hero"></div><template data-impact-for="hero"><div>' + inner + "</div></template>";

  it("API next href, then host fallback by kind, else removed", () => {
    page(tpl('<a data-ct-href="next" data-ct-href-give-again="#again" href="x">n</a>'));
    paintRegions(document, viewOf(), DONATE);
    expect(region().querySelector("a")?.getAttribute("href")).toBe("/donate");
    expect(region().querySelector("a")?.hasAttribute("data-ct-href-give-again")).toBe(false);

    page(tpl('<a data-ct-href="next" data-ct-href-volunteer="#volunteer" href="x">n</a>'));
    paintRegions(document, viewOf({ nextStep: { kind: "volunteer", text: "Help", href: null } }), DONATE);
    expect(region().querySelector("a")?.getAttribute("href")).toBe("#volunteer");

    page(tpl('<a data-ct-href="nextHref" data-ct-href-share="about.html#help">n</a>'));
    paintRegions(document, viewOf({ nextStep: { kind: "share", text: "Share", href: null } }), DONATE);
    expect(region().querySelector("a")?.getAttribute("href")).toBe("about.html#help");

    page(tpl('<p>keep</p><a data-ct-href="next" data-ct-href-share="#s">n</a>'));
    paintRegions(document, viewOf({ nextStep: { kind: "volunteer", text: "Help", href: null } }), DONATE);
    expect(region().querySelector("a")).toBeNull();
  });
  it("rejects javascript: in API hrefs and host hrefs", () => {
    page(tpl('<p>keep</p><a data-ct-href="next" data-ct-href-share="javascript:alert(1)">n</a>'));
    paintRegions(document, viewOf({ nextStep: { kind: "share", text: "Share", href: "javascript:alert(1)" } }), DONATE);
    expect(region().querySelector("a")).toBeNull();
    page(tpl('<p>keep</p><a data-ct-href="next" data-ct-href-share=" data:text/html,x">n</a>'));
    paintRegions(document, viewOf({ nextStep: { kind: "share", text: "Share", href: null } }), DONATE);
    expect(region().querySelector("a")).toBeNull();
  });
  it("rejects javascript: photo URLs", () => {
    page(tpl('<ul><li data-ct-each="records"><img data-ct-photo><span data-ct-text="count"></span></li></ul>'));
    paintRegions(document, viewOf({ photos: [{ logId: "a", url: "javascript:alert(1)" }, { logId: "b", url: "//evil.test/x.png" }] }), DONATE);
    expect(region().querySelector("img")).toBeNull();
  });
  it("data-ct-href=donate and donate links inside clones", () => {
    page(tpl('<a data-ct-href="donate" href="x">d</a><a data-impact-donate href="donate.html">Give</a>'));
    paintRegions(document, viewOf(), DONATE);
    const links = region().querySelectorAll("a");
    expect(links[0]?.getAttribute("href")).toBe(DONATE);
    expect(links[1]?.getAttribute("href")).toBe(DONATE);
    expect(links[1]?.hasAttribute("data-impact-donate")).toBe(true);
  });
  it("no donate URL configured: donate ct-href removed, host donate href kept", () => {
    page(tpl('<p>keep</p><a data-ct-href="donate">d</a><a data-impact-donate href="donate.html">Give</a>'));
    paintRegions(document, viewOf(), "");
    const links = region().querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("donate.html");
  });
});

describe("hooks", () => {
  it("sets html attributes and emits ready with only state and variants", () => {
    page("");
    const v = viewOf();
    setHooks(document, v);
    expect(document.documentElement.hasAttribute("data-impact-active")).toBe(true);
    expect(document.documentElement.getAttribute("data-impact-donor")).toBe("just_gave");
    let detail: unknown = null;
    document.addEventListener("chartitable:ready", (e) => {
      detail = (e as CustomEvent).detail;
    });
    announceReady(document, v, { hero: "fresh" });
    expect(detail).toEqual({ state: "just_gave", variants: { hero: "fresh" } });
    const json = JSON.stringify(detail);
    expect(json).not.toContain("Ada");
    expect(json).not.toContain("http");
  });
  it("no donor state: no donor attribute, state null", () => {
    page("");
    const v = viewOf({ donor: undefined });
    setHooks(document, v);
    expect(document.documentElement.hasAttribute("data-impact-donor")).toBe(false);
    let detail: unknown = null;
    document.addEventListener("chartitable:ready", (e) => {
      detail = (e as CustomEvent).detail;
    });
    announceReady(document, v, {});
    expect(detail).toEqual({ state: null, variants: {} });
  });
});
