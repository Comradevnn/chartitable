// One condition grammar for data-impact-requires, data-impact-when and data-ct-if:
// `|` = OR, `+` = AND, `!` prefix = NOT. Unknown keys make their term false.
import { safeUrl } from "./safe";
import { scalar, type View } from "./view";

const MAX_LEN = 120;
const SCALARS = ["firstName", "story", "body", "headline", "sinceDate"];

export function evalExpr(expr: string, view: View): boolean {
  if (expr.length > MAX_LEN) return false;
  return expr.split("|").some((and) => and.split("+").every((term) => evalTerm(term, view)));
}

function evalTerm(raw: string, view: View): boolean {
  let term = raw.trim();
  let negate = false;
  while (term.charAt(0) === "!") {
    negate = !negate;
    term = term.slice(1).trim();
  }
  const value = evalKey(term, view);
  // Unknown key: the term is false even when negated, so a typo hides content, never shows it.
  return value === null ? false : value !== negate;
}

function evalKey(key: string, view: View): boolean | null {
  const colon = key.indexOf(":");
  if (colon > 0) {
    const name = key.slice(colon + 1);
    const donor = view.donor;
    const head = key.slice(0, colon);
    if (head === "state" && name) return !!donor && donor.state === name;
    if (head === "trait" && name) return !!donor && donor.traits.indexOf(name) !== -1;
    return null;
  }
  const since = view.since;
  const sinceRecords = since ? since.records.length : 0;
  const sinceEstimates = since ? since.estimates.length : 0;
  switch (key) {
    case "records":
      return view.records.length > 0;
    case "estimates":
      return view.estimates.length > 0;
    case "since":
      return sinceRecords + sinceEstimates > 0;
    case "sinceRecords":
      return sinceRecords > 0;
    case "sinceEstimates":
      return sinceEstimates > 0;
    case "photos":
      return view.photos.length > 0;
    case "next":
      return !!view.next;
    case "nextHref":
      return !!view.next && !!view.next.href && safeUrl(view.next.href) !== null;
    case "gifts":
      return !!view.donor && view.donor.gifts.length > 0;
    case "thin":
      return view.records.length === 0 && view.estimates.length === 0;
    case "repeat":
      return !!view.donor && view.donor.giftCount !== null && view.donor.giftCount >= 2;
  }
  return SCALARS.indexOf(key) !== -1 ? scalar(view, key) !== null : null;
}
