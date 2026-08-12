"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { apiFetch, ApiError, UpgradeRequiredError } from "@/lib/api-client";
import { FREE_FAVORITE_SPOTS } from "@/lib/plan-features";
import type { SpotCoord } from "@/lib/bluecaster";

/**
 * Saved spots — the star on a spot card.
 *
 * Backed by `user_favorite_spots` through `/api/saved-spots`. It used to be
 * `localStorage` under `rc-fav:<slug>`, which meant favourites never left the
 * browser that made them: no sync to a phone, nothing server-side could read
 * them, and when /explore started writing stars on its own there was no way to
 * tell those from real ones — the repair had to be a blanket wipe (#259).
 *
 * Stars are now a signed-in feature. A signed-out tap resolves to
 * `"signed-out"` and writes nothing; the call site opens the register/upgrade
 * modal, which already knows how to sell to an anonymous viewer.
 *
 * ── One store, many stars ────────────────────────────────────────────────
 * A spot can be on screen several times at once (rail card, map drawer, the
 * neighbour list on a spot page), and every one of them has to agree. So the
 * set lives here at module scope with a subscriber list, fetched once per
 * session rather than per component, and each `useFavorite` is a view onto it.
 * Under localStorage each caller did its own read and they were consistent by
 * luck — the same read against a synchronous store. Against a server they would
 * not be.
 */

let slugs = new Set<string>();
/** Coordinates for the saved set, served alongside it by /api/saved-spots so
 *  a map can draw without a second round trip. Keyed by slug. */
let coords: Record<string, SpotCoord> = {};
let loaded = false;
let inflight: Promise<void> | null = null;
/** Whose list is in `slugs` — clearing on sign-out is not enough, because a
 *  second account signing in on the same tab must not inherit the first's. */
let ownerId: string | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/**
 * Load the viewer's saved slugs, once. Concurrent callers share the request.
 * Signed-out resolves to an empty set without a fetch.
 */
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    const userId = await currentUserId();
    if (!userId) {
      slugs = new Set();
      coords = {};
      ownerId = null;
      loaded = true;
      return;
    }
    try {
      const res = await apiFetch<{ slugs: string[]; spots?: SpotCoord[] }>(
        "/api/saved-spots",
      );
      slugs = new Set(res.slugs ?? []);
      coords = Object.fromEntries((res.spots ?? []).map((s) => [s.slug, s]));
      ownerId = userId;
      loaded = true;
    } catch {
      // A failed read must not be cached as "you have no saved spots" — that
      // would render every star empty and invite the user to re-save what they
      // already have. Leave it unloaded so the next mount retries.
      slugs = new Set();
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Drop the cached list — on sign-in, sign-out, or an account switch. */
export function resetFavorites(): void {
  slugs = new Set();
  coords = {};
  loaded = false;
  inflight = null;
  ownerId = null;
  emit();
}

/** Every saved slug, newest first. Empty until the first load resolves. */
export function favoriteSlugs(): string[] {
  return [...slugs];
}

/** How many spots are saved. */
export function favoriteCount(): number {
  return slugs.size;
}

export type ToggleResult = "saved" | "removed" | "signed-out" | "at-cap" | "error";

/**
 * Subscribe to the saved set.
 *
 * `ready` distinguishes "not saved" from "not known yet", which matters for the
 * cap: firing the upgrade modal off a set that hasn't loaded would nag a Pro
 * user on a cold page.
 */
export function useSavedSpots(): {
  slugs: string[];
  /** Coordinates for those slugs, from the same request. Absent for a spot
   *  that is unpublished or gone — match on slug, do not assume length. */
  coords: Record<string, SpotCoord>;
  ready: boolean;
} {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void ensureLoaded().then(emit);
    return () => {
      listeners.delete(l);
    };
  }, []);

  return { slugs: [...slugs], coords, ready: loaded };
}

/**
 * Per-spot star.
 *
 * `toggle()` is optimistic — the star flips on the tap, not on the round trip —
 * and rolls back if the write fails. It reports what happened so the call site
 * can open the right modal; it never opens one itself, because the three
 * surfaces that use this each dress the modal differently.
 */
export function useFavorite(slug: string) {
  const [, force] = useState(0);

  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    void ensureLoaded().then(emit);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const fav = slugs.has(slug);

  const toggle = useCallback(
    async (opts?: { isPaid?: boolean; spotId?: string }): Promise<ToggleResult> => {
      const userId = await currentUserId();
      if (!userId) return "signed-out";

      // Someone else's list is in memory (account switch in the same tab).
      if (ownerId && ownerId !== userId) resetFavorites();
      await ensureLoaded();

      const on = !slugs.has(slug);

      // Client-side cap check, so the modal opens without a round trip that we
      // know ends in 402. The route enforces the same rule and is the authority
      // — this is only here to keep the interaction instant.
      if (on && opts?.isPaid === false && slugs.size >= FREE_FAVORITE_SPOTS) {
        return "at-cap";
      }

      const before = new Set(slugs);
      slugs = new Set(slugs);
      if (on) slugs.add(slug);
      else slugs.delete(slug);
      emit();

      try {
        if (on) {
          await apiFetch("/api/saved-spots", {
            method: "POST",
            body: { slug, spot_id: opts?.spotId },
            feature: "favorite-spots",
          });
        } else {
          await apiFetch(`/api/saved-spots?slug=${encodeURIComponent(slug)}`, {
            method: "DELETE",
          });
        }
        return on ? "saved" : "removed";
      } catch (err) {
        slugs = before;
        emit();
        if (err instanceof UpgradeRequiredError) return "at-cap";
        if (err instanceof ApiError && err.status === 401) return "signed-out";
        return "error";
      }
    },
    [slug],
  );

  return [fav, toggle] as const;
}

/**
 * Star a spot outright, no toggle. Used when creating a custom spot: you dropped
 * a pin and named it, so it starts saved without a second click.
 *
 * Best-effort — a spot you just created is already yours whether or not the
 * star write lands, so this never blocks or reports.
 */
export async function setFavorite(slug: string, spotId?: string): Promise<void> {
  const userId = await currentUserId();
  if (!userId) return;
  try {
    await apiFetch("/api/saved-spots", {
      method: "POST",
      body: { slug, spot_id: spotId },
    });
    await ensureLoaded();
    slugs = new Set(slugs).add(slug);
    emit();
  } catch {
    // Creating the spot succeeded; the star is a convenience on top of it.
  }
}
