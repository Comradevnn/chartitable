// Next-step copy per kind (T24, contract v2). Pure TS. Texts follow engine/template.ts: gentle,
// no numbers, no pressure, and they pass guard() for any facts that carry the charity name.
import type { NextStepKind } from "./types";

const LABELS: Record<NextStepKind, string> = {
  give_again: "Give again",
  give_monthly: "Explore monthly giving",
  volunteer: "See volunteer shifts",
  share: "Share the update",
};

export function nextStepFor(kind: NextStepKind, charityName: string): { text: string; label: string } {
  const label = LABELS[kind];
  switch (kind) {
    case "give_again":
      return { label, text: `If you would like to, a future gift to ${charityName} helps keep the next update going.` };
    case "give_monthly":
      return { label, text: `If it suits you, ask ${charityName} about giving on a regular basis.` };
    case "volunteer":
      return { label, text: `If you have time, ask ${charityName} about volunteering.` };
    case "share":
      return { label, text: `If it feels right, share ${charityName}'s latest update with a friend.` };
  }
}
