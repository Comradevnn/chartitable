// Resend delivery (T9). Thin wrapper: the allowlist check lives in engine/email.ts and runs
// again right before the request (D4). Logs nothing: no addresses, no bodies.
import { v } from "convex/values";
import { sendViaResend } from "../engine/email";
import { internalAction } from "./lib/builders";
import { demoInboxes } from "./lib/env";

export const sendMilestone = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string(), html: v.string() },
  handler: async (_ctx, args) => {
    return await sendViaResend({
      fetchFn: fetch,
      apiKey: process.env.RESEND_API_KEY ?? null,
      from: process.env.RESEND_FROM ?? "Chartitable Demo <onboarding@resend.dev>",
      email: { to: args.to, subject: args.subject, text: args.text, html: args.html },
      allowlist: demoInboxes(),
    });
  },
});
