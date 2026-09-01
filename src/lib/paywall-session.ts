/**
 * The rotating session id that lets one visit be read as one visit.
 *
 * WHY THERE IS ONE AT ALL. Every counter in this codebase is deliberately
 * anonymous, and that was the right trade while the question was "how many".
 * It stops being enough the moment the question is "of the people this ad sent
 * to this wall, how many bought": a wall shown three times to one undecided
 * visitor is three impressions and one person, and without something to group
 * on there is no way to tell those apart. Worse, a dismissal and the signup
 * ninety seconds later are two rows that plainly belong to one story and
 * cannot be joined.
 *
 * WHAT IT IS NOT. Not a visitor id, not a device id, not a fingerprint. It is
 * a random value with two expiries and no meaning:
 *
 *   30 minutes idle   the same window rc_wall already uses. Half an hour after
 *                     someone put the phone down, whatever they do next is a
 *                     different visit and gets a different id.
 *   6 hours absolute  so a tab left open for a week cannot quietly become a
 *                     durable identifier for that browser. `MAX_LIFETIME_MS`
 *                     is checked on every refresh, and a session past it is
 *                     replaced rather than extended.
 *
 * Nothing maps it to a person. It is never sent to an ad network, never joined
 * to auth.users except by the ordinary route of the visitor signing in while
 * it happens to be live, and it is deleted with the rest of the row by
 * `prune_paywall_events` after 180 days.
 *
 * WRITTEN IN MIDDLEWARE, on the request, for the same reason first touch moved
 * there: the browsers we most need to count are the ones that never run our
 * JavaScript with the ad's query string still in front of them. A cookie set
 * on the first byte is present for the wall that opens four seconds later.
 */

/** 30 minutes of inactivity ends the session. Matches WALL_MAX_AGE. */
export const SESSION_COOKIE = 'rc_sess';
export const SESSION_MAX_AGE = 60 * 30;

/** No session outlives this, however active. */
const MAX_LIFETIME_MS = 1000 * 60 * 60 * 6;

/**
 * Cookie shape: `<id>.<minted epoch ms>`.
 *
 * The mint time rides along because the absolute cap has to be checkable
 * without a second cookie and without a lookup, in middleware, on every page
 * view. A malformed value is treated as no session rather than repaired: the
 * cost is one new id, and the alternative is code that trusts half a cookie.
 */
export interface PaywallSession {
  id: string;
  mintedAt: number;
}

const ID_PATTERN = /^[0-9a-f-]{8,64}$/;

export function parseSession(raw: string | undefined | null): PaywallSession | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const id = raw.slice(0, dot);
  const mintedAt = Number(raw.slice(dot + 1));
  if (!ID_PATTERN.test(id)) return null;
  if (!Number.isFinite(mintedAt) || mintedAt <= 0) return null;
  return { id, mintedAt };
}

export function serializeSession(session: PaywallSession): string {
  return `${session.id}.${session.mintedAt}`;
}

/** Has this session run past the absolute cap? */
export function isExpired(session: PaywallSession, now: number = Date.now()): boolean {
  return now - session.mintedAt > MAX_LIFETIME_MS;
}

/**
 * The session for this request: the one on the cookie if it is still inside
 * both windows, otherwise a fresh one.
 *
 * `randomUUID` is available in the edge runtime and in Node 19+. The fallback
 * is not security-sensitive — this value only has to be unlikely to collide
 * with another visit in the same half hour — but it exists so a runtime
 * without the API produces a session rather than throwing on a page view.
 */
export function resolveSession(
  raw: string | undefined | null,
  now: number = Date.now(),
): PaywallSession {
  const existing = parseSession(raw);
  if (existing && !isExpired(existing, now)) return existing;
  return { id: newId(), mintedAt: now };
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`.slice(
      0,
      32,
    );
  }
}

/**
 * Read the id only, from a raw Cookie header (server) or document.cookie
 * (browser). Returns null rather than minting: only middleware mints, so a
 * reader that cannot find one is describing a browser that blocks cookies,
 * and inventing an id per request would fill the column with values that group
 * nothing.
 */
export function readSessionId(cookieHeader: string): string | null {
  const hit = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!hit) return null;
  const parsed = parseSession(decodeURIComponent(hit.slice(SESSION_COOKIE.length + 1)));
  return parsed?.id ?? null;
}
