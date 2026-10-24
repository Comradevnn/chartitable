// Deterministic fact-check guard (T6a, D8). Pure TS, no Convex imports.
//
// The honesty rule is ENFORCED here, not just prompted: any narrative that contains a number,
// name, unlabeled estimate, percentage, or pressure language not supported by the facts payload
// is rejected, and the caller falls back to the template. False rejections are acceptable
// (they fail safe); false accepts are not.

import type { DonorFacts, GuardResult, NextStepKind, RecordFact } from "./types";

const KIND_TABLE: Record<NextStepKind, true> = {
  give_again: true,
  give_monthly: true,
  volunteer: true,
  share: true,
};
export const NEXT_STEP_KINDS = Object.keys(KIND_TABLE) as NextStepKind[];

export const MAX_STORY_CHARS = 700;
export const MAX_NEXT_STEP_CHARS = 220;

// ---------------------------------------------------------------------------
// Tokenizing and number extraction
// ---------------------------------------------------------------------------

export interface Token {
  text: string;
  index: number; // offset in the source text
  type: "num" | "word";
}

export interface NumberMention {
  value: number; // NaN for vague plurals like "hundreds" (never allowed)
  raw: string;
  tokenIndex: number; // index into tokenize(text)
  percent: boolean;
}

const TOKEN_RE = /\$?\d+(?:,\d{3})*(?:\.\d+)?%?|\p{L}[\p{L}\p{M}]*(?:['’\-][\p{L}\p{M}]+)*/gu;

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const t = m[0];
    out.push({ text: t, index: m.index ?? 0, type: /^\$?\d/.test(t) ? "num" : "word" });
  }
  return out;
}

const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
// "one" and "a" are deliberately not checked on their own.
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, ...TENS,
  hundred: 100, thousand: 1000, million: 1e6, billion: 1e9, dozen: 12,
  twice: 2, thrice: 3, double: 2, triple: 3, half: 0.5,
  third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  // vague plural quantities can never be backed by the facts
  dozens: NaN, hundreds: NaN, thousands: NaN, millions: NaN,
};

/** Every numeric claim in `text`: digits ("1,200", "12.5", "$25", "25%") and number words. */
export function extractNumbers(text: string): NumberMention[] {
  const tokens = tokenize(text);
  const out: NumberMention[] = [];
  tokens.forEach((tok, tokenIndex) => {
    if (tok.type === "num") {
      const percent = tok.text.endsWith("%");
      const cleaned = tok.text.replace(/[$%,]/g, "");
      out.push({ value: Number(cleaned), raw: tok.text, tokenIndex, percent });
      return;
    }
    const norm = tok.text.toLowerCase().replace(/’/g, "'").replace(/'s$/, "");
    const parts = norm.split("-");
    const [a, b] = parts;
    if (parts.length === 2 && a !== undefined && b !== undefined && a in TENS && b in ONES) {
      out.push({ value: (TENS[a] as number) + (ONES[b] as number), raw: tok.text, tokenIndex, percent: false });
      return;
    }
    for (const p of parts) {
      if (Object.hasOwn(NUMBER_WORDS, p)) {
        out.push({ value: NUMBER_WORDS[p] as number, raw: tok.text, tokenIndex, percent: false });
      }
    }
  });
  return out;
}

/** True if the text expresses a percentage in any form. */
export function hasPercentage(text: string): boolean {
  return /[%‰]|\bper\s?cent(?:age)?s?\b|\bpercent(?:age)?s?\b/i.test(text);
}

// ---------------------------------------------------------------------------
// Allowed values derived from facts
// ---------------------------------------------------------------------------

const key = (n: number): number => Math.round(n * 1e6) / 1e6;

function recordsOf(facts: DonorFacts): RecordFact[] {
  return [...facts.records, ...(facts.sinceLastVisit?.records ?? [])];
}

/** All strings in facts that Claude may legitimately echo (names, units, notes, date labels). */
function allowedStrings(facts: DonorFacts): string[] {
  const s: string[] = [facts.charityName];
  if (facts.donorFirstName) s.push(facts.donorFirstName);
  for (const d of facts.donations) s.push(d.dateLabel);
  for (const r of recordsOf(facts)) {
    s.push(r.unit, r.dateLabel);
    if (r.note) s.push(r.note);
  }
  for (const e of [...facts.estimates, ...(facts.sinceLastVisit?.estimates ?? [])]) s.push(e.unit);
  if (facts.sinceLastVisit) s.push(facts.sinceLastVisit.sinceDateLabel);
  return s;
}

export interface AllowedNumbers {
  /** Numbers that are records, gifts, or part of any fact string (dates, notes, units, names). */
  other: Set<number>;
  /** approxQuantity values (estimates). */
  estimates: Set<number>;
  /** other ∪ estimates */
  all: Set<number>;
  /** Dollar amounts the donor actually gave (each gift + total). "$N" must be one of these. */
  money: Set<number>;
}

export function allowedNumbers(facts: DonorFacts): AllowedNumbers {
  const other = new Set<number>();
  const estimates = new Set<number>();
  for (const d of facts.donations) other.add(key(d.amountDollars));
  other.add(key(facts.totalGivenDollars));
  for (const r of recordsOf(facts)) other.add(key(r.count));
  for (const e of [...facts.estimates, ...(facts.sinceLastVisit?.estimates ?? [])]) {
    estimates.add(key(e.approxQuantity));
  }
  for (const s of allowedStrings(facts)) {
    for (const m of extractNumbers(s)) if (!Number.isNaN(m.value)) other.add(key(m.value));
  }
  const money = new Set<number>([key(facts.totalGivenDollars), ...facts.donations.map((d) => key(d.amountDollars))]);
  return { other, estimates, all: new Set([...other, ...estimates]), money };
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

const CALENDAR_WORDS = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  "Mon", "Tue", "Tues", "Wed", "Thu", "Thur", "Thurs", "Fri", "Sat", "Sun",
  "January", "February", "March", "April", "May", "June", "July", "August", "September",
  "October", "November", "December",
  "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sep", "Sept", "Oct", "Nov", "Dec",
];

const ALWAYS_ALLOWED = new Set<string>([...CALENDAR_WORDS, "I", "I'm", "I've", "I'll", "I'd"]);

/** Common words that may be capitalized ONLY as the first word of a sentence (or after a colon/quote). */
export const SENTENCE_STARTERS: ReadonlySet<string> = new Set([
  "The", "Your", "You", "You're", "You've", "You'll", "Yours", "This", "That", "These", "Those",
  "Thank", "Thanks", "We", "We're", "We've", "Our", "Ours", "It", "Its", "Here", "There",
  "Since", "Last", "Each", "Every", "Together", "Today", "And", "But", "So", "With", "Because",
  "If", "When", "Over", "In", "On", "At", "From", "For", "A", "An", "About", "What", "Even",
  "Consider", "Want", "Would", "Could", "Maybe", "Sharing", "Share", "Giving", "Give",
  "Volunteer", "Volunteering", "Monthly", "Another", "Hello", "Hi", "Dear", "Most", "More",
  "Recently", "Nothing", "Please", "Whether", "While", "As", "Of", "To", "By", "After", "Before",
  "Also", "Still", "Just", "Once", "Perhaps", "Let", "One", "Some", "Many", "Meanwhile", "Now",
  "Between", "Through", "During", "Within", "Across", "Whatever", "Anyone", "Everyone",
  "Someone", "Small", "Whenever", "Should", "Can", "Do", "Does", "Not", "No", "Yes", "All",
  "Both", "Either", "Their", "They",
]);

function normalizeNameToken(tok: string): string {
  return tok.replace(/’/g, "'").replace(/'s$/i, "").replace(/'$/, "");
}

function allowedNameTokens(facts: DonorFacts): Set<string> {
  const out = new Set<string>();
  for (const s of allowedStrings(facts)) {
    for (const t of tokenize(s)) {
      if (t.type !== "word") continue;
      out.add(normalizeNameToken(t.text));
      for (const p of normalizeNameToken(t.text).split("-")) out.add(p);
    }
  }
  return out;
}

function isSentenceStart(text: string, index: number): boolean {
  const before = text.slice(0, index);
  const trimmed = before.trimEnd();
  if (trimmed === "") return true;
  if (/\n/.test(before.slice(trimmed.length))) return true;
  return /[.!?:"“”‘'(]$/.test(trimmed);
}

/** Capitalized words in `text` that are not backed by facts, calendar words, or sentence-start filler. */
export function findDisallowedNames(text: string, facts: DonorFacts): string[] {
  const allowed = allowedNameTokens(facts);
  const bad: string[] = [];
  for (const tok of tokenize(text)) {
    if (tok.type !== "word") continue;
    const norm = normalizeNameToken(tok.text);
    const parts = norm.split("-");
    parts.forEach((part, i) => {
      if (!/^\p{Lu}/u.test(part)) return;
      if (ALWAYS_ALLOWED.has(part) || allowed.has(part)) return;
      if (i === 0 && SENTENCE_STARTERS.has(part) && isSentenceStart(text, tok.index)) return;
      bad.push(part);
    });
  }
  return bad;
}

// ---------------------------------------------------------------------------
// Other checks
// ---------------------------------------------------------------------------

const PRESSURE_PATTERNS: { label: string; re: RegExp }[] = [
  { label: "guilt", re: /guilt/ },
  { label: "only you", re: /\bonly you\b/ },
  { label: "without you", re: /\bwithout you\b/ },
  { label: "don't let", re: /\bdon't let\b/ },
  { label: "urgent", re: /urgent/ },
  { label: "before it's too late", re: /before it'?s too late/ },
  { label: "too late", re: /\btoo late\b/ },
  { label: "must", re: /\bmust\b/ },
  { label: "need you", re: /\bneed you\b/ },
  { label: "last chance", re: /\blast chance\b/ },
  { label: "desperate", re: /desperat/ },
  { label: "hurry", re: /\bhurry\b/ },
  { label: "act now", re: /\bact now\b/ },
  { label: "act fast", re: /\bact fast\b/ },
  { label: "have to", re: /\bhave to\b/ },
  { label: "need to", re: /\bneeds? to\b/ },
  { label: "running out", re: /\brunning out\b/ },
  { label: "last call", re: /\blast call\b/ },
  { label: "deadline", re: /\bdeadline/ },
  { label: "limited time", re: /\blimited time\b/ },
  { label: "don't miss", re: /\bdon't miss\b/ },
  { label: "now or never", re: /\bnow or never\b/ },
];

export function findPressureWords(text: string): string[] {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");
  return PRESSURE_PATTERNS.filter((p) => p.re.test(t)).map((p) => p.label);
}

const ESTIMATE_CONTEXT = /^(?:estimat\w*|approximately|roughly)$/i;

/** True if the number mention carries an "about" (3 words before) or estimate/approximately/roughly (3 words around). */
function isLabeledEstimate(tokens: Token[], tokenIndex: number): boolean {
  for (let i = Math.max(0, tokenIndex - 3); i < tokenIndex; i++) {
    if (tokens[i]?.text.toLowerCase() === "about") return true;
  }
  for (let i = Math.max(0, tokenIndex - 3); i <= Math.min(tokens.length - 1, tokenIndex + 3); i++) {
    if (i !== tokenIndex && ESTIMATE_CONTEXT.test(tokens[i]?.text ?? "")) return true;
  }
  return false;
}

// A sentence that credits the donor ("your gift provided 80 meals") must label any number that
// is also an estimate, even if the same number happens to be a record (e.g. a sole donor's share).
const DONOR_REF = /\b(?:you|your|yours)\b/i;
const ATTRIBUTION =
  /\b(?:gifts?|donations?|share|helped|help|provided|provides|funded|funds|covered|covers|supported|support|made possible|contributed|contribution|thanks to)\b/i;

function sentenceAround(text: string, index: number): string {
  let start = 0;
  for (const m of text.slice(0, index).matchAll(/[.!?](?=\s|$)/g)) start = (m.index ?? 0) + 1;
  const rest = text.slice(index).search(/[.!?](?=\s|$)/);
  return text.slice(start, rest === -1 ? text.length : index + rest + 1);
}

function creditsDonor(sentence: string, facts: DonorFacts): boolean {
  const refersToDonor =
    DONOR_REF.test(sentence) || (facts.donorFirstName !== null && sentence.includes(facts.donorFirstName));
  // Any sentence about the donor counts: "Your generosity fed 25 meals" credits them with no
  // attribution verb. Rare false rejects (a record that equals an estimate) fall back to the template.
  return refersToDonor || ATTRIBUTION.test(sentence);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function sameKeys(obj: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(obj).sort();
  return keys.length === expected.length && [...expected].sort().every((k, i) => k === keys[i]);
}

// ---------------------------------------------------------------------------
// guard()
// ---------------------------------------------------------------------------

export function guard(output: unknown, facts: DonorFacts): GuardResult {
  const reasons = new Set<string>();

  // a. Shape
  if (!isPlainObject(output)) return { ok: false, reasons: ["shape: output is not an object"] };
  if (!sameKeys(output, ["story", "nextStep"])) {
    reasons.add("shape: expected exactly the keys story and nextStep");
  }
  const story = output.story;
  const next = output.nextStep;
  if (typeof story !== "string" || story.trim() === "") reasons.add("shape: story must be a non-empty string");
  else if (story.length > MAX_STORY_CHARS) reasons.add(`shape: story longer than ${MAX_STORY_CHARS} characters`);
  if (!isPlainObject(next)) {
    reasons.add("shape: nextStep must be an object");
  } else {
    if (!sameKeys(next, ["kind", "text"])) reasons.add("shape: nextStep must have exactly the keys kind and text");
    if (typeof next.kind !== "string" || !NEXT_STEP_KINDS.includes(next.kind as NextStepKind)) {
      reasons.add("shape: nextStep.kind is not a valid kind");
    }
    if (typeof next.text !== "string" || next.text.trim() === "") reasons.add("shape: nextStep.text must be a non-empty string");
    else if (next.text.length > MAX_NEXT_STEP_CHARS) {
      reasons.add(`shape: nextStep.text longer than ${MAX_NEXT_STEP_CHARS} characters`);
    }
  }
  if (reasons.size > 0 || typeof story !== "string" || !isPlainObject(next) || typeof next.text !== "string") {
    return { ok: false, reasons: [...reasons] };
  }

  const texts: { name: "story" | "nextStep"; text: string }[] = [
    { name: "story", text: story },
    { name: "nextStep", text: next.text },
  ];
  const allowed = allowedNumbers(facts);

  let storyHasEstimate = false;
  for (const { name, text } of texts) {
    // Unicode digits/numerals outside ASCII could dodge number extraction.
    if (/(?![0-9])\p{N}/u.test(text)) reasons.add(`${name}: contains non-ASCII numerals`);
    if (/https?:|www\.|@/i.test(text)) reasons.add(`${name}: contains a link or address`);
    if (/[<>]/.test(text)) reasons.add(`${name}: contains markup`);

    // b. Numbers (percentages are never allowed)
    if (hasPercentage(text)) reasons.add(`${name}: percentage not allowed`);
    const tokens = tokenize(text);
    for (const m of extractNumbers(text)) {
      if (Number.isNaN(m.value) || !allowed.all.has(key(m.value))) {
        reasons.add(`invented number: ${m.raw}`);
        continue;
      }
      const v = key(m.value);
      // Dollar amounts are gifts, never estimates: "$N" must be something the donor gave.
      if (m.raw.startsWith("$")) {
        if (!allowed.money.has(v)) reasons.add(`invented amount: ${m.raw}`);
        continue;
      }
      // d. Estimate labels
      const isEstimateValue = allowed.estimates.has(v);
      const isRecordValue = allowed.other.has(v);
      const labeled = isLabeledEstimate(tokens, m.tokenIndex);
      if (isEstimateValue && !isRecordValue && !labeled) reasons.add(`unlabeled estimate: ${m.raw}`);
      if (isEstimateValue && isRecordValue && !labeled) {
        const at = tokens[m.tokenIndex]?.index ?? 0;
        if (creditsDonor(sentenceAround(text, at), facts)) reasons.add(`unlabeled estimate credited to donor: ${m.raw}`);
      }
      if (name === "story" && isEstimateValue && (!isRecordValue || labeled)) storyHasEstimate = true;
    }

    // c. Names
    for (const w of findDisallowedNames(text, facts)) reasons.add(`unknown name: ${w}`);

    // e. Pressure
    for (const p of findPressureWords(text)) reasons.add(`pressure language: ${p}`);
  }

  // The story must say what an estimate is (D1) whenever it quotes one.
  if (storyHasEstimate && facts.thinData) {
    reasons.add("thin data: story must not quote estimates");
  }
  if (storyHasEstimate) {
    if (!/\bestimat\w*/i.test(story) || !/\b(?:pooled?|proportion\w*|shares?|shared)\b/i.test(story)) {
      reasons.add("story quotes an estimate without explaining it is a proportional share of pooled gifts");
    }
  }

  return reasons.size === 0 ? { ok: true } : { ok: false, reasons: [...reasons] };
}
