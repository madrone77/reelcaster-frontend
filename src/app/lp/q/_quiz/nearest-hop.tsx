"use client";

import { useEffect } from "react";

/**
 * `/lp/q/<not a city>` to the visitor's nearest quiz city, keeping the query
 * string.
 *
 * An ad pointed at `/lp/q/1` on 2026-09-25 and every click on it was a 404.
 * Instead this page hands off to /api/quiz/nearest, which reads the IP fix and
 * redirects to the nearest covered city (Vancouver for a BC reader, Seattle
 * for someone in Puget Sound or nowhere at all).
 *
 * Done in the browser because the page is ISR and never reads searchParams; a
 * server redirect here would drop utm_* and fbclid, and reading the geo
 * headers would take every quiz visit out of the cache.
 */
export default function NearestHop() {
  useEffect(() => {
    window.location.replace(`/api/quiz/nearest${window.location.search}${window.location.hash}`);
  }, []);
  return null;
}
