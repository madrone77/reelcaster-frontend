"use client";

import { useEffect } from "react";

/**
 * `/lp/q/seattle` to `/lp/q/seattle-wa`, keeping the query string.
 *
 * Done in the browser because the page is ISR and never reads searchParams;
 * a server redirect here would drop utm_* and fbclid, and reading them would
 * take every quiz visit out of the cache.
 */
export default function CityHop({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(`${to}${window.location.search}${window.location.hash}`);
  }, [to]);
  return null;
}
