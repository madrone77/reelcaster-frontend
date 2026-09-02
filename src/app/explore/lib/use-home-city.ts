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
import { supabase } from "@/lib/supabase";
import { UserPreferencesService } from "@/lib/user-preferences";
import { writeHomeCityCookie } from "./home-city-cookie";
import type { EffectiveHomeCity } from "@/lib/home-city-server";

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
 * Adopt a city into the LOCAL stores only, and mark the question answered.
 *
 * For the one caller that has its own server write to make and must not make a
 * second: `saveHomeSpot` writes the pin and the city in a single preferences
 * update, because `updateUserPreferences` merges into a cached copy of the
 * whole blob and two overlapping calls would clobber each other.
 */
export function adoptHomeCityLocal(slug: string, when: string): void {
  writeLocal(slug);
  markAskedLocal(when);
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


// ── The effective home city ────────────────────────────────────────────────
//
// Everything above is the STATED city: what the angler chose, or nothing.
// Below is what a surface should actually draw, which is not the same thing.
//
// Most accounts never answer an optional question. Before this, the dashboard
// of somebody who closed the modal had no city band, no report, no neighbours,
// and one link back to the question they had already declined. The city was
// the only thing missing and it was the one thing we could have guessed.
//
// So a surface that wants to render, rather than to ask, uses this instead.
// The guess comes from the server because two of its three tiers need the
// place hierarchy and the third needs the edge headers. It is never written
// anywhere: an angler who has not chosen a city still has not chosen one, the
// dashboard says so beside the name, and the modal keeps asking.

export interface EffectiveHomeCityState {
  slug: string | null;
  name: string | null;
  /** How we got here. Null while unsettled, or when there is no answer. */
  source: EffectiveHomeCity["source"] | null;
  /**
   * The angler put this city here, by choosing it or by pinning a spot in it.
   * False means we guessed, which is a thing surfaces have to be able to say.
   */
  chosen: boolean;
  ready: boolean;
}

const UNSETTLED: EffectiveHomeCityState = {
  slug: null,
  name: null,
  source: null,
  chosen: false,
  ready: false,
};

/**
 * In-flight and settled copy of the answer, shared by every caller.
 *
 * The dashboard mounts this hook three deep on one page: the page itself for
 * the city band, the row at the top of it, and the account card on the next
 * route. Without this they would each fetch, which is how the subscription
 * read turned into a request storm. Held for the life of the page only, so a
 * choice made in the modal is not shadowed by a stale guess: `saveHomeCity`
 * writes a stated city, and a stated city never reaches this function.
 */
let effectiveRequest: Promise<EffectiveHomeCity | null> | null = null;

/** Ask the server for the effective city, once. Null on any failure. */
function fetchEffectiveHomeCity(): Promise<EffectiveHomeCity | null> {
  effectiveRequest ??= requestEffectiveHomeCity();
  return effectiveRequest;
}

async function requestEffectiveHomeCity(): Promise<EffectiveHomeCity | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    // Carry a `?geo_lat=&geo_lng=` override on the page URL through to the
    // route, the same way the homepage's near-you section does. The IP tier
    // is the whole point of this call and `next dev` sets no geo header, so
    // without this the guess is untestable anywhere but production. Inert
    // there: the route reads the override only when VERCEL_ENV is not
    // "production", so these params cannot make the live site believe a
    // visitor is somewhere else.
    const here = new URLSearchParams(window.location.search);
    const url = new URL("/api/home-city/effective", window.location.origin);
    for (const key of ["geo_lat", "geo_lng"] as const) {
      const value = here.get(key);
      if (value) url.searchParams.set(key, value);
    }

    const res = await fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { city: EffectiveHomeCity | null };
    return body.city ?? null;
  } catch {
    // A dashboard is not worth an error for. The caller falls back to no city,
    // which is exactly the behaviour this replaced. Drop the memo so the next
    // mount can try again rather than caching a network blip for the session.
    effectiveRequest = null;
    return null;
  }
}

/**
 * The city to draw, stated or guessed.
 *
 * A stated city short-circuits the request entirely, so the common case costs
 * nothing: this only reaches the network for accounts that have not answered.
 */
export function useEffectiveHomeCity(): EffectiveHomeCityState {
  const { slug: stated, ready: statedReady } = useHomeCityState(true);
  // undefined = not asked yet, null = asked and there was no answer.
  const [guess, setGuess] = useState<EffectiveHomeCity | null | undefined>(
    undefined,
  );

  useEffect(() => {
    // Wait for the hydrate: a bare null before it lands means "not looked
    // yet", and guessing off that would fetch on every load for anglers who
    // have a perfectly good city sitting in their profile.
    if (!statedReady || stated) return;
    let cancelled = false;
    void fetchEffectiveHomeCity().then((city) => {
      if (!cancelled) setGuess(city);
    });
    return () => {
      cancelled = true;
    };
  }, [statedReady, stated]);

  if (!statedReady) return UNSETTLED;

  if (stated) {
    return {
      slug: stated,
      name: null,
      source: "stated",
      chosen: true,
      ready: true,
    };
  }

  if (guess === undefined) return UNSETTLED;

  return {
    slug: guess?.slug ?? null,
    name: guess?.name ?? null,
    source: guess?.source ?? null,
    // The pin tier counts as chosen. Somebody who pinned a home spot before
    // the city setting existed did state where they fish, in the only way the
    // product offered at the time.
    chosen: guess?.source === "stated" || guess?.source === "spot",
    ready: true,
  };
}
