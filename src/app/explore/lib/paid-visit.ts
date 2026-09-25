"use client";

import { useEffect, useState } from "react";
import { readPaid } from "@/lib/attribution";

/**
 * How long after a bought click the visit still counts as paid. The cookie
 * itself lives 90 days for conversion upload; a reader who clicked an ad in
 * August and comes back on their own in September is organic again.
 */
const PAID_VISIT_MS = 24 * 60 * 60 * 1000;

/**
 * Did a Meta or Google ad bring this reader here in the last day?
 *
 * Reads `rc_paid`, which middleware writes on the first page of any visit
 * whose URL carries a paid marker (a click id, or a paid utm_medium), so a
 * Google Ads click that lands on a city page and walks to the map still
 * counts, although the map's own URL carries no `?ad=`. After mount only:
 * the cookie is not in the server render, and the taps it governs can only
 * happen after hydration anyway.
 */
export function usePaidVisit(): boolean {
  const [paid, setPaid] = useState(false);
  useEffect(() => {
    const p = readPaid();
    const t = p ? Date.parse(p.ts) : NaN;
    setPaid(Number.isFinite(t) && Date.now() - t < PAID_VISIT_MS);
  }, []);
  return paid;
}
