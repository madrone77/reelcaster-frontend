"use client";

/**
 * The angler's home city: where they fish, as opposed to the one piece of
 * water they fish most.
 *
 * This is the coarser of the two settings and the one that carries more of the
 * product. The daily report resolved the home SPOT to a city and discarded the
 * spot; so did Explore's opening frame. Both were asking a city question
 * through a spot-shaped hole. The difference that matters is that a city can
 * be guessed and a spot cannot: the URL someone arrives on, or failing that
 * their IP, says which city with enough confidence to put a single yes/no
 * question in front of them. Nobody can be asked to name their home spot on
 * day one, because they have not fished any of it through us yet.
 *
 * Three stores, for the same reasons ./use-home-spot has three:
 *   * localStorage, synchronous, so a first paint is right,
 *   * `user_metadata.preferences.homeCitySlug`, durable, so it follows them
 *     to their phone,
 *   * a cookie, so /explore can open on it in its FIRST render.
 * localStorage is a cache of the server value, never the source of truth for
 * a signed-in angler.
 */

import { useCallback, useEffect, useState } from "react";
import { UserPreferencesService } from "@/lib/user-preferences";
import { writeHomeCityCookie } from "./home-city-cookie";

const KEY = "rc-home-city";
/** Mirrors `preferences.homeCityAskedAt` so a signed-out tab asks only once. */
const ASKED_KEY = "rc-home-city-asked";

/** Read the current home-city slug (or null). Safe to call anywhere. */
export function readHomeCity(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

const listeners = new Set<(slug: string | null) => void>();

function subscribe(fn: (slug: string | null) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function writeLocal(slug: string | null) {
  try {
    if (slug) localStorage.setItem(KEY, slug);
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode or a browser refusing storage. The notify below still
    // works for the life of the page, and the cookie write outside this try
    // still lands — see [[incident-blocked-storage-whitescreen]].
  }
  writeHomeCityCookie(slug);
  for (const fn of listeners) fn(slug);
}

/** Have we already put the question to this person? */
export function homeCityAsked(): boolean {
  try {
    return !!localStorage.getItem(ASKED_KEY);
  } catch {
    // Cannot remember the answer, so do not start the conversation. Asking on
    // every single load would be far worse than never asking.
    return true;
  }
}

function markAskedLocal(when: string) {
  try {
    localStorage.setItem(ASKED_KEY, when);
  } catch {
    /* see above */
  }
}

/**
 * Record that the question was put, answered or not.
 *
 * Called on dismiss as well as on confirm, which is the point: someone who
 * closed it without choosing has answered "not now" and should not be asked
 * again on their next page load.
 */
export async function markHomeCityAsked(): Promise<void> {
  const when = new Date().toISOString();
  markAskedLocal(when);
  try {
    await UserPreferencesService.updateUserPreferences({ homeCityAskedAt: when });
  } catch {
    // Signed out or the write failed. The local mark still stands.
  }
}

/**
 * Set (or clear) the home city in every store, and record that we asked.
 *
 * The local write and the notify happen first so the UI never waits on the
 * network; the server write is fire-and-forget bookkeeping.
 */
export async function saveHomeCity(slug: string | null): Promise<void> {
  writeLocal(slug);
  const when = new Date().toISOString();
  markAskedLocal(when);
  try {
    await UserPreferencesService.updateUserPreferences({
      homeCitySlug: slug ?? "",
      homeCityAskedAt: when,
    });
  } catch {
    // The local choice still stands and the next successful write reconciles.
  }
}

/**
 * Pull the saved home city from the server and adopt it locally.
 *
 * A local choice made while signed out wins and is pushed up, so signing in
 * does not silently discard the answer they just gave.
 */
export async function hydrateHomeCity(): Promise<string | null> {
  const local = readHomeCity();
  try {
    const prefs = await UserPreferencesService.getUserPreferences();
    const server = prefs.homeCitySlug || null;
    if (prefs.homeCityAskedAt) markAskedLocal(prefs.homeCityAskedAt);
    if (server && server !== local) {
      writeLocal(server);
      return server;
    }
    if (!server && local) {
      void UserPreferencesService.updateUserPreferences({ homeCitySlug: local });
    }
  } catch {
    // Fall through to whatever is local.
  }
  // Refresh the mirror even when nothing changed: a cookie expires where
  // localStorage does not. Only ever refreshed here, never cleared.
  if (local) writeHomeCityCookie(local);
  return local;
}

export interface HomeCityState {
  slug: string | null;
  /**
   * Whether `slug` is an answer yet, rather than the absence of one.
   *
   * Same trap as the home spot: every surface here is prerendered, so the
   * server always renders city-less and the first client render must match.
   * A caller that draws "where do you fish?" off an unsettled null is putting
   * the question to somebody who already answered it.
   */
  ready: boolean;
}

/** The current home city, reactive to this tab, other tabs, and the server. */
export function useHomeCityState(hydrate = false): HomeCityState {
  const [slug, setSlug] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = readHomeCity();
    setSlug(local);
    if (local) writeHomeCityCookie(local);
    if (!hydrate) setReady(true);
    const unsubscribe = subscribe(setSlug);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) setSlug(readHomeCity());
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
    void hydrateHomeCity()
      .then((s) => {
        if (!cancelled) {
          setSlug(s);
          setReady(true);
        }
      })
      // hydrateHomeCity swallows its own failures, so this should not fire —
      // but leaving `ready` false would strand the caller on a skeleton.
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  return { slug, ready };
}

/** The current home-city slug. See `useHomeCityState` for the "not yet known"
 *  case, which callers offering to SET one have to be able to tell apart. */
export function useHomeCitySlug(hydrate = false): string | null {
  return useHomeCityState(hydrate).slug;
}

/** Set the home city from a UI that already knows which one it means. */
export function useSetHomeCity() {
  return useCallback((slug: string | null) => {
    void saveHomeCity(slug);
  }, []);
}
