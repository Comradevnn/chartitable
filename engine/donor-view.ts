// GET /donor-view assembly (T7b). Pure TS, no Convex imports.
//
// The response is a whitelist: hero, records, estimates, sinceLastVisit, nextStep, photos.
// Never email, donorId, or anything about other donors. Narrative text is re-checked by guard()
// here as a second line of defense; a rejected narrative is replaced by the deterministic template.
import { buildFacts } from "./facts";
import { guard } from "./guard";
import { templateFallback } from "./template";
import { verifyToken } from "./token";
import { CHARITY_IDS } from "./types";
import type {
  Allocation,
  Charity,
  Donation,
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

export function buildDonorView(input: {
  context: DonorViewContext;
  previousVisitAt: number | null;
  narrative: NarrativeResult;
  donateHref: string | null;
  timeZone?: string;
}): DonorView {
  const { context, previousVisitAt, narrative, donateHref, timeZone } = input;
  const base = narrativeFacts(context);

  // Defensive re-check: nothing unchecked ever reaches the donor.
  let output = narrative.output;
  let source: "claude" | "template" = narrative.source;
  if (!guard(output, base).ok) {
    output = templateFallback(base);
    source = "template";
  }

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

  const kind = output.nextStep.kind;
  return {
    recognized: true,
    hero: { firstName: base.donorFirstName, story: output.story, source },
    sinceLastVisit,
    nextStep: {
      kind,
      text: output.nextStep.text,
      href: kind === "give_again" || kind === "give_monthly" ? donateHref : null,
    },
    records: base.records,
    estimates: base.estimates,
    photos,
  };
}
