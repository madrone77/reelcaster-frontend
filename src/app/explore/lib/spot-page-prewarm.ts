import type { SpotPageInitial } from "@/lib/bluecaster/live-spot-types";

/**
 * The phone spot sheet's payload, fetched before the tap.
 *
 * A tap on a spot card opened the sheet onto its name and three loading dots
 * for as long as BlueCaster took to build the page: 1.4 to 2.8 s cold, 6.8 s
 * seen (2026-09-14). An angler who pulls a card up is usually about to open
 * it, so the card in hand starts the fetch, and by the time the thumb reaches
 * FULL REPORT the page is in memory. The same request also warms BlueCaster's
 * edge copy for whoever opens the spot next.
 *
 * One entry per slug, shared by every caller: a tap during a prewarm waits on
 * the request already out rather than sending a second one.
 */

/** How long a payload counts as fresh: the edge's own `s-maxage`. */
const FRESH_MS = 5 * 60_000;
/** Same bound the sheet puts on its own request. */
const FETCH_TIMEOUT_MS = 20_000;

type Entry = {
  at: number;
  promise: Promise<SpotPageInitial | null>;
};

const entries = new Map<string, Entry>();

let shellPreloaded = false;

/**
 * Pulls in the spot page's client chunk, which the sheet loads with
 * `next/dynamic`. Without it a warm payload still waits on the heaviest chunk
 * Explore can open before anything draws.
 */
function preloadSpotShell() {
  if (shellPreloaded) return;
  shellPreloaded = true;
  import("@/app/fishing/[country]/[state]/[city]/[spot]/spot-detail-shell").catch(() => {
    shellPreloaded = false;
  });
}

/**
 * Start fetching a spot's sheet payload, unless a fresh one is already held
 * or on its way.
 *
 * @param token  Only for a custom spot, which may be private to its owner.
 *   A curated spot's payload is the same for everyone, and asking without a
 *   token lets the same-origin proxy answer from its edge cache.
 */
export function prewarmSpotPage(slug: string, token?: string): void {
  const cur = entries.get(slug);
  if (cur && Date.now() - cur.at < FRESH_MS) return;
  preloadSpotShell();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const entry: Entry = {
    at: Date.now(),
    promise: fetch(`/api/bluecaster/spots/${encodeURIComponent(slug)}/spot-page`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? (res.json() as Promise<SpotPageInitial>) : null))
      .catch(() => null)
      .then((data) => {
        // A miss is not held: the sheet's own request, with the reader's
        // token, gets to ask again.
        if (!data && entries.get(slug) === entry) entries.delete(slug);
        return data;
      })
      .finally(() => window.clearTimeout(timer)),
  };
  entries.set(slug, entry);
}

/** Keep a payload the sheet fetched itself, so reopening the spot is instant. */
export function rememberSpotPage(slug: string, data: SpotPageInitial): void {
  entries.set(slug, { at: Date.now(), promise: Promise.resolve(data) });
}

/**
 * The prewarmed payload for a slug: a promise that resolves to it (or to null
 * when that request failed), or null when nothing fresh is held.
 */
export function takePrewarmedSpotPage(
  slug: string,
): Promise<SpotPageInitial | null> | null {
  const entry = entries.get(slug);
  if (!entry || Date.now() - entry.at >= FRESH_MS) return null;
  return entry.promise;
}
