"use client";

import { useEffect, useState } from "react";

const KEY_PREFIX = "rc-fav:";

/**
 * One-time repair for stars this app wrote without being asked.
 *
 * `extraRailSpotsFromPayload` used to read "absent from the server-rendered
 * base set" as "you created this", and /explore starred every such spot. The
 * base set is built from the hierarchy, cached for an hour, so every spot
 * published in the preceding hour qualified — and publishing is exactly when
 * you're looking at the map. Whole batches (the 46 Washington spots, for one)
 * landed in Saved spots on their own.
 *
 * The star is a bare localStorage write, so a junk one is indistinguishable
 * from a deliberate one and nothing about the key says which is which. The only
 * honest repair is a clean slate: drop every `rc-fav:` key once per browser and
 * let people re-star the handful they meant. The version stamp is what keeps
 * this from firing twice; bump it only for a genuinely new mess.
 *
 * Explicit un-stars ("0") go too. Your own custom spots therefore come back
 * starred on the next /explore visit via favoriteIfUnset(), which is the
 * documented default for a spot you built.
 */
const RESET_KEY = "rc-fav-reset";
const RESET_VERSION = "1";

let resetChecked = false;

function ensureReset(): void {
  if (resetChecked) return;
  resetChecked = true;
  try {
    if (localStorage.getItem(RESET_KEY) === RESET_VERSION) return;
    // Collect first, then delete: removing during an index walk reshuffles
    // localStorage under the iterator and silently skips half the keys.
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX)) doomed.push(k);
    }
    for (const k of doomed) localStorage.removeItem(k);
    localStorage.setItem(RESET_KEY, RESET_VERSION);
  } catch {
    // Blocked web storage (iOS "Block All Cookies") makes every one of these
    // throw. Nothing to repair in a browser that never stored a star, and
    // `resetChecked` means we don't retry on each read.
  }
}

/** Per-spot favorite, persisted in localStorage under `rc-fav:<slug>`. */
export function useFavorite(slug: string) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    ensureReset();
    try {
      setFav(localStorage.getItem(`${KEY_PREFIX}${slug}`) === "1");
    } catch {}
  }, [slug]);

  const toggle = () =>
    setFav((v) => {
      const next = !v;
      try {
        localStorage.setItem(`${KEY_PREFIX}${slug}`, next ? "1" : "0");
      } catch {}
      return next;
    });

  return [fav, toggle] as const;
}

/**
 * Favorite a spot outright (no toggle). Used when creating a custom spot: you
 * went to the trouble of dropping a pin and naming it, so it starts starred and
 * shows up in Saved spots without a second click.
 */
export function setFavorite(slug: string, fav = true): void {
  ensureReset();
  try {
    localStorage.setItem(`${KEY_PREFIX}${slug}`, fav ? "1" : "0");
  } catch {}
}

/**
 * Favorite a spot only if the user has never made a choice about it.
 *
 * Your own custom spots should start starred, but "starred by default" must not
 * mean "un-starring doesn't stick": an explicit un-favorite writes "0", and
 * this leaves that alone. Only a completely absent key is treated as "no
 * opinion yet" — which also covers spots created on another device, and spots
 * created before auto-favoriting existed.
 *
 * Callers must pass only spots the angler actually created. Inferring that from
 * "I haven't seen this one before" is what caused the mess ensureReset() clears.
 */
export function favoriteIfUnset(slug: string): void {
  ensureReset();
  try {
    if (localStorage.getItem(`${KEY_PREFIX}${slug}`) === null) {
      localStorage.setItem(`${KEY_PREFIX}${slug}`, "1");
    }
  } catch {}
}

/**
 * Every favorited spot slug (localStorage `rc-fav:*` === "1"), unordered.
 *
 * The single reader of the favourites keyspace: the dashboard, the favourites
 * page, and the free-tier cap all go through here, so none of them can render a
 * star the reset above was supposed to have taken.
 */
export function favoriteSlugs(): string[] {
  ensureReset();
  try {
    const out: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(KEY_PREFIX) && localStorage.getItem(k) === "1") {
        out.push(k.slice(KEY_PREFIX.length));
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** How many spots are currently favorited. */
export function favoriteCount(): number {
  return favoriteSlugs().length;
}
