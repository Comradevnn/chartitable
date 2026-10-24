// Fills a cloned template with facts. API strings go through textContent only;
// API URLs go through safeUrl. Host-authored attributes are trusted markup.
import { evalExpr } from "./expr";
import { hostHref, money, safeUrl, unitFor } from "./safe";
import { scalar, type EstimateFact, type GiftFact, type RecordFact, type View } from "./view";

type Item = RecordFact | EstimateFact | GiftFact;
type Kind = "record" | "estimate" | "gift";

function items(view: View, key: string): { list: Item[]; kind: Kind } | null {
  const since = view.since;
  switch (key) {
    case "records":
      return { list: view.records, kind: "record" };
    case "sinceRecords":
      return { list: since ? since.records : [], kind: "record" };
    case "estimates":
      return { list: view.estimates, kind: "estimate" };
    case "sinceEstimates":
      return { list: since ? since.estimates : [], kind: "estimate" };
    case "gifts":
      return { list: view.donor ? view.donor.gifts : [], kind: "gift" };
  }
  return null;
}

export function fillNode(root: ParentNode, view: View, donateHref: string): void {
  // Conditions first, so a removed branch never gets repeated or filled.
  for (const el of Array.from(root.querySelectorAll("[data-ct-if]"))) {
    if (!evalExpr(el.getAttribute("data-ct-if") || "", view)) el.remove();
    else el.removeAttribute("data-ct-if");
  }
  for (const proto of Array.from(root.querySelectorAll("[data-ct-each]"))) {
    const parent = proto.parentNode;
    if (!parent) continue;
    const found = items(view, proto.getAttribute("data-ct-each") || "");
    const limit = parseInt(proto.getAttribute("data-ct-limit") || "", 10);
    if (found) {
      const max = limit > 0 ? limit : found.list.length;
      for (let n = 0; n < found.list.length && n < max; n++) {
        const copy = proto.cloneNode(true) as HTMLElement;
        copy.removeAttribute("data-ct-each");
        copy.removeAttribute("data-ct-limit");
        const fact = found.list[n];
        if (fact) fillItem(copy, fact, found.kind, view);
        parent.insertBefore(copy, proto);
      }
    }
    proto.remove();
  }
  for (const el of Array.from(root.querySelectorAll("[data-ct-text]"))) {
    const value = scalar(view, el.getAttribute("data-ct-text") || "");
    if (value === null) el.remove();
    else {
      el.textContent = value;
      el.removeAttribute("data-ct-text");
    }
  }
  const kind = view.next && view.next.kind ? view.next.kind.replace(/_/g, "-") : "";
  for (const el of Array.from(root.querySelectorAll("[data-ct-href]"))) {
    const which = el.getAttribute("data-ct-href");
    let href: string | null = null;
    if (which === "donate") href = donateHref || null;
    else if (which === "next" || which === "nextHref") {
      href = view.next && view.next.href ? safeUrl(view.next.href) : null;
      if (!href && kind) {
        const own = el.getAttribute("data-ct-href-" + kind);
        href = own ? hostHref(own) : null;
      }
    }
    if (href && el instanceof HTMLAnchorElement) {
      el.setAttribute("href", href);
      if (/^https?:/i.test(href)) el.setAttribute("rel", "noopener");
      for (const name of el.getAttributeNames()) {
        if (name.indexOf("data-ct-href") === 0) el.removeAttribute(name);
      }
    } else el.remove();
  }
  if (donateHref) {
    for (const a of Array.from(root.querySelectorAll("a[data-impact-donate]"))) a.setAttribute("href", donateHref);
  }
}

function fillItem(node: HTMLElement, fact: Item, kind: Kind, view: View): void {
  node.setAttribute("data-ct-kind", kind);
  if (kind === "record") {
    node.classList.add("ct-record");
    if ("logId" in fact) node.setAttribute("data-ct-id", fact.logId);
  }
  if (kind === "estimate") node.classList.add("ct-estimate");
  for (const el of Array.from(node.querySelectorAll("[data-ct-text]"))) {
    const key = el.getAttribute("data-ct-text") || "";
    let value: string | null = null;
    if (kind === "estimate" && "approxQuantity" in fact) {
      const unit = unitFor(fact.approxQuantity, fact.unit);
      if (key === "estimate") value = "about " + fact.approxQuantity + " " + unit;
      else if (key === "unit") value = unit;
    } else if (kind === "record" && "count" in fact) {
      const unit = unitFor(fact.count, fact.unit);
      if (key === "date") value = fact.dateLabel;
      else if (key === "count") value = String(fact.count);
      else if (key === "unit") value = unit;
      else if (key === "record") value = fact.count + " " + unit;
      else if (key === "note") value = fact.note;
      else if (key === "kind") value = "Logged";
    } else if (kind === "gift" && "amountDollars" in fact) {
      if (key === "amount") value = money(fact.amountDollars);
      else if (key === "date") value = fact.dateLabel;
    }
    if (!value) el.remove();
    else {
      el.textContent = value;
      el.removeAttribute("data-ct-text");
    }
  }
  for (const img of Array.from(node.querySelectorAll("img[data-ct-photo]"))) {
    const photo = kind === "record" && "logId" in fact ? view.photos.find((p) => p.logId === fact.logId) : undefined;
    const src = photo ? safeUrl(photo.url) : null;
    if (src && img instanceof HTMLImageElement) {
      img.setAttribute("src", src);
      img.setAttribute("alt", "note" in fact && fact.note ? fact.note : "");
      img.removeAttribute("data-ct-photo");
    } else img.remove();
  }
}
