// Env access in one place. Values live in the Convex dashboard (`npx convex env set`), never the repo.
// Callers must treat null as "feature unavailable" and fail closed (no token, no email, no Claude call).

/** TOKEN_SECRET, or null if unset/too short (verifyToken/signToken need >= 16 chars; spec asks >= 32). */
export function tokenSecret(): string | null {
  const s = process.env.TOKEN_SECRET;
  return s && s.length >= 32 ? s : null;
}

export function staffPinMatches(pin: string): boolean {
  const expected = process.env.STAFF_PIN;
  return !!expected && pin === expected;
}

export function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Lower-cased allowlist from DEMO_INBOXES (comma-separated). Empty → send nothing. */
export function demoInboxes(): Set<string> {
  return new Set(
    (process.env.DEMO_INBOXES ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}
