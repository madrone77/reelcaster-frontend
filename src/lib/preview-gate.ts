/**
 * The Explore preview gate: charted depth for paid traffic, until they decline.
 *
 * WHY THIS EXISTS. An ad buys a click, and the thing our ads actually show is
 * the depth map — relief, contours, the ledge a fish holds on. A visitor who
 * lands, reads it, and leaves has been shown the whole product for free and
 * asked for nothing. This gate lets them use it, asks once when the click count
 * says they are actually using it (see @/lib/upgrade-nag, which owns the
 * counting), and takes depth away if they say no. Registering a free account
 * brings it back.
 *
 * THE ONE THING AT STAKE IS DEPTH, and that is deliberate. The forecast horizon
 * is enforced server-side by `resolveEntitlement` in the bluecaster proxies, so
 * granting an anonymous visitor extra days would mean those routes trusting a
 * cookie the browser can write — anyone could forge a permanent Pro horizon.
 * Depth is served from an unauthenticated tile proxy and is visible to everyone
 * today, so hiding it costs nothing upstream and forging this cookie buys
 * nothing that was not already free. The rail stays at whatever the account
 * entitles it to, all the way through.
 *
 * A COOKIE, NOT sessionStorage. The decline has to be legible to `/explore` on
 * a later visit, days after the ad click, which rules out anything session
 * scoped. It is read on the server there — that route is already `ƒ` and
 * already reads the home-spot cookie for the same reason — so a declined
 * visitor never sees depth paint and then vanish on every load.
 *
 * IT FAILS TOWARD GENEROUS, on purpose. A browser with cookies blocked reads
 * `document.cookie` as an empty string and silently drops writes, so it can
 * never be marked declined, and it keeps the map. That is the correct way for
 * this to break: withholding depth from someone whose browser we cannot read is
 * a worse failure than showing it to someone who declined and then cleared
 * their cookies. Never invert this to "unknown means locked".
 *
 * NOT A SECURITY BOUNDARY. The tile proxy is unauthenticated and the style is
 * readable, so depth tiles can be pulled by hand whatever this says. That is
 * fine for what this is — a product gate on a marketing surface — and it must
 * never be described internally as protection.
 */

/**
 * THE GATE IS OFF.
 *
 * One switch, off, because "not live yet" has to mean nothing at all reaches a
 * visitor — including the visitors who already answered. Turning the traffic
 * off at the landing page stops NEW arrivals, but anyone stamped in the window
 * it was live still carries `rc_preview=declined`, and without this they would
 * keep a depthless /explore indefinitely with nothing linking to the route that
 * explains it.
 *
 * So this short-circuits every decision in this module: no grant is stamped, no
 * cookie already out there locks anything, and the prompt never opens. The
 * route, the components and the wiring all stay exactly where they are, so
 * switching this to `true` is the whole of turning it back on.
 *
 * Deliberately a constant and not an env var: an env change needs a redeploy on
 * this project anyway, and a flag you can read in the diff is worth more than
 * one you have to go and look up in a dashboard.
 */
export const PREVIEW_GATE_ENABLED = false;

/** Values the cookie may hold. Anything else reads as no grant at all. */
export type PreviewState = "active" | "declined";

export const PREVIEW_COOKIE = "rc_preview";

/**
 * Six months. Long enough that the decline is not trivially outlived, short
 * enough that a map does not stay dark forever for somebody who dismissed one
 * prompt on their phone last spring and never came back.
 */
export const PREVIEW_MAX_AGE = 60 * 60 * 24 * 180;

/** The campaign the grant came from, for the funnel report. */
export interface PreviewGrant {
  state: PreviewState;
  /** "lp" when a landing page sent them, "direct" when the ad did. */
  source?: string;
  campaign?: string;
}

/** Cookie text → state. Unknown text is no grant, never a decline. */
export function parsePreviewState(
  raw: string | null | undefined,
): PreviewState | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "active" || v === "declined") return v;
  return null;
}

/**
 * Does this viewer lose the depth layers?
 *
 * Signing in always wins. A free account is the advertised way back, so the
 * moment somebody has one the gate stops applying — no waiting on a tier fetch,
 * because "has an account" is enough and `isPaid` resolving late would flash
 * the map dark for a member who already registered.
 */
export function depthLocked({
  state,
  signedIn,
}: {
  state: PreviewState | null;
  signedIn: boolean;
}): boolean {
  // Off means off, including for a cookie written while it was on.
  if (!PREVIEW_GATE_ENABLED) return false;
  if (signedIn) return false;
  return state === "declined";
}

// ── Browser side ─────────────────────────────────────────────────────────────

/**
 * Read the cookie. Returns null on any browser that will not hand it over,
 * which is the generous answer (see the header note).
 */
export function readPreviewCookie(): PreviewState | null {
  if (typeof document === "undefined") return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${PREVIEW_COOKIE}=([^;]*)`),
    );
    return parsePreviewState(match ? decodeURIComponent(match[1]) : null);
  } catch {
    return null;
  }
}

/**
 * Write the cookie. Silently a no-op where storage is refused, which leaves
 * that browser holding the preview — again, the generous direction.
 *
 * `SameSite=Lax` so it survives the click through from a landing page, and no
 * `Secure` in development so `next dev` over http can be tested at all.
 */
export function writePreviewCookie(state: PreviewState): void {
  if (typeof document === "undefined") return;
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${PREVIEW_COOKIE}=${state}; Path=/; Max-Age=${PREVIEW_MAX_AGE}` +
      `; SameSite=Lax${secure}`;
  } catch {
    // In-memory for this page's life. The caller has already set its own state.
  }
}

/**
 * Stamp the grant for a visitor who just arrived on the marketing route.
 *
 * Deliberately a function the ROUTE calls rather than something the landing
 * page does on its way out. Today every ad goes to /lp/<n> and the CTA carries
 * people through; when ads start pointing straight at /m/explore, that arm
 * needs the same stamp and this is already where it happens.
 *
 * Never overwrites a decline. Somebody who said no and clicked a second ad is
 * still somebody who said no.
 */
export function stampPreviewGrant(): PreviewState | null {
  if (!PREVIEW_GATE_ENABLED) return null;
  const existing = readPreviewCookie();
  if (existing) return existing;
  writePreviewCookie("active");
  return "active";
}
