"use client";

import { useEffect, useState } from "react";

// A single "home spot" — the spot the angler pins as their default, surfaced as
// the hero on the dashboard. Stored as one slug in localStorage (setting a new
// one replaces the old).
const KEY = "rc-home-spot";

/** Read the current home-spot slug (or null). Safe on the server. */
export function readHomeSpot(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

/**
 * Is `slug` the home spot? Returns [isHome, toggle]. Toggling on makes this the
 * home spot (replacing any prior); toggling off clears it. Reacts to changes
 * from other tabs/pages via the `storage` event.
 */
export function useHomeSpot(slug: string) {
  const [isHome, setIsHome] = useState(false);

  useEffect(() => {
    const sync = () => {
      try {
        setIsHome(localStorage.getItem(KEY) === slug);
      } catch {}
    };
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY || e.key === null) sync();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [slug]);

  const toggle = () =>
    setIsHome((v) => {
      const next = !v;
      try {
        if (next) localStorage.setItem(KEY, slug);
        else if (localStorage.getItem(KEY) === slug) localStorage.removeItem(KEY);
      } catch {}
      return next;
    });

  return [isHome, toggle] as const;
}
