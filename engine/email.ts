// Resend sender (T9). Pure TS with an injected fetch so tests never touch the network.
// D4: the allowlist is checked here, right before the request, no matter what the caller did.
// Never logs and never throws; callers must not block anything on the outcome.

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export const RESEND_URL = "https://api.resend.com/emails";

export async function sendViaResend(i: {
  fetchFn: typeof fetch;
  apiKey: string | null;
  from: string;
  email: OutgoingEmail;
  allowlist: Set<string>;
}): Promise<{ ok: true; id: string | null } | { ok: false; reason: "not_allowlisted" | "no_key" | "failed" }> {
  if (!i.allowlist.has(i.email.to.trim().toLowerCase())) return { ok: false, reason: "not_allowlisted" };
  if (!i.apiKey) return { ok: false, reason: "no_key" };

  const body = JSON.stringify({
    from: i.from,
    to: [i.email.to],
    subject: i.email.subject,
    text: i.email.text,
    html: i.email.html,
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await i.fetchFn(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${i.apiKey}`, "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        let id: string | null = null;
        try {
          const json = (await res.json()) as { id?: unknown };
          if (typeof json.id === "string") id = json.id;
        } catch {
          // body is optional; success is the status code
        }
        return { ok: true, id };
      }
    } catch {
      // fall through to the single retry
    }
  }
  return { ok: false, reason: "failed" };
}
