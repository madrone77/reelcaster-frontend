"use client";

import { useEffect, useState } from "react";

/** Per-spot favorite, persisted in localStorage under `rc-fav:<slug>`. */
export function useFavorite(slug: string) {
  const [fav, setFav] = useState(false);

  useEffect(() => {
    try {
      setFav(localStorage.getItem(`rc-fav:${slug}`) === "1");
    } catch {}
  }, [slug]);

  const toggle = () =>
    setFav((v) => {
      const next = !v;
      try {
        localStorage.setItem(`rc-fav:${slug}`, next ? "1" : "0");
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
  try {
    localStorage.setItem(`rc-fav:${slug}`, fav ? "1" : "0");
  } catch {}
}

/** How many spots are currently favorited (localStorage `rc-fav:*` === "1"). */
export function favoriteCount(): number {
  try {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("rc-fav:") && localStorage.getItem(k) === "1") n++;
    }
    return n;
  } catch {
    return 0;
  }
}
