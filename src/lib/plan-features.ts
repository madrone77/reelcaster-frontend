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
 *   favourites        FREE_FAVORITE_SPOTS below — imported by both the
 *                     /explore star buttons and /api/favorite-spots
 *   custom spots      src/app/api/bluecaster/fishing-spots/custom/route.ts
 */

import {
  ANNUAL_PER_MONTH_CENTS,
  ANNUAL_PRICE_CENTS,
  TRIAL_DAYS,
  dollars,
} from "./pricing";

/**
 * How many spots a free account may save. Pro is unlimited, so there is no
 * matching PRO constant to keep in step.
 *
 * Two *separate* stores enforce this and they used to disagree: the /explore
 * star buttons keep favourites in localStorage (`rc-fav:<slug>`, see
 * `explore/lib/use-favorite.ts`) and capped at 1, while the DB-backed
 * `POST /api/favorite-spots` capped at 5 — and the sales copy claimed both
 * numbers. They read one constant now. Note the star does NOT write to that
 * table; the route's only callers today are the e2e specs, so the two counts
 * still can't see each other. Unifying them is separate work.
 */
export const FREE_FAVORITE_SPOTS = 1;

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
  // The charged amount, not the $2.75/mo pitch: the headline above the table
  // already does that division, and the column a customer scans for "what does
  // this cost me" should be the number that lands on their card.
  { id: "pro", label: "Pro", price: `${dollars(ANNUAL_PRICE_CENTS)}/yr` },
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
    id: "catch-reports",
    label: "See what anglers are actually catching, spot by spot",
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
  | "catch-log"
  | "catch-reports";

export interface NagFeature {
  /** Completes "Start your 7-day Pro trial to ___". Lower case, no period. */
  action: string;
  /**
   * Names the thing that was just blocked, as the modal's headline subject:
   * "View the full 14-day forecast", "Set an alert". Sentence case, no period
   * — `nagHeadline` appends " with a free trial", and " for <spot>" first when
   * `takesSpot` and a spot name is available.
   */
  headline: string;
  /** Does naming the spot make the headline read better ("Set an alert for X")? */
  takesSpot?: boolean;
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
    headline: "Set an alert",
    takesSpot: true,
    unlocksAt: "pro",
    rowId: "alerts",
    pricingFeature: "alerts",
  },
  "sms-alerts": {
    action: "get alerts by text",
    headline: "Get alerts by text",
    takesSpot: true,
    unlocksAt: "pro",
    rowId: "alerts",
    pricingFeature: "alerts",
  },
  "favorite-spots": {
    action: "save more spots",
    headline: "Save every spot you fish",
    unlocksAt: "pro",
    rowId: "save-spots",
    pricingFeature: "favorite-spots",
  },
  "custom-spots": {
    action: "score a spot we don’t cover",
    headline: "Create custom spots",
    unlocksAt: "pro",
    rowId: "custom-spots",
    pricingFeature: "custom-spots",
  },
  "forecast-week": {
    action: "plan a week ahead",
    headline: "See the week ahead",
    takesSpot: true,
    unlocksAt: "free",
    rowId: "week-ahead",
    pricingFeature: "14-day-forecast",
  },
  "forecast-14d": {
    action: "plan the full two weeks",
    headline: "View the full 14-day forecast",
    takesSpot: true,
    unlocksAt: "pro",
    rowId: "two-weeks",
    pricingFeature: "14-day-forecast",
  },
  "catch-log": {
    action: "log a catch",
    headline: "Log your catch",
    takesSpot: true,
    unlocksAt: "free",
    rowId: "catch-log",
    pricingFeature: "favorite-spots",
  },
  // Deliberately NOT spot-scoped: the pitch is the whole reporting stream
  // across every spot, not this one spot's numbers. "for Oak Bay Flats" would
  // undersell it to the size of whatever card they happened to click.
  "catch-reports": {
    action: "see what anglers are catching",
    headline: "Unlock all fresh catch reports",
    unlocksAt: "pro",
    rowId: "catch-reports",
    pricingFeature: "catch-reports",
  },
};

/**
 * The modal's headline: "Set an alert for Oak Bay Flats with a free trial".
 *
 * Leads with the thing the angler just tried to do, not with the product —
 * a nag that opens by naming the plan reads as an interruption, one that
 * opens by naming their own action reads as an answer.
 */
export function nagHeadline(
  feature: NagFeature,
  viewerTier: PlanTierId,
  spotName?: string,
): string {
  const subject =
    feature.takesSpot && spotName
      ? `${feature.headline} for ${spotName}`
      : feature.headline;
  return `${subject} with a free trial`;
}

/**
 * The reassurance line under the headline. Same for every wall now — the
 * modal sells the trial regardless of which one was hit, and the free tier is
 * offered by the link at its foot.
 *
 * One price, and the per-month division done for the reader. $33 is small
 * enough that the monthly framing is what makes it land ("less than a coffee")
 * while the yearly number is what they're actually agreeing to, so both appear
 * and the yearly one is the one attached to the verb "billed".
 */
export function nagSubhead(): string {
  return `Free for ${TRIAL_DAYS} days, then ${dollars(
    ANNUAL_PER_MONTH_CENTS,
  )} a month, billed yearly at ${dollars(
    ANNUAL_PRICE_CENTS,
  )}. Cancel anytime before the trial ends and you pay nothing.`;
}
