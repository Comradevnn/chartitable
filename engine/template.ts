// Deterministic, model-free narrative (T6a). Used when Claude fails or its output is rejected by guard().
// Uses only facts; every sentence is built to pass guard() (no notes echoed, no derived numbers).
//
// Next-step rule (facts carry no "gift since last visit" signal, so we key off what is observable):
//   thinData                                   -> give_again
//   sinceLastVisit has new records             -> share
//   otherwise (returning donor, nothing new)   -> volunteer

import type { DonorFacts, NarrativeOutput, RecordFact } from "./types";

function money(n: number): string {
  return Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : `$${n.toFixed(2)}`;
}

function qty(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

function describe(r: RecordFact): string {
  return `${qty(r.count)} ${r.unit}`;
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function templateFallback(facts: DonorFacts): NarrativeOutput {
  const { charityName: charity, donorFirstName: first } = facts;
  const sentences: string[] = [];

  const who = first ? `, ${first},` : "";
  if (facts.totalGivenDollars > 0) {
    sentences.push(`Thank you${who} for giving ${money(facts.totalGivenDollars)} to ${charity}.`);
  } else {
    sentences.push(`Thank you${who} for being part of ${charity}.`);
  }

  const latest = facts.records[facts.records.length - 1];

  if (facts.thinData) {
    if (latest) sentences.push(`On ${latest.dateLabel}, ${charity} logged ${describe(latest)}.`);
    else sentences.push(`More updates from ${charity} will appear here when they are logged.`);
  } else {
    if (latest) sentences.push(`On ${latest.dateLabel}, ${charity} logged ${describe(latest)}.`);
    const since = facts.sinceLastVisit;
    if (since) {
      const newest = since.records[since.records.length - 1];
      if (newest) {
        sentences.push(
          `Since your last visit on ${since.sinceDateLabel}, the latest update is ${describe(newest)} on ${newest.dateLabel}.`,
        );
      } else {
        sentences.push(`Nothing new has been logged since your last visit on ${since.sinceDateLabel}.`);
      }
    }
    if (facts.estimates.length > 0) {
      const shares = facts.estimates.map((e) => `about ${qty(e.approxQuantity)} ${e.unit}`);
      sentences.push(`By our estimate, your share comes to ${joinList(shares)}.`);
      sentences.push("These are estimates: a proportional share of pooled gifts, not a trace of your dollars.");
    }
  }

  let nextStep: NarrativeOutput["nextStep"];
  if (facts.thinData) {
    nextStep = {
      kind: "give_again",
      text: `If you would like to, a future gift to ${charity} helps keep the next update going.`,
    };
  } else if (facts.sinceLastVisit && facts.sinceLastVisit.records.length > 0) {
    nextStep = { kind: "share", text: `If it feels right, share ${charity}'s latest update with a friend.` };
  } else {
    nextStep = { kind: "volunteer", text: `If you have time, ask ${charity} about volunteering.` };
  }

  return { story: sentences.join(" "), nextStep };
}
