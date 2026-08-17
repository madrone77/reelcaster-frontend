"use client";

/**
 * Where the angler last had the map.
 *
 * The Explore camera used to be rebuilt from scratch on every mount: the
 * selected city seeded `initialViewState`, and because `?loc` is absent on a
 * bare `/explore` that city was always the default one (Victoria), with a
 * `fitBounds` right behind it framing that city's spots. Fine on a first
 * visit, wrong on every return trip — pan out to Sooke, open a spot page, hit
 * "Back to map", and the frame you built was thrown away and the map went home
 * to Victoria.
 *
 * So the canvas remembers itself. One blob, written whenever the map settles,
 * read back at mount: the camera, the bounds it was showing, and the pieces of
 * canvas state that don't live in the URL (species filter, layer toggles).
 *
 * sessionStorage, not localStorage: "carry on where I was" is a property of
 * this visit in this tab. A tab opened tomorrow should start on the default
 * frame, not on last week's water. `ensureSafeStorage()` has already swapped
 * in an in-memory stand-in for browsers that throw on the storage getter
 * (iOS "Block All Cookies"), but these still guard — nothing here is worth a
 * white screen.
 */

const KEY = "rc:exploreView";

export interface ExploreView {
  /** Camera centre + zoom, exactly as MapLibre last reported them. */
  lat: number;
  lng: number;
  zoom: number;
  /**
   * The bounds that camera was showing. Seeds the viewport-scoped rail and the
   * forecast strip's bbox at mount, so neither waits on MapLibre's `load` —
   * which blocks on the relief-tile CDN and can take seconds.
   */
  bounds?: { w: number; s: number; e: number; n: number } | null;
  /** Selected spot slug (`?spot=`) — the drawer reopens on the same spot. */
  spot?: string | null;
  /** Selected forecast day (`?day=`), ISO. Dropped on read once it's past. */
  day?: string | null;
  /** Species filter — component state, not URL. */
  species?: string | null;
  /**
   * Was this blob written on the way OUT to a spot page, rather than by the
   * map settling?
   *
   * It decides who wins when both the URL and the memory name a place. Normally
   * the URL does. But the browser's own Back button is not "Back to map": it
   * returns to the history entry the shell was last on, and `setQuery` leaves
   * the previous selection on that entry, so back from a spot page lands on
   * `/explore?spot=<the spot before this one>`. Standing aside for that URL
   * framed the spot the angler had already left. This flag says the memory is
   * the newer of the two intents, so use it. Only `writeSpotHandoff` sets it.
   *
   * One shot: the first settled move after the return rewrites the blob without
   * it, so a spot link opened later in the same tab still gets its own frame.
   */
  fromSpotPage?: boolean;
  /** Map-layer toggles. */
  relief?: boolean;
  labels?: boolean;
  currents?: boolean;
  wind?: boolean;
}

function finite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** The last remembered view, or null if there isn't a usable one. */
export function readExploreView(): ExploreView | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as ExploreView;
    // A camera is the whole point — anything without one is not worth
    // restoring, and a NaN centre would blank the map.
    if (!finite(v?.lat) || !finite(v?.lng) || !finite(v?.zoom)) return null;
    const b = v.bounds;
    const bounds =
      b && finite(b.w) && finite(b.s) && finite(b.e) && finite(b.n) ? b : null;
    return { ...v, bounds };
  } catch {
    return null;
  }
}

export function writeExploreView(view: ExploreView): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(view));
  } catch {
    /* storage unavailable — the map just forgets, which is survivable */
  }
}
