"use client";

import { useEffect } from "react";
import { CLICK_TYPES } from "@/lib/attribution";

/**
 * Counting what happens on a landing page before anyone converts.
 *
 * Two numbers, and they only mean anything together: how many people the ad
 * put on this page, and how many of them reached for the button. A conversion
 * table alone cannot tell a page that nobody visited from a page that everyone
 * bounced off, and those two failures have opposite fixes.
 *
 * Fired from the client rather than the server for one reason that decides it:
 * `/lp/<variant>/[city]` is ISR-cached (revalidate 900), so server code in the
 * page render runs once per fifteen minutes, not once per visitor. The only
 * server places that see every request are middleware and the doorway
 * redirect, and the doorway is skipped entirely by anyone landing on the city
 * path directly.
 *
 * The cost is that a visitor with JavaScript off is invisible here. That is
 * survivable because BOTH counters are fired by this same code under the same
 * conditions: whoever is missing from the numerator is missing from the
 * denominator too, so the CTR stays honest even where the absolute counts are
 * low. Nothing on this page is ever described as "visitors".
 *
 * No identifier is issued or sent. The request carries dimensions only, and
 * the server adds the coarse location and the device class from headers it
 * already has. See supabase/migrations/20260820_campaign_telemetry.sql for why
 * this is a counter and not an event log.
 */

const ENDPOINT = "/api/attribution/campaign";

/**
 * Which button was pressed. Deliberately about POSITION rather than label,
 * because the labels are what the angles vary: "Start free trial" and "See my
 * window" are the same button in the same place, and folding them together is
 * what makes the hero comparable across variants.
 */
export type LpCtaId = "hero" | "final" | "sticky" | "nav" | "secondary";

interface CampaignDims {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  click_type: string;
}

/**
 * `/lp/6/seattle-wa` → { landing: "lp6", target_city: "seattle-wa" }.
 *
 * Read from the path rather than passed down as props on purpose: the path is
 * already the authority on which variant and which city are being served, and
 * a prop would be a second copy of that fact for every variant page to get
 * right. A new /lp/7 starts counting the day it exists, with no edit here.
 */
function parseLpPath(pathname: string): { landing: string; target_city: string } {
  const parts = pathname.split("/").filter(Boolean); // ["lp", "6", "seattle-wa"]
  const variant = parts[0] === "lp" ? (parts[1] ?? "") : "";
  return {
    landing: /^[0-9]{1,2}$/.test(variant) ? `lp${variant}` : "",
    target_city: parts[2] ?? "",
  };
}

/**
 * The campaign parameters on the URL that brought us here.
 *
 * Only the three UTM fields the report groups by, plus WHICH network stamped a
 * click id. The click id itself is never sent: it identifies one person, and
 * putting it in a counter would quietly turn the counter into an event log.
 * Attribution keeps the id, in a cookie, where it is already disclosed.
 */
function campaignDims(): CampaignDims {
  const params = new URLSearchParams(window.location.search);
  const clickType = CLICK_TYPES.find((key) => params.get(key)) ?? "";
  const norm = (key: string) => (params.get(key) ?? "").trim().toLowerCase().slice(0, 80);
  return {
    utm_source: norm("utm_source"),
    utm_medium: norm("utm_medium"),
    utm_campaign: norm("utm_campaign"),
    click_type: clickType,
  };
}

/**
 * Post one event.
 *
 * `sendBeacon` first, because every CTA on these pages navigates away
 * immediately: a plain fetch racing `window.location` loses often enough to
 * put a visible dent in the click count, and a dent in the numerator alone
 * makes a working page look broken. keepalive fetch is the fallback for
 * browsers where sendBeacon is unavailable or refuses the payload.
 *
 * Fire and forget in both directions. A failed count must never be visible to
 * someone trying to buy something.
 */
function post(payload: Record<string, string>): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Fall through to fetch.
  }
  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    // Counting is not worth an error on a page someone is buying from.
  }
}

/**
 * A hit is per VISIT, not per render.
 *
 * React re-mounts, the back-forward cache, and a plain reload would each add a
 * hit for a visitor who arrived once, and every one of those inflates the CTR
 * denominator without any chance of a matching click. sessionStorage is the
 * right scope: it survives a reload and the back button, and it dies with the
 * tab, so tomorrow's visit from the same person counts again as it should.
 *
 * Wrapped in try/catch rather than guarded by a capability check, because on
 * iOS with "Block All Cookies" the storage GETTER itself throws (the whole
 * point of src/lib/safe-storage.ts). Failing open means those visitors may be
 * counted twice on a reload, which is a far better failure than the page
 * throwing on mount.
 */
function firstTimeThisVisit(key: string): boolean {
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Storage is blocked. Count it and move on.
  }
  return true;
}

/**
 * Count this landing-page view, once per tab.
 *
 * `angle` is the pitch the link asked for (?a=), which the page has already
 * resolved. Empty on /lp/1, which has no angles.
 */
export function useLpHit(angle: string): void {
  useCampaignHit(lpPathTarget(angle));
}

/**
 * Did one of our own landing pages send this visit here?
 *
 * The signal is `document.referrer`, and it is trustworthy on this particular
 * hop for a reason worth stating: every CTA on the /lp pages is a plain `<a>`
 * (see TrackedCta in _city1/city1-track.tsx and _blend/blend-track.tsx), never
 * a Next `<Link>`. So LP to Explore is a real document navigation and the
 * browser sets a referrer. If those CTAs ever become client-side links, this
 * goes quiet and the arrivals count drops to nothing while the CTA presses
 * carry on: check here first when those two numbers stop agreeing.
 *
 * Same-origin only, and that is not really a policy choice. Under the default
 * `strict-origin-when-cross-origin` a cross-origin referrer is trimmed to the
 * bare origin, so a path is only ever visible when the sender was us; the test
 * below just says so out loud instead of relying on it.
 *
 * Deliberately NOT the rc_paid cookie. That cookie is 90-day rolling, so it
 * would answer yes for someone who saw an ad in June and came back on their
 * own in September, and count that organic return as an ad arrival.
 */
export function cameFromLandingPage(): boolean {
  if (typeof document === "undefined") return false;
  const ref = document.referrer;
  if (!ref) return false;
  try {
    const url = new URL(ref);
    if (url.origin !== window.location.origin) return false;
    return /^\/lp\//.test(url.pathname);
  } catch {
    return false;
  }
}

/**
 * What the CURRENT path says is being counted, or null if it says nothing.
 *
 * Split out of `useLpHit` so a component that is shared between a /lp/<n>/
 * route and something else can ask the path first and fall back to dimensions
 * handed to it. `CityInstrument` is that component: it renders at
 * /fishing/<prov>/<city> (nothing to count), at /lp/7/<city> (the path is the
 * authority) and now under a city-first landing page like /lp/seattle/2, where
 * the path parser returns an empty landing and the page has to say what it is.
 *
 * Not a hook. Reading `window.location` during render is safe here for the
 * same reason it was inside `useLpHit`: the value only feeds an effect and an
 * onClick, never the markup, so a server render returning null cannot produce
 * a hydration mismatch.
 */
export function lpPathTarget(angle: string): CampaignTarget | null {
  const { landing, target_city } = parseLpPath(
    typeof window === "undefined" ? "" : window.location.pathname,
  );
  return landing
    ? { landing, target_city, target_spot: "", wall: "", angle }
    : null;
}

/**
 * What is being counted, for surfaces that are not /lp/<n>/<city>.
 *
 * The /lp pages read this off their own path, which is the authority there and
 * costs a new variant no edit. An ad-framed spot page has no such path: the
 * URL is the product's own `/explore/spot/<slug>`, and which city it belongs
 * to and which wall it is running are facts only the server knows. So those
 * surfaces pass the dimensions in.
 *
 * `target_spot` and `wall` exist for exactly one reason: without them every
 * Seattle spot at every wall setting folds into one row, and "which spot, at
 * which wall, earned the click" is unanswerable in a table that has already
 * thrown the distinction away. The counter is forward-only.
 */
export interface CampaignTarget {
  /** "lp6", or "spot" for an ad-framed spot page. */
  landing: string;
  target_city: string;
  /** Spot slug on a spot ad page, empty on a landing page. */
  target_spot: string;
  /** Paywall position on a spot ad page ("today"), empty elsewhere. */
  wall: string;
  angle: string;
}

/** Count this view, once per tab. Pass null when there is nothing to count. */
export function useCampaignHit(target: CampaignTarget | null): void {
  const key = target
    ? `${target.landing}:${target.target_city}:${target.target_spot}:${target.wall}`
    : "";
  const angle = target?.angle ?? "";
  useEffect(() => {
    if (!key) return;
    const [landing, target_city, target_spot, wall] = key.split(":");
    if (!landing) return;
    if (!firstTimeThisVisit(`rc_lp_hit:${key}`)) return;

    post({
      kind: "hit",
      landing,
      angle,
      target_city,
      target_spot,
      wall,
      cta: "",
      ...campaignDims(),
    });
  }, [key, angle]);
}

/**
 * Count a CTA press. Safe to call from an onClick that is about to navigate.
 *
 * Every press counts, including a second one from someone who came back and
 * tried again, because that is a genuine second reach for the button. Only the
 * hit is deduplicated.
 */
export function reportLpCta(cta: LpCtaId, angle: string): void {
  if (typeof window === "undefined") return;
  const { landing, target_city } = parseLpPath(window.location.pathname);
  if (!landing) return;
  reportCampaignCta(cta, {
    landing,
    target_city,
    target_spot: "",
    wall: "",
    angle,
  });
}

/** Count a CTA press on any campaign surface. Safe to call from an onClick
 *  that is about to navigate. */
export function reportCampaignCta(cta: LpCtaId, target: CampaignTarget): void {
  if (typeof window === "undefined") return;
  if (!target.landing) return;

  post({
    kind: "cta_click",
    landing: target.landing,
    angle: target.angle,
    target_city: target.target_city,
    target_spot: target.target_spot,
    wall: target.wall,
    cta,
    ...campaignDims(),
  });
}
