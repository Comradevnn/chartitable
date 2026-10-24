// Contract v2 regions. A region keeps the host's default markup for strangers; for a
// recognized donor the first matching <template data-impact-for="<region>"> is cloned,
// filled with facts and swapped in. Anything missing leaves the default markup alone.
import { evalExpr } from "./expr";
import { fillNode } from "./fields";
import type { View } from "./view";

export interface RegionResult {
  count: number;
  variants: Record<string, string>;
}

export function donateHrefFor(donateUrl: string, charityId: string): string {
  if (!donateUrl) return "";
  return donateUrl + (donateUrl.indexOf("?") === -1 ? "?" : "&") + "charity=" + encodeURIComponent(charityId);
}

// The only thing a stranger's page gets: hosted donate links.
export function rewriteDonate(doc: Document, href: string): void {
  if (!href) return;
  for (const node of Array.from(doc.querySelectorAll("a[data-impact-donate]"))) node.setAttribute("href", href);
}

export function paintRegions(doc: Document, view: View | null, donateHref: string): RegionResult {
  const result: RegionResult = { count: 0, variants: {} };
  if (!view) return result;
  const templates = Array.from(doc.querySelectorAll("template[data-impact-for]")) as HTMLTemplateElement[];
  for (const region of Array.from(doc.querySelectorAll("[data-impact-region]"))) {
    const name = region.getAttribute("data-impact-region");
    if (!name || region.getAttribute("data-impact-state") === "ready") continue;
    const requires = region.getAttribute("data-impact-requires");
    if (requires && requires.trim() && !evalExpr(requires, view)) continue;
    const tpl = templates.find((t) => {
      if (t.getAttribute("data-impact-for") !== name) return false;
      const when = t.getAttribute("data-impact-when");
      return when === null || evalExpr(when, view);
    });
    if (!tpl || !tpl.content) continue;
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    fillNode(frag, view, donateHref);
    if (!frag.children.length) continue;
    region.replaceChildren(frag);
    region.setAttribute("data-impact-state", "ready");
    const variant = tpl.getAttribute("data-impact-variant");
    if (variant) {
      region.setAttribute("data-impact-variant", variant);
      result.variants[name] = variant;
    }
    result.count++;
  }
  return result;
}

// html[data-impact-active] and html[data-impact-donor="<state>"].
export function setHooks(doc: Document, view: View): void {
  const root = doc.documentElement;
  root.setAttribute("data-impact-active", "");
  if (view.donor && view.donor.state) root.setAttribute("data-impact-donor", view.donor.state);
}

// The detail carries a state name and host-authored variant names, never names, numbers,
// story text or URLs.
export function announceReady(doc: Document, view: View, variants: Record<string, string>): void {
  doc.dispatchEvent(
    new CustomEvent("chartitable:ready", {
      detail: { state: view.donor ? view.donor.state : null, variants },
    }),
  );
}
