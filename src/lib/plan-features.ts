/**
 * The plan matrix — what a visitor, a free account, and a Pro member each get.
 *
 * The Free/Pro rows and their ORDER are the ones written for the /plans page;
 * this module is now where they live, so the sales page and every in-app
 * upgrade prompt read from one list instead of drifting apart. /plans renders
 * the `free`/`pro` columns; the upgrade modal adds `anon`, because a signed-out
 * visitor on /explore is the one being asked to create an account.
 *
 * LIVE FEATURES ONLY — everything here is a promise attached to a charge, so
 * nothing lands on this table before it actually works. "Live" is not the same
 * as "gated": depth, hourly currents, photo-analysed catch logging and
 * guide-reviewed spots all ship today and are free, so they sit in every
 * column. Listing them is what makes the product look as deep as it is; hiding
 * them because they aren't paywalled would undersell the free tier and make Pro
 * read as a wall rather than an addition.
 *
 * Ordering is the argument: seven rows of "this is a serious tool, and it's
 * free", then five rows of what paying adds. The hinge is the adjacency of
 * "Plan a week ahead" (free) and "Plan the full two weeks" (Pro) — the first is
 * what makes an account worth creating, the second is the obvious next step
 * from it. Keep them next to each other; `PRO_ROW_START` marks the seam.
 *
 * Regulation-change alerts are still deliberately absent: built, not gated, and
 * not yet a thing a customer can switch on.
 *
 * Change a limit here in the same PR that changes its enforcement:
 *   forecast horizon  src/app/explore/lib/forecast-strip.ts (+ the two
 *                     forecast-14d route mirrors)
 *   alerts            src/app/api/alerts/route.ts
 *   favourites        src/app/explore/**  (FREE_FAV_CAP)
 *   custom spots      src/app/api/bluecaster/fishing-spots/custom/route.ts
 */

import { ANNUAL_PRICE_CENTS, MONTHLY_PRICE_CENTS, TRIAL_DAYS } from "./pricing";

export type PlanTierId = "anon" | "free" | "pro";

export interface PlanTier {
  id: PlanTierId;
  /** Column heading. */
  label: string;
  /** Price line under the heading. */
  price: string;
}

export const PLAN_TIERS: PlanTier[] = [
  { id: "anon", label: "Browsing", price: "No account" },
  { id: "free", label: "Free", price: "$0" },
  { id: "pro", label: "Pro", price: `$${MONTHLY_PRICE_CENTS / 100}/mo` },
];

/**
 * A cell: `true` = included, `false` = not included, string = the actual limit.
 * Only the `anon` column uses strings — "Next 2 days" says more to a signed-out
 * visitor than a bare cross, and it's the number the modal is arguing about.
 */
export type PlanCell = string | boolean;

export interface PlanFeatureRow {
  id: string;
  label: string;
  anon: PlanCell;
  free: PlanCell;
  pro: PlanCell;
}

/** Index of the first Pro-only row — the seam the /plans hinge depends on. */
export const PRO_ROW_START = 7;

export const PLAN_FEATURES: PlanFeatureRow[] = [
  // Trust first: every published spot has been through local-guide review.
  {
    id: "guide-reviewed",
    label: "Spots checked by a local guide before they go live",
    anon: true,
    free: true,
    pro: true,
  },
  { id: "today-score", label: "See today’s bite score", anon: true, free: true, pro: true },
  {
    id: "bathymetry",
    label: "Read the bottom: depth and structure",
    anon: true,
    free: true,
    pro: true,
  },
  {
    id: "tide-hourly",
    label: "Watch the tide push through, hour by hour",
    anon: true,
    free: true,
    pro: true,
  },
  { id: "regs", label: "Check the regs before you go", anon: true, free: true, pro: true },
  {
    id: "catch-log",
    label: "Log a catch straight from the photo",
    anon: false,
    free: true,
    pro: true,
  },
  // Browsing stops at 2 days — the number the signed-out modal is arguing about.
  { id: "week-ahead", label: "Plan a week ahead", anon: "Next 2 days", free: true, pro: true },
  // ── everything below is what paying adds ──
  { id: "two-weeks", label: "Plan the full two weeks", anon: false, free: false, pro: true },
  { id: "save-spots", label: "Save every spot you fish", anon: false, free: false, pro: true },
  // Deliberately NOT "add your own spots" — that reads as another way of saying
  // "save". The value is that a spot we don't publish gets the full model run on
  // it, not that you can drop a pin.
  {
    id: "custom-spots",
    label: "Score a spot we don’t cover: your pin, our full model",
    anon: false,
    free: false,
    pro: true,
  },
  // One row, not two. "Get alerted" and "get it by text" is one feature and its
  // delivery channel; splitting them padded the list and read as filler.
  {
    id: "alerts",
    label: "Alerts when it’s on, by text or email",
    anon: false,
    free: false,
    pro: true,
  },
  {
    id: "all-cities",
    label: "Every covered city, one price",
    anon: false,
    free: false,
    pro: true,
  },
];

/* -------------------------------------------------------------------------
 * Nag features — the thing the angler just tried to do.
 * ---------------------------------------------------------------------- */

/** Every action on /explore that can hit a wall. */
export type NagFeatureId =
  | "alerts"
  | "sms-alerts"
  | "favorite-spots"
  | "custom-spots"
  | "forecast-week"
  | "forecast-14d"
  | "catch-log";

export interface NagFeature {
  /** Completes "Start your 7-day Pro trial to ___". Lower case, no period. */
  action: string;
  /** Lowest tier that unlocks it — decides whether we sell Pro or an account. */
  unlocksAt: "free" | "pro";
  /** Row in the matrix to highlight. */
  rowId: string;
  /** `?feature=` for /plans — must match a `plans-feature-callout` key. */
  pricingFeature: string;
}

export const NAG_FEATURES: Record<NagFeatureId, NagFeature> = {
  alerts: {
    action: "create an alert",
    unlocksAt: "pro",
    rowId: "alerts",
    pricingFeature: "alerts",
  },
  "sms-alerts": {
    action: "get alerts by text",
    unlocksAt: "pro",
    rowId: "alerts",
    pricingFeature: "alerts",
  },
  "favorite-spots": {
    action: "save more spots",
    unlocksAt: "pro",
    rowId: "save-spots",
    pricingFeature: "favorite-spots",
  },
  "custom-spots": {
    action: "score a spot we don’t cover",
    unlocksAt: "pro",
    rowId: "custom-spots",
    pricingFeature: "custom-spots",
  },
  "forecast-week": {
    action: "plan a week ahead",
    unlocksAt: "free",
    rowId: "week-ahead",
    pricingFeature: "14-day-forecast",
  },
  "forecast-14d": {
    action: "plan the full two weeks",
    unlocksAt: "pro",
    rowId: "two-weeks",
    pricingFeature: "14-day-forecast",
  },
  "catch-log": {
    action: "log a catch",
    unlocksAt: "free",
    rowId: "catch-log",
    pricingFeature: "favorite-spots",
  },
};

/** "Start your 7-day Pro trial to create an alert" — the modal's headline. */
export function nagHeadline(feature: NagFeature, viewerTier: PlanTierId): string {
  // A signed-out visitor blocked by something a free account already gives
  // gets sold the account, not the subscription — asking for a card to see
  // day 5 of a forecast a free login unlocks is a way to lose the signup.
  if (feature.unlocksAt === "free" && viewerTier === "anon") {
    return `Create a free account to ${feature.action}`;
  }
  return `Start your ${TRIAL_DAYS}-day Pro trial to ${feature.action}`;
}

/** The reassurance line under the headline. */
export function nagSubhead(feature: NagFeature, viewerTier: PlanTierId): string {
  if (feature.unlocksAt === "free" && viewerTier === "anon") {
    return "Takes about 30 seconds. No card, no charge.";
  }
  return `Free for ${TRIAL_DAYS} days, then $${MONTHLY_PRICE_CENTS / 100}/month or $${
    ANNUAL_PRICE_CENTS / 100
  }/year. Cancel anytime before the trial ends and you pay nothing.`;
}
