/**
 * The plan matrix — what a visitor, a free account, and a Pro member each get.
 *
 * This is the single place that answers "what does Pro unlock". It exists
 * because the answer was previously spread across the pricing card, the
 * paywall card's default bullets, the FAQ, the support portal's KB, and a
 * dozen server-side limit constants — and those had already drifted from each
 * other. The upgrade modal, and anything else that has to show a comparison,
 * reads from here.
 *
 * Rows only claim what the code actually enforces (or what /pricing already
 * sells). If you change a limit — alert count, favourite cap, forecast horizon
 * — change it here in the same PR, or the modal starts lying to people who are
 * about to pay.
 *
 * Enforcement lives at:
 *   forecast horizon  src/app/explore/lib/forecast-strip.ts (+ the two
 *                     forecast-14d route mirrors)
 *   alerts            src/app/api/alerts/route.ts
 *   favourites        src/app/api/favorite-spots/route.ts
 *   custom spots      src/app/api/bluecaster/fishing-spots/custom/route.ts
 *   The Port          src/app/api/support/tickets/route.ts
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
 * Strings beat ticks — "7 days" tells an angler more than a checkmark does.
 */
export type PlanCell = string | boolean;

export interface PlanFeatureRow {
  id: string;
  label: string;
  anon: PlanCell;
  free: PlanCell;
  pro: PlanCell;
}

export interface PlanFeatureGroup {
  id: string;
  label: string;
  rows: PlanFeatureRow[];
}

export const PLAN_FEATURES: PlanFeatureGroup[] = [
  {
    id: "forecast",
    label: "Forecast",
    rows: [
      {
        id: "map",
        label: "Live map + spot pages",
        anon: true,
        free: true,
        pro: true,
      },
      {
        id: "horizon",
        label: "Forecast horizon",
        anon: "2 days",
        free: "7 days",
        pro: "14 days",
      },
      {
        id: "hourly",
        label: "Hourly scores + best windows",
        anon: true,
        free: true,
        pro: true,
      },
      {
        id: "breakdown",
        label: "Full score breakdown + evidence",
        anon: false,
        free: false,
        pro: true,
      },
    ],
  },
  {
    id: "alerts",
    label: "Alerts",
    rows: [
      {
        id: "alert-count",
        label: "Alert profiles",
        anon: false,
        free: "1",
        pro: "10",
      },
      // Split into tick rows rather than one "Score only / All four" cell —
      // the value columns are narrow on a phone, and a tick survives 375px
      // where a phrase wraps to four lines.
      {
        id: "alert-score-trigger",
        label: "Score-threshold triggers",
        anon: false,
        free: true,
        pro: true,
      },
      {
        id: "alert-composite-trigger",
        label: "Wind, tide + pressure triggers",
        anon: false,
        free: false,
        pro: true,
      },
      {
        id: "alert-email",
        label: "Email delivery",
        anon: false,
        free: true,
        pro: true,
      },
      {
        id: "alert-sms",
        label: "SMS delivery",
        anon: false,
        free: false,
        pro: true,
      },
    ],
  },
  {
    id: "spots",
    label: "Your spots",
    rows: [
      {
        id: "favorites",
        label: "Favourite spots",
        anon: false,
        free: "5",
        pro: "Unlimited",
      },
      {
        id: "custom-spots",
        label: "Custom spots — your own pins",
        anon: false,
        free: false,
        pro: true,
      },
      {
        id: "catch-log",
        label: "Catch log with photo analysis",
        anon: false,
        free: true,
        pro: true,
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    rows: [
      {
        id: "help",
        label: "Guides + knowledge base",
        anon: true,
        free: true,
        pro: true,
      },
      {
        id: "port",
        label: "The Port — priority support",
        anon: false,
        free: false,
        pro: true,
      },
    ],
  },
];

/** Every row, flattened — for highlight lookups. */
export const PLAN_FEATURE_ROWS: PlanFeatureRow[] = PLAN_FEATURES.flatMap(
  (g) => g.rows,
);

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
  | "breakdown"
  | "catch-log"
  | "support";

export interface NagFeature {
  /** Completes "Start your 7-day Pro trial to ___". Lower case, no period. */
  action: string;
  /** Lowest tier that unlocks it — decides whether we sell Pro or an account. */
  unlocksAt: "free" | "pro";
  /** Row in the matrix to highlight. */
  rowId: string;
  /** `?feature=` carried to /pricing — must match a FEATURE_COPY key there. */
  pricingFeature: string;
}

export const NAG_FEATURES: Record<NagFeatureId, NagFeature> = {
  alerts: {
    action: "create an alert",
    unlocksAt: "pro",
    rowId: "alert-count",
    pricingFeature: "alerts",
  },
  "sms-alerts": {
    action: "get alerts by text",
    unlocksAt: "pro",
    rowId: "alert-sms",
    pricingFeature: "alerts",
  },
  "favorite-spots": {
    action: "save more spots",
    unlocksAt: "pro",
    rowId: "favorites",
    pricingFeature: "favorites",
  },
  "custom-spots": {
    action: "add your own spot",
    unlocksAt: "pro",
    rowId: "custom-spots",
    pricingFeature: "custom-spots",
  },
  "forecast-week": {
    action: "see the week ahead",
    unlocksAt: "free",
    rowId: "horizon",
    pricingFeature: "14-day-forecast",
  },
  "forecast-14d": {
    action: "see all 14 days",
    unlocksAt: "pro",
    rowId: "horizon",
    pricingFeature: "14-day-forecast",
  },
  breakdown: {
    action: "open the full breakdown",
    unlocksAt: "pro",
    rowId: "breakdown",
    pricingFeature: "spot-horizon",
  },
  "catch-log": {
    action: "log a catch",
    unlocksAt: "free",
    rowId: "catch-log",
    pricingFeature: "favorites",
  },
  support: {
    action: "open The Port",
    unlocksAt: "pro",
    rowId: "port",
    pricingFeature: "support",
  },
};

/** "Start your 7-day Pro trial to create an alert" — the modal's headline. */
export function nagHeadline(
  feature: NagFeature,
  viewerTier: PlanTierId,
): string {
  // A signed-out visitor blocked by something a free account already gives
  // gets sold the account, not the subscription — asking for a card to see
  // day 5 of a forecast a free login unlocks is a way to lose the signup.
  if (feature.unlocksAt === "free" && viewerTier === "anon") {
    return `Create a free account to ${feature.action}`;
  }
  return `Start your ${TRIAL_DAYS}-day Pro trial to ${feature.action}`;
}

/** The reassurance line under the headline. */
export function nagSubhead(
  feature: NagFeature,
  viewerTier: PlanTierId,
): string {
  if (feature.unlocksAt === "free" && viewerTier === "anon") {
    return "Takes about 30 seconds. No card, no charge.";
  }
  return `Free for ${TRIAL_DAYS} days, then $${MONTHLY_PRICE_CENTS / 100}/month or $${
    ANNUAL_PRICE_CENTS / 100
  }/year. Cancel anytime before the trial ends and you pay nothing.`;
}
