"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPreferencesService } from "@/lib/user-preferences";
import { writeHomeSpotCookie } from "./home-spot-cookie";

// A single "home spot" — the spot the angler pins as their default, surfaced as
// the hero on the dashboard. Setting a new one replaces the old.
//
// Two stores, deliberately:
//   * localStorage — synchronous, so the dashboard hero and the spot-page pin
//     render correctly on first paint and keep working signed out.
//   * user_metadata.preferences.homeSpotSlug — the durable copy, so the pin
//     follows the angler to their phone. A home spot that only exists on the
//     laptop that set it is not a home spot.
// localStorage is a cache of the server value, never the source of truth for a
// signed-in user; `hydrateHomeSpot()` reconciles the two on load.
//
// A third, thinner copy rides along in a cookie — see ./home-spot-cookie. It
// exists purely so /explore can open on the home city in its FIRST render
// instead of flying there after hydration; localStorage is invisible to the
// server. Every write below keeps it in step, so it is never consulted as a
// separate opinion.
const KEY = "rc-home-spot";

/** Read the current home-spot slug (or null). Safe on the server. */
export function readHomeSpot(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

// The `storage` event only fires in OTHER tabs, so a pin set on the spot page
// would not reach the dashboard hero in the same tab until a reload. This
// registry closes that gap; every write goes through `writeHomeSpot`.
const listeners = new Set<(slug: string | null) => void>();

function subscribe(fn: (slug: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Write locally and notify this tab. Does not touch the server. */
function writeLocal(slug: string | null) {
  try {
    if (slug) localStorage.setItem(KEY, slug);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode / quota — the in-memory notify below still works for the
    // life of the page.
  }
  // Outside the try: cookies survive the storage block that throws here (see
  // [[incident-blocked-storage-whitescreen]]), so a browser refusing
  // localStorage still opens Explore on the right city.
  writeHomeSpotCookie(slug);
  for (const fn of listeners) fn(slug);
}

/**
 * Set (or clear) the home spot in both stores. The local write and the notify
 * happen first so the UI never waits on the network; the server write is
 * fire-and-forget bookkeeping.
 */
export async function saveHomeSpot(slug: string | null): Promise<void> {
  writeLocal(slug);
  try {
    await UserPreferencesService.updateUserPreferences({
      homeSpotSlug: slug ?? "",
    });
  } catch {
    // Signed out, or the write failed: the local pin still stands, and the
    // next successful save reconciles it.
  }
}

/**
 * Pull the saved home spot from the server and adopt it locally. Call once per
 * signed-in session (the dashboard does). A local pin set while signed out
 * wins and is pushed up, so signing in doesn't silently discard it.
 */
export async function hydrateHomeSpot(): Promise<string | null> {
  const local = readHomeSpot();
  try {
    const prefs = await UserPreferencesService.getUserPreferences();
    const server = prefs.homeSpotSlug || null;
    if (server && server !== local) {
      writeLocal(server);
      return server;
    }
    if (!server && local) {
      void UserPreferencesService.updateUserPreferences({ homeSpotSlug: local });
    }
  } catch {
    // Fall through to whatever is local.
  }
  // Refresh the mirror even when nothing changed: the pin predates the cookie
  // for everyone who set one before this shipped, and a cookie expires where
  // localStorage does not. Only ever refreshed here, never cleared — clearing
  // is `writeLocal`'s job, and a browser that is refusing localStorage reads
  // null here while the cookie still holds the real pin.
  if (local) writeHomeSpotCookie(local);
  return local;
}

export interface HomeSpotState {
  slug: string | null;
  /**
   * Whether `slug` is an answer yet, as opposed to the absence of one.
   *
   * `null` means two different things, and a caller that cannot tell them
   * apart will assert the wrong one. The dashboard is prerendered, so the
   * server — which has no localStorage — always renders pin-less, and the
   * first client render must match it. A surface that draws "pin a home spot"
   * off that is telling an angler who has one that they do not.
   *
   * With `hydrate` on this stays false until the SERVER copy lands, not merely
   * until localStorage is read: a pin set on a phone does not exist in this
   * browser's storage, and settling early would flash the empty state at
   * exactly the angler the durable copy exists for.
   */
  ready: boolean;
}

/**
 * The current home spot, reactive to changes from this tab, other tabs, and
 * (when `hydrate` is true) the server copy — plus whether it is known yet.
 */
export function useHomeSpotState(hydrate = false): HomeSpotState {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = readHomeSpot();
    setSlug(local);
    // Keep the server-readable mirror alive on every surface that reads the
    // pin, not just the one that hydrates it. Refresh only — see above.
    if (local) writeHomeSpotCookie(local);
    // Without a server round trip to wait for, the local read IS the answer.
    if (!hydrate) setReady(true);
    const unsubscribe = subscribe(setSlug);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setSlug(readHomeSpot());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
    // `hydrate` is a fixed choice per call site, not a changing input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrate) return;
    let cancelled = false;
    void hydrateHomeSpot()
      .then((s) => {
        if (!cancelled) {
          setSlug(s);
          setReady(true);
        }
      })
      // hydrateHomeSpot swallows its own failures and falls back to the local
      // pin, so this should not fire — but if it ever did, leaving `ready`
      // false would strand the caller on a skeleton forever.
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  return { slug, ready };
}

/**
 * The current home-spot slug, reactive to changes from this tab, other tabs,
 * and (when `hydrate` is true) the server copy.
 *
 * Callers that must distinguish "no home spot" from "not known yet" want
 * `useHomeSpotState` instead.
 */
export function useHomeSpotSlug(hydrate = false): string | null {
  return useHomeSpotState(hydrate).slug;
}

export interface HomeSpotPin extends HomeSpotState {
  /** Is `slug` — the one asked about — the home spot? */
  isHome: boolean;
  /** Make it the home spot, or clear it if it already is. Both stores follow. */
  toggle: () => void;
}

/**
 * The home-spot pin as seen from one spot's page.
 *
 * Returns an object rather than a tuple because a caller needs more than
 * `isHome`: an offer to PIN this spot has to know whether some OTHER spot is
 * already pinned, which `slug` answers, and whether that question has been
 * answered at all, which `ready` does.
 *
 * Pass `hydrate` on a surface that must be right about a pin set on ANOTHER
 * device — without it this reads localStorage only, so the spot page of an
 * angler's home spot draws an empty house on the phone they didn't pin from.
 */
export function useHomeSpot(slug: string, hydrate = false): HomeSpotPin {
  const { slug: current, ready } = useHomeSpotState(hydrate);
  const isHome = current === slug;

  const toggle = useCallback(() => {
    void saveHomeSpot(isHome ? null : slug);
  }, [isHome, slug]);

  return { slug: current, ready, isHome, toggle };
}
