"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPreferencesService } from "@/lib/user-preferences";

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
  return local;
}

/**
 * The current home-spot slug, reactive to changes from this tab, other tabs,
 * and (when `hydrate` is true) the server copy.
 */
export function useHomeSpotSlug(hydrate = false): string | null {
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    setSlug(readHomeSpot());
    const unsubscribe = subscribe(setSlug);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setSlug(readHomeSpot());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!hydrate) return;
    let cancelled = false;
    void hydrateHomeSpot().then((s) => {
      if (!cancelled) setSlug(s);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  return slug;
}

/**
 * Is `slug` the home spot? Returns [isHome, toggle]. Toggling on makes this the
 * home spot (replacing any prior); toggling off clears it. Both stores follow.
 */
export function useHomeSpot(slug: string) {
  const current = useHomeSpotSlug();
  const isHome = current === slug;

  const toggle = useCallback(() => {
    void saveHomeSpot(isHome ? null : slug);
  }, [isHome, slug]);

  return [isHome, toggle] as const;
}
