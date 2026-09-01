/**
 * The plan matrix — what a Member account and Pro each get.
 *
 * The Free/Pro rows and their ORDER are the ones written for the /plans page;
 * this module is now where they live, so the sales page and every in-app
 * upgrade prompt read from one list instead of drifting apart. Two columns
 * everywhere, /plans and the upgrade modal alike.
 *
 * There used to be a third "Browsing" column in the modal, on the theory that a
 * signed-out visitor needed to see what browsing already gave them. It made the
 * table a three-way comparison to answer a two-way question — free or paid —
 * and the extra column cost the feature labels the width they needed. A visitor
 * without an account reads the same two columns as everyone else; the free tier
 * is still offered by name at the foot of the modal.
 *
 * LIVE FEATURES ONLY — everything here is a promise attached to a charge, so
 * nothing lands on this table before it actually works. "Live" is not the same
 * as "gated": depth, hourly currents, photo-analysed catch logging and
 * guide-reviewed spots all ship today and are free, so they sit in every
 * column. Listing them is what makes the product look as deep as it is; hiding
 * them because they aren't paywalled would undersell the free tier and make Pro
 * read as a wall rather than an addition.
 *
 * Ordering is the argument, and the argument is what paying adds. The seven
 * Pro-only rows come first, so a reader who has just hit a wall finds the
 * answer to it in the rows under the buy button. The seven shared rows follow,
 * under a heading that says whose they are.
 *
 * They used to run the other way round: free rows first, on the theory that
 * showing a serious free tier earned the right to ask. It read as a case for
 * not paying. On a 390px phone every row visible under the button was a
 * matched pair of ticks, and the reader scrolled about 300px of "free already
 * has this" before reaching one thing Pro alone does.
 *
 * The shared rows stay, all seven, because they are the trust signal: this is
 * a deep tool and most of it costs nothing. They just belong after the pitch
 * rather than in front of it. `SHARED_ROW_START` marks where they begin and
 * `SHARED_ROW_HEADING` is the line that sits above them.
 *
 * The swap costs the old hinge. "Plan a week ahead" (free) used to sit next to
 * "Plan the full two weeks" (Pro), so one read as the obvious next step from
 * the other; they are in different blocks now. "Plan the full two weeks" leads
 * the Pro block instead, being the wall most readers arrive from.
 *
 * "No ads" sits second, because it is the one row a reader can judge without
 * knowing anything about fishing: they have already seen the ads on the page
 * the modal opened over. It is a real entitlement, not a slogan: <AdSlot>
 * renders nothing for a paid viewer, trialists included
 * (src/app/components/ads/ad-slot.tsx).
 *
 * Regulation-change alerts are still deliberately absent: built, not gated, and
 * not yet a thing a customer can switch on.
 *
 * Change a limit here in the same PR that changes its enforcement:
 *   forecast horizon  src/app/explore/lib/forecast-strip.ts (+ the two
 *                     forecast-14d route mirrors)
 *   alerts            src/app/api/alerts/route.ts
 *   saved spots       FREE_FAVORITE_SPOTS below — imported by both the
 *                     /explore star buttons and /api/saved-spots
 *   custom spots      src/app/api/bluecaster/fishing-spots/custom/route.ts
 *   ads               src/app/components/ads/ad-slot.tsx (the `isPaid` gate)
 */

import { PLAN_LABELS } from "./plan-labels";
import { TRIAL_DAYS, type PricingView } from "./pricing";

/**
 * How many spots a free account may save. Pro is unlimited, so there is no
 * matching PRO constant to keep in step.
 *
 * This is the cap on **saved spots** — the star on a spot card, stored in
 * `user_favorite_spots` and enforced by `POST /api/saved-spots`. The route is
 * the authority; `explore/lib/use-favorite.ts` checks the same constant first
 * only so it can open the upgrade modal without a round trip.
 *
 * It is NOT the cap on the older `POST /api/favorite-spots`, which writes the
 * `favorite_spots` table. That one stores an arbitrary place the user typed and
 * feeds the default-location picker — a saved *locations* list that kept a
 * confusingly similar name. The two used to be conflated: both were called
 * favourites, each enforced its own limit (1 here, 5 there), and the sales copy
 * quoted both numbers. They share this constant so the numbers can't drift
 * again, but they are separate features and only this one is what the star
 * means.
 */
export const FREE_FAVORITE_SPOTS = 1;

/**
 * Who is looking. Still three of these even though the table has two columns:
 * "anon" is a viewer state — it decides whether the modal offers the Member
 * tier at all — not a thing we quote a price for.
 *
 * These are identifiers, not labels. What each one is called on screen lives
 * in ./plan-labels, and `free` is called "Member" there.
 */
export type PlanTierId = "anon" | "free" | "pro";

/** The columns the matrix actually draws. */
export type PlanColumnId = Exclude<PlanTierId, "anon">;

export interface PlanTier {
  id: PlanColumnId;
  /** Column heading. */
  label: string;
  /** Price line under the heading. */
  price: string;
}

/**
 * The columns of the Free-vs-Pro table.
 *
 * A function of the reader's price rather than a constant, because the price
 * is a function of the reader now: see PricingView in ./pricing. Every caller
 * is a client component that already has the view in hand.
 */
export function planTiers(pricing: PricingView): PlanTier[] {
  return [
    { id: "free", label: PLAN_LABELS.free, price: "$0" },
    // The charged amount, not the $2.75/mo pitch: the headline above the table
    // already does that division, and the column a customer scans for "what
    // does this cost me" should be the number that lands on their card.
    { id: "pro", label: "Pro", price: `${pricing.amount}/yr` },
  ];
}

/**
 * A cell: `true` = included, `false` = not included, string = the actual limit.
 * Nothing quotes a limit today — the "Next 2 days" string belonged to the
 * Browsing column, which is gone — but the string case stays because a row like
 * "1 saved spot" is the natural way to write the next limit we surface.
 */
export type PlanCell = string | boolean;

export interface PlanFeatureRow {
  id: string;
  label: string;
  free: PlanCell;
  pro: PlanCell;
}

/**
 * Index of the first shared row: where the Pro-only block ends and the rows
 * both tiers get begin. The matrix draws its one strong divider here and hangs
 * `SHARED_ROW_HEADING` off it.
 */
export const SHARED_ROW_START = 7;

/**
 * The heading over the shared block. Phrased as a gift rather than a hedge:
 * "Free gets this too" reads as a tier being generous, where "also in Free"
 * reads as a list of what Pro fails to be worth.
 */
export const SHARED_ROW_HEADING = "Free gets this too";

/**
 * The phone sheet's three lines: a title and the reason it matters.
 *
 * Not the matrix rows. The matrix answers "what is the difference between two
 * columns" in as few words as a table cell allows; a sheet has one column and
 * room for a second line, and the second line is where the argument is.
 *
 * Reports lead. The forecast used to, and it was the headline said twice:
 * "See the next 14 days" over "14-day forecast at every spot" spends the
 * first and best line of the list restating the title. Reports are the one
 * thing on the list a reader cannot guess the shape of from the map behind
 * the sheet, and they are named after the place they cover, so the line reads
 * as this place's reports rather than a feature in the abstract.
 *
 * Three, and no more: a fourth costs the timeline its place above the fold on
 * a 667pt phone, and the timeline is what answers the objection.
 */
export function sheetFeatures(placeName?: string) {
  return [
    {
      id: "catch-reports",
      title: placeName ? `${placeName} Catch Reports` : "Catch reports",
      detail: "Updated daily with what is being caught and where.",
    },
    {
      id: "alerts",
      title: "Alerts when your spot turns on",
      detail: "Email or text the moment a good window opens.",
    },
    {
      id: "custom-spots",
      title: "Your own private spots",
      detail: "Score the places that are not on the map.",
    },
  ];
}

export const PLAN_FEATURES: PlanFeatureRow[] = [
  // ── what paying adds ──
  // First, because it is the wall most readers arrive from: every locked day
  // tile on the forecast strip opens this modal.
  { id: "two-weeks", label: "Plan the full two weeks", free: false, pro: true },
  // Stated as the thing you get, not the thing we stop doing to you: "No ads"
  // is a removal, "Read the water with no ads in it" is the product. The free
  // column takes a cross rather than the string "Ads" — this table lists what a
  // tier gets, and a tier does not "get" advertising.
  {
    id: "ad-free",
    label: "Read the water with no ads in the way",
    free: false,
    pro: true,
  },
  { id: "save-spots", label: "Save every spot you fish", free: false, pro: true },
  // Deliberately NOT "add your own spots" — that reads as another way of saying
  // "save". The value is that a spot we don't publish gets the full model run on
  // it, not that you can drop a pin.
  {
    id: "custom-spots",
    label: "Score a spot we don’t cover: your pin, our full model",
    free: false,
    pro: true,
  },
  // One row, not two. "Get alerted" and "get it by text" is one feature and its
  // delivery channel; splitting them padded the list and read as filler.
  {
    id: "alerts",
    label: "Alerts when it’s on, by text or email",
    free: false,
    pro: true,
  },
  {
    id: "catch-reports",
    label: "See what anglers are actually catching, spot by spot",
    free: false,
    pro: true,
  },
  {
    id: "all-cities",
    label: "Every covered city, one price",
    free: false,
    pro: true,
  },
  // ── SHARED_ROW_START: everything below is in the free tier as well ──
  // Trust first within this block: every published spot has been through
  // local-guide review.
  {
    id: "guide-reviewed",
    label: "Spots checked by a local guide before they go live",
    free: true,
    pro: true,
  },
  { id: "today-score", label: "See today’s bite score", free: true, pro: true },
  {
    id: "bathymetry",
    label: "Read the bottom: depth and structure",
    free: true,
    pro: true,
  },
  {
    id: "tide-hourly",
    label: "Watch the tide push through, hour by hour",
    free: true,
    pro: true,
  },
  { id: "regs", label: "Check the regs before you go", free: true, pro: true },
  {
    id: "catch-log",
    label: "Log a catch straight from the photo",
    free: true,
    pro: true,
  },
  // Last, so the shared block ends on the row nearest to what the Pro block
  // opened with. It is the closest the two halves get now.
  { id: "week-ahead", label: "Plan a week ahead", free: true, pro: true },
];

/* -------------------------------------------------------------------------
 * Nag features — the thing the angler just tried to do.
 * ---------------------------------------------------------------------- */

/**
 * Every action on /explore that can hit a wall.
 *
 * "remove-ads" is the odd one out: nothing was blocked, the reader just wants
 * the ad gone. It rides the same machinery because the answer is identical —
 * the same modal, opened on the row that covers it.
 */
export type NagFeatureId =
  | "alerts"
  | "sms-alerts"
  | "favorite-spots"
  | "custom-spots"
  | "forecast-week"
  | "forecast-14d"
  | "catch-log"
  | "catch-reports"
  | "remove-ads"
  | "support-the-map"
  | "support"
  | "whole-map"
  | "depth-gate";

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
  /**
   * Row in the matrix to highlight. Optional, because not every prompt is
   * answered by one row: "support the map" is an argument for the whole table,
   * and singling out a line of it would be a smaller pitch than the truth.
   */
  rowId?: string;
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
  // A locked day inside the first week, which a free account opens. The id and
  // the `unlocksAt` still say so, because the paywall counter and the wall
  // cookie split day-3 taps from day-9 taps and that split is what tells the
  // two walls apart in the reports.
  //
  // The COPY does not split. Every locked day tile, whichever one it is, opens
  // a modal that asks for the full fourteen: a reader who just reached for a
  // date wants the whole run of dates, and offering them a week when the tile
  // beside it is still locked sells them a smaller thing twice. So this shares
  // the 14-day headline and highlights the same matrix row.
  "forecast-week": {
    action: "plan the full two weeks",
    headline: "View the full 14-day forecast",
    takesSpot: true,
    unlocksAt: "free",
    rowId: "two-weeks",
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
  // Fired by the house card that stands in for an ad that never arrived —
  // usually because the reader blocks them. No rowId: someone who already has
  // no ads is not being sold ad removal, and there is no single row that says
  // "keep this thing running". The whole matrix is the answer to that.
  "support-the-map": {
    action: "support the map",
    headline: "Support ReelCaster",
    unlocksAt: "pro",
    pricingFeature: "support-the-map",
  },
  // The Port, the Pro-only support portal at /support. The wall there is the
  // card, not this modal: nothing opens ProTrialModal with this id today. It
  // is a member of the enum anyway, because the paywall counter validates
  // every report against this list and a wall whose feature is not on it is
  // counted nowhere. That is precisely how /support went unmeasured.
  support: {
    action: "open the support portal",
    headline: "Open The Port",
    unlocksAt: "pro",
    pricingFeature: "support",
  },
  // Fired by the "remove ads" link under an ad unit, so the reader arrives
  // having just looked at the thing they want gone. Not spot-scoped: ads are a
  // property of the page, not of whichever card the unit landed next to.
  "remove-ads": {
    action: "remove the ads",
    headline: "Remove the ads",
    unlocksAt: "pro",
    rowId: "ad-free",
    pricingFeature: "remove-ads",
  },
  // NOTHING OPENS THIS TODAY. It was the proactive ask on /explore and the
  // spot page, the only entry here that no click asked for, and both were
  // removed after seven days of impressions with no clicks at all: the
  // headline promises to unlock a map that was never locked, which is a poor
  // pitch to interrupt someone with. The entry stays because the copy is the
  // one thing that was not wrong with it, and a future ask that a visitor
  // actually initiates could use it. Nothing was blocked, so there is no row
  // to highlight and the whole matrix is the pitch, same as "support the map".
  "whole-map": {
    action: "open the whole map",
    headline: "Unlock the whole map",
    unlocksAt: "pro",
    pricingFeature: "whole-map",
  },
  // The depth gate on /m/explore: "Enjoying ReelCaster?", the one unprompted
  // ask a visitor gets, fired by the engagement count rather than by a lock.
  //
  // IT DOES NOT OPEN ProTrialModal and it does not sell Pro — it asks for a
  // free account, because registering is what brings the charted depth back.
  // It is a member of this enum anyway, for the same reason "support" is: the
  // paywall reporter validates every event against this list and an ask that
  // is not on it is counted nowhere. That is precisely how this gate went
  // unmeasured for its whole life, on the surface that sees the most bought
  // traffic in the product.
  //
  // `unlocksAt: "free"` is the honest answer and is what separates it from
  // every Pro wall in the report. No rowId: the plan matrix is not what it
  // shows, and highlighting a Pro row for an ask that costs nothing would be a
  // pitch it never makes. See explore/components/depth-gate-prompt.tsx.
  "depth-gate": {
    action: "keep the depth on the map",
    headline: "Keep reading the bottom",
    unlocksAt: "free",
    pricingFeature: "whole-map",
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
export function nagSubhead(pricing: PricingView): string {
  return `Free for ${TRIAL_DAYS} days, then ${pricing.perMonth} a month, billed yearly at ${pricing.amount}. Cancel anytime before the trial ends and you pay nothing.`;
}
