// Demo control panel (T33–T35): personas, staff-update presets and preflight rules.
// Pure TS, no Convex imports. convex/demo.ts is the thin wrapper; staff/demo.* is the panel.
// ALL DATA IS FICTIONAL (D5). Persona donors live in seed/data.ts.
import type { CharityId, DonorState, ImpactKind } from "./types";

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

// ---------- personas ----------

export type PersonaState = "stranger" | Exclude<DonorState, "returning">;

export interface Persona {
  id: string; // stable, URL-safe; never a donor id
  charityId: CharityId;
  state: PersonaState;
  donorId: string | null; // null only for the stranger
  label: string; // "Mira · first impact"
  description: string; // one line for the panel
  /** The calibrated story donor for this charity (run sheet path). */
  hero: boolean;
  /** demo:reset gives this donor the first DEMO_INBOXES address, so the milestone email can go out. */
  email: boolean;
}

export type PublicPersona = Omit<Persona, "donorId"> & { hostPath: string };

export const HOST_PATHS: Record<CharityId, string> = {
  "demo-pantry-a": "/sites/cinderwell/",
  "demo-pantry-b": "/sites/brindlecote/",
};

export const CHARITY_LABELS: Record<CharityId, string> = {
  "demo-pantry-a": "Cinderwell",
  "demo-pantry-b": "Brindlecote",
};

export const PERSONAS: readonly Persona[] = [
  // Cinderwell Pantry (demo-pantry-a)
  { id: "a-stranger", charityId: "demo-pantry-a", state: "stranger", donorId: null, label: "First-time visitor", description: "No token. The site exactly as the charity built it; the layer makes no request.", hero: false, email: false },
  { id: "a-first-impact", charityId: "demo-pantry-a", state: "first_impact", donorId: "donor_a01", label: "Mira · first impact", description: "One $25 gift nine days ago. Sees what it was part of, with estimates labeled. The story donor.", hero: true, email: true },
  { id: "a-just-gave", charityId: "demo-pantry-a", state: "just_gave", donorId: "donor_a13", label: "Wren · just gave", description: "A $10 gift today, made after the latest update. A thank-you, no numbers yet.", hero: false, email: false },
  { id: "a-news", charityId: "demo-pantry-a", state: "news", donorId: "donor_a04", label: "Teo · news since last visit", description: "Last visited three days ago. Leads with what was logged since then.", hero: false, email: false },
  { id: "a-repeat", charityId: "demo-pantry-a", state: "repeat", donorId: "donor_a02", label: "Jonas · repeat donor", description: "Two gifts this month. Thanked for giving again; gift history shown as records.", hero: false, email: false },
  { id: "a-lapsed", charityId: "demo-pantry-a", state: "lapsed", donorId: "donor_a14", label: "Hollis · lapsed", description: "Last gave about four months ago. A gentle welcome back, no pressure.", hero: false, email: false },
  // Brindlecote Food Bank (demo-pantry-b)
  { id: "b-stranger", charityId: "demo-pantry-b", state: "stranger", donorId: null, label: "First-time visitor", description: "No token. The site exactly as the charity built it; the layer makes no request.", hero: false, email: false },
  { id: "b-first-impact", charityId: "demo-pantry-b", state: "first_impact", donorId: "donor_a10", label: "Felix · first impact", description: "One $45 gift two weeks ago. Sees what it was part of, with estimates labeled.", hero: false, email: false },
  { id: "b-just-gave", charityId: "demo-pantry-b", state: "just_gave", donorId: "donor_a12", label: "Rhea · just gave", description: "A $35 gift today, made after the latest update. A thank-you, no numbers yet.", hero: false, email: false },
  { id: "b-news", charityId: "demo-pantry-b", state: "news", donorId: "donor_a09", label: "Sana · news since last visit", description: "Last visited three days ago. Leads with what was logged since then.", hero: false, email: false },
  { id: "b-repeat", charityId: "demo-pantry-b", state: "repeat", donorId: "donor_a05", label: "Lena · repeat donor", description: "Two gifts this month. Thanked for giving again; gift history shown as records.", hero: true, email: false },
  { id: "b-lapsed", charityId: "demo-pantry-b", state: "lapsed", donorId: "donor_a15", label: "Juno · lapsed", description: "Last gave about five months ago. A gentle welcome back, no pressure.", hero: false, email: false },
];

export function personaById(id: string): Persona | null {
  return PERSONAS.find((p) => p.id === id) ?? null;
}

/** What the panel may see: no donor ids. */
export function publicPersonas(): PublicPersona[] {
  return PERSONAS.map(({ donorId: _donorId, ...rest }) => ({ ...rest, hostPath: HOST_PATHS[rest.charityId] }));
}

/** Personas with a donor (everything demo:warm and the link checks cover). */
export function donorPersonas(): (Persona & { donorId: string })[] {
  return PERSONAS.filter((p): p is Persona & { donorId: string } => p.donorId !== null);
}

/**
 * Staging (demo:link and demo:reset): the persona's visits at its charity are replaced by at most
 * one earlier visit, so every click shows the same state. Returns the visit time, or null = no prior visit.
 * - news: a visit three days ago, so the records logged since then lead the page.
 * - lapsed, stranger: no prior visit.
 * - others: a visit about an hour ago but after the newest log at the charity, so nothing reads as
 *   "new" yet and a staff update posted during the demo flips the open page to `news`.
 */
export function stagedVisitAt(persona: Persona, now: number, newestLogAt: number | null): number | null {
  if (persona.donorId === null || persona.state === "stranger" || persona.state === "lapsed") return null;
  if (persona.state === "news") return now - 3 * DAY_MS;
  const base = newestLogAt === null ? now - HOUR_MS : Math.max(now - HOUR_MS, newestLogAt + MIN_MS);
  return Math.min(base, now - 1000);
}

// ---------- staff-update presets ----------

export type PresetId = "meals80" | "produce120" | "volunteer3";

export interface DemoPreset {
  id: PresetId;
  label: string; // button text
  kind: ImpactKind;
  count: number;
  note: string; // shown verbatim to donors; must pass validateImpactLog (no < > @ or links)
}

export const DEMO_PRESETS: readonly DemoPreset[] = [
  { id: "meals80", label: "Served 80 meals", kind: "meals", count: 80, note: "Evening distribution, 80 meals handed out." },
  { id: "produce120", label: "Received 120 lb produce", kind: "produce", count: 120, note: "Fresh produce delivery sorted and shelved." },
  { id: "volunteer3", label: "3 volunteer shifts", kind: "volunteer_shifts", count: 3, note: "Three volunteer shifts covered packing and intake." },
];

export function presetById(id: string): DemoPreset | null {
  return DEMO_PRESETS.find((p) => p.id === id) ?? null;
}

// ---------- PIN ----------

export const PIN_LOCK_WINDOW_MS = 10 * MIN_MS;
export const PIN_MAX_FAILURES = 10; // wrong PINs across the deployment per window before demo:* locks

/** Constant-time string compare (length leaks; content does not). */
export function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export function pinLocked(failureAts: readonly number[], now: number): boolean {
  return failureAts.filter((t) => t > now - PIN_LOCK_WINDOW_MS && t <= now).length >= PIN_MAX_FAILURES;
}

// ---------- preflight ----------

export type CheckStatus = "green" | "amber" | "red";

export type CheckId =
  | "convex"
  | "config"
  | "anthropic"
  | "claude_probe"
  | "warm"
  | "email"
  | "seed"
  | "canonical"
  | "milestones"
  | "layer"
  | "links";

export interface PreflightCheck {
  id: CheckId;
  label: string;
  status: CheckStatus;
  detail: string; // short, counts/enums only: never tokens, emails, names or keys
}

export interface PreflightReport {
  at: number;
  overall: CheckStatus;
  checks: PreflightCheck[];
}

export const PROBE_TTL_MS = 5 * MIN_MS;
export const MILESTONE_RUN_STALE_MS = 12 * MIN_MS; // cron runs every 5 min

export function probeFresh(probeAt: number | null, now: number): boolean {
  return probeAt !== null && now - probeAt < PROBE_TTL_MS && probeAt <= now;
}

/** Worst status wins; an empty list is red (nothing was checked). */
export function overallStatus(checks: readonly { status: CheckStatus }[]): CheckStatus {
  if (checks.length === 0) return "red";
  if (checks.some((c) => c.status === "red")) return "red";
  if (checks.some((c) => c.status === "amber")) return "amber";
  return "green";
}

export function buildReport(at: number, checks: PreflightCheck[]): PreflightReport {
  return { at, overall: overallStatus(checks), checks };
}
