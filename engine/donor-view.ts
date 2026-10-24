// GET /donor-view assembly (T7b). Pure TS, no Convex imports.
//
// The response is a whitelist: hero, records, estimates, sinceLastVisit, nextStep, photos.
// Never email, donorId, or anything about other donors. Narrative text is re-checked by guard()
// here as a second line of defense; a rejected narrative is replaced by the deterministic template.
import { DONOR_GIFTS_MAX, LIVE_POLL_MS } from "./config";
import { classifyDonor, computeRev, headlineFor, nextStepKindFor, storyBody } from "./donor-state";
import { buildFacts, dateLabel } from "./facts";
import { guard } from "./guard";
import { nextStepFor } from "./next-step";
import { templateFallback } from "./template";
import { verifyToken } from "./token";
import { CHARITY_IDS } from "./types";
import type {
  Allocation,
  Charity,
  Donation,
  DonationFact,
  Donor,
  DonorFacts,
  DonorView,
  ImpactLog,
  NarrativeResult,
  TimeWindow,
} from "./types";

export interface DonorViewContext {
  charity: Charity;
  donor: Donor;
  donations: Donation[];
  logs: ImpactLog[];
  allocations: Allocation[];
  window: TimeWindow;
  photos: { logId: string; url: string }[];
}

/** What Claude sees: buildFacts(...context, lastVisitAt: null). Stable across visits (hash only changes with data). */
export function narrativeFacts(ctx: DonorViewContext): DonorFacts {
  return buildFacts({
    charity: ctx.charity,
    donor: ctx.donor,
    donations: ctx.donations,
    logs: ctx.logs,
    allocations: ctx.allocations,
    window: ctx.window,
    lastVisitAt: null,
  });
}

export type ParsedRequest = { ok: true; donorId: string; charityId: Charity["id"] } | { ok: false };

/**
 * `charity` query param must be a known charity; Authorization must be "Bearer <token>";
 * the token must verify and be issued for that same charity. Any problem (or a null secret) → {ok:false}.
 */
export async function parseDonorViewRequest(
  url: string,
  authorization: string | null,
  secret: string | null,
  now: number,
): Promise<ParsedRequest> {
  try {
    if (!secret || !authorization) return { ok: false };
    const charityParam = new URL(url).searchParams.get("charity");
    if (!charityParam || !(CHARITY_IDS as readonly string[]).includes(charityParam)) return { ok: false };
    const m = /^Bearer ([^\s]+)$/.exec(authorization.trim());
    if (!m || !m[1]) return { ok: false };
    const result = await verifyToken(m[1], secret, now);
    if (!result.ok) return { ok: false };
    if (result.payload.charityId !== charityParam) return { ok: false };
    return { ok: true, donorId: result.payload.donorId, charityId: result.payload.charityId };
  } catch {
    return { ok: false };
  }
}

// just_gave and news headlines describe the moment, so they stay deterministic.
const CLAUDE_HEADLINE_STATES: ReadonlySet<string> = new Set(["first_impact", "repeat", "returning"]);

const DEFAULT_TIME_ZONE = "America/Los_Angeles"; // same default as engine/facts.ts

export function buildDonorView(input: {
  context: DonorViewContext;
  previousVisitAt: number | null;
  narrative: NarrativeResult;
  donateHref: string | null;
  timeZone?: string;
  /** v2: all-time gifts of this donor at this charity. Falls back to context.donations for this donor. */
  ownGifts?: Donation[];
  /** v2: how many times this donor visited in the last 30 days (default 0). */
  visitsInLast30Days?: number;
  /** v2: when the stored narrative was written, for `rev` (default null). */
  narrativeAt?: number | null;
}): DonorView {
  const { context, previousVisitAt, narrative, donateHref, timeZone } = input;
  const visitsInLast30Days = input.visitsInLast30Days ?? 0;
  const narrativeAt = input.narrativeAt ?? null;
  const now = context.window.to;
  const base = narrativeFacts(context);

  // Defensive re-check: nothing unchecked ever reaches the donor.
  let output = narrative.output;
  let source: "claude" | "template" = narrative.source;
  if (!guard(output, base).ok) {
    output = templateFallback(base);
    source = "template";
  }
  // T30: Claude's headline (already inside the guard verdict above) is used only for these states.
  const claudeHeadline = source === "claude" && typeof output.headline === "string" ? output.headline.trim() : "";

  const sinceLastVisit = buildFacts({
    charity: context.charity,
    donor: context.donor,
    donations: context.donations,
    logs: context.logs,
    allocations: context.allocations,
    window: context.window,
    lastVisitAt: previousVisitAt,
    ...(timeZone ? { timeZone } : {}),
  }).sinceLastVisit;

  const recordIds = new Set(base.records.map((r) => r.logId));
  const photos = context.photos.filter((p) => recordIds.has(p.logId)).map((p) => ({ logId: p.logId, url: p.url }));

  // ---- v2: donor state, copy and change marker ----
  const ownGifts = (input.ownGifts ?? context.donations)
    .filter((d) => d.donorId === context.donor.id && d.charityId === context.charity.id)
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  const { state, traits } = classifyDonor({
    gifts: ownGifts,
    facts: { ...base, sinceLastVisit },
    visitsInLast30Days,
    photosCount: photos.length,
    now,
  });
  const tz = timeZone ?? DEFAULT_TIME_ZONE;
  const gifts: DonationFact[] = ownGifts.slice(0, DONOR_GIFTS_MAX).map((g) => ({
    amountDollars: g.amountCents / 100,
    dateLabel: dateLabel(g.createdAt, tz),
  }));

  const kind = nextStepKindFor(state);
  const step = nextStepFor(kind, context.charity.name);
  const text = output.nextStep.kind === kind ? output.nextStep.text : step.text;

  let newestLog: ImpactLog | null = null;
  for (const l of context.logs) {
    if (!newestLog || l.loggedAt > newestLog.loggedAt || (l.loggedAt === newestLog.loggedAt && l.id > newestLog.id)) {
      newestLog = l;
    }
  }
  const rev = computeRev({
    newestLogId: newestLog?.id ?? null,
    narrativeAt,
    newestGiftId: ownGifts[0]?.id ?? null,
  });

  return {
    recognized: true,
    hero: {
      firstName: base.donorFirstName,
      story: output.story,
      source,
      headline:
        claudeHeadline !== "" && CLAUDE_HEADLINE_STATES.has(state)
          ? claudeHeadline
          : headlineFor(state, base.donorFirstName, context.charity.name),
      body: storyBody(output.story),
    },
    sinceLastVisit,
    nextStep: {
      kind,
      text,
      href: kind === "give_again" || kind === "give_monthly" ? donateHref : null,
      label: step.label,
    },
    records: base.records,
    estimates: base.estimates,
    photos,
    donor: { state, traits, gifts, giftCount: ownGifts.length },
    rev,
    live: { pollMs: LIVE_POLL_MS },
  };
}
