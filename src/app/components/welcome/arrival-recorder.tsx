"use client";

/**
 * Records the URL somebody arrived on, once per browser.
 *
 * Mounted at the root because an arrival can be any page: an ad click lands on
 * /lp, organic search lands on a spot or a city, a shared link lands on
 * /explore. There is no one route that sees them all.
 *
 * Cheap by construction. `recordArrival` returns immediately once something is
 * stored, so this is one localStorage read per navigation for the entire life
 * of the install, and it renders nothing.
 *
 * `useSearchParams` would put every page in the app behind a Suspense boundary
 * for this, so the query string is read off `window.location` in the effect
 * instead. Same value, no render-path cost, and the effect only runs on the
 * client where `window` exists.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordArrival } from "./arrival-city";

export default function ArrivalRecorder() {
  const pathname = usePathname();

  useEffect(() => {
    recordArrival(pathname ?? "/", window.location.search);
  }, [pathname]);

  return null;
}
