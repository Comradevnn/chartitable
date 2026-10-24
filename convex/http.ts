// The ONE HTTP router for the project. GET /donor-view (§5, §15).
// Bad/expired/missing token or unknown donor → { recognized: false }. Rate limit → 429 and backend
// error → 503, both { retry: true } (the token is not judged). Never returns email, donorId, or error details.
// Never logs tokens or emails.
import { httpRouter } from "convex/server";
import { computeRev } from "../engine/donor-state";
import { buildDonorView, narrativeFacts, parseDonorViewRequest } from "../engine/donor-view";
import { hashFacts } from "../engine/facts";
import { templateFallback } from "../engine/template";
import type { DonorView, NarrativeResult } from "../engine/types";
import type { DonorContext } from "./context";
import { httpAction, internal } from "./lib/builders";
import { tokenSecret } from "./lib/env";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
  Vary: "Origin",
};

function json(body: DonorView): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function pulseJson(body: { recognized: false } | { recognized: true; rev: string }): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

const NOT_RECOGNIZED: DonorView = { recognized: false };

// Rate limit or a backend error: not a verdict on the token, so no `recognized` field. The layer
// forgets a stored token only on an explicit recognized:false; here it keeps it and stays empty.
function retryLater(status: 429 | 503): Response {
  return new Response(JSON.stringify({ retry: true }), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function donateHrefFor(charityId: string): string | null {
  try {
    const base = process.env.DONATE_PAGE_URL;
    if (!base) return null;
    const u = new URL(base);
    u.searchParams.set("charity", charityId);
    return u.toString();
  } catch {
    return null;
  }
}

const http = httpRouter();

http.route({
  path: "/donor-view",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const now = Date.now();
      const parsed = await parseDonorViewRequest(
        request.url,
        request.headers.get("Authorization"),
        tokenSecret(),
        now,
      );
      if (!parsed.ok) return json(NOT_RECOGNIZED);
      const { donorId, charityId } = parsed;

      // peek=1 (live refresh): no visit row; "previous" is the visit before this page's own load.
      const peek = new URL(request.url).searchParams.get("peek") === "1";
      let visit: { limited: boolean; previousVisitAt: number | null; visitId: string | null };
      if (peek) {
        const previousVisitAt: number | null = await ctx.runQuery(internal.visits.previousForPeek, {
          donorId,
          charityId,
          now,
        });
        visit = { limited: false, previousVisitAt, visitId: null };
      } else {
        visit = await ctx.runMutation(internal.visits.record, { donorId, charityId, now });
        if (visit.limited) return retryLater(429);
      }

      const context: DonorContext | null = await ctx.runQuery(internal.context.forDonor, { donorId, charityId, now });
      if (!context) return json(NOT_RECOGNIZED);

      const facts = narrativeFacts(context);
      const factsHash = await hashFacts(facts);

      // The page never waits on Claude: cached narrative or the template, right now.
      let narrative: NarrativeResult | null = null;
      try {
        narrative = await ctx.runQuery(internal.narrative.cached, { donorId, charityId, factsHash });
      } catch {
        narrative = null;
      }
      if (!narrative) {
        narrative = { output: templateFallback(facts), source: "template", guardReasons: [] };
        try {
          await ctx.scheduler.runAfter(0, internal.narrative.getOrGenerate, { donorId, charityId });
        } catch {
          // best effort
        }
      }

      const view = buildDonorView({
        context,
        previousVisitAt: visit.previousVisitAt,
        narrative,
        donateHref: donateHrefFor(charityId),
        ownGifts: context.ownGifts,
        visitsInLast30Days: context.visitsInLast30Days,
        narrativeAt: context.narrativeAt,
      });

      // Remember which state this visit showed (best effort; never blocks the response).
      if (!peek && visit.visitId && view.recognized && view.donor) {
        try {
          await ctx.runMutation(internal.visits.setState, { id: visit.visitId, state: view.donor.state });
        } catch {
          // best effort
        }
      }
      return json(view);
    } catch {
      return retryLater(503);
    }
  }),
});

http.route({
  path: "/donor-view",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

// Live-update poll (contract v2): { recognized, rev } and nothing else. Inserts nothing, no rate limiter (D19).
// The rev is computed from the same parts and the same function as the one inside /donor-view.
http.route({
  path: "/donor-pulse",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const now = Date.now();
      const parsed = await parseDonorViewRequest(
        request.url,
        request.headers.get("Authorization"),
        tokenSecret(),
        now,
      );
      if (!parsed.ok) return pulseJson({ recognized: false });
      const { donorId, charityId } = parsed;
      const parts: { newestLogId: string | null; narrativeAt: number | null; newestGiftId: string | null } | null =
        await ctx.runQuery(internal.context.revParts, { donorId, charityId, now });
      if (!parts) return pulseJson({ recognized: false });
      return pulseJson({ recognized: true, rev: computeRev(parts) });
    } catch {
      return retryLater(503);
    }
  }),
});

http.route({
  path: "/donor-pulse",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { status: 204, headers: CORS_HEADERS })),
});

export default http;
