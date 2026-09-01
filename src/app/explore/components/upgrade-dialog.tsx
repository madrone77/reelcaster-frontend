"use client";

import dynamic from "next/dynamic";
import { useMountedOnce } from "@/hooks/use-mounted-once";

// Loaded on the tap that opens it, not with the map. This wrapper is rendered
// unconditionally by the forecast strip and the mobile sheet, so a static
// import put the plan matrix, the pricing tables and the Stripe checkout
// client into the chunks /explore parses before it can hydrate — on a page
// whose whole job is a map. Matches `TrialModalButton`, which already does
// this for the marketing CTAs.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

/**
 * Shown when a locked forecast day is tapped. Thin wrapper over the shared
 * `<ProTrialModal>` so every locked day, favourite cap and alert wall on
 * /explore shows one modal with one plan matrix.
 *
 * `variant` picks WHICH WALL was hit, not who hit it:
 *
 * - "pro" (default): a Pro day (8–14).
 * - "signup": a locked day that a free account unlocks (3–7).
 *
 * Both variants show the same 14-day headline. The split is for reporting, not
 * for copy: a reader who reached for a date is asking for the whole run of
 * dates, so no locked tile offers them a week. See NAG_FEATURES in
 * lib/plan-features.ts.
 *
 * It deliberately does NOT pass `viewerTier`. It used to force "free" for the
 * pro variant, which told a signed-out visitor the matrix's Free column was
 * "You" and suppressed the free-signup offer at the foot of the modal. The
 * modal reads the real tier from auth itself.
 */
export default function UpgradeDialog({
  open,
  onOpenChange,
  variant = "pro",
  dayIndex,
  spotName,
  placeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "pro" | "signup";
  /**
   * The spot whose locked day was tapped, when there is one.
   *
   * The spot page has it. /explore's viewport strip does not and must not
   * invent one: that strip folds a whole bbox into a single row of days, so
   * there is no one spot the reader asked about. The phone sheet names the
   * spot in its headline and drops the phrase when it is absent.
   */
  spotName?: string;
  /**
   * The city under the map camera, for the walls that are about a viewport
   * rather than a spot. The strip folds a whole bbox into one row of days, so
   * "the next 14 days at Seattle" is the honest way to name what the reader
   * is actually looking at; `spotName` still wins where there is one.
   */
  placeName?: string;
  /**
   * Which tile they reached for, 0-based from today. Reported, never shown.
   *
   * The feature id already splits the fortnight in two — days 3-7 are
   * "forecast-week", days 8-14 are "forecast-14d" — and that split is what
   * tells the two walls apart in the reports. This is the finer answer under
   * it: whether the tiles people actually reach for are the ones just past the
   * edge of what they have, or the far end of the run. Those imply different
   * things about what the horizon should be, and neither is visible from a
   * two-bucket count.
   */
  dayIndex?: number;
}) {
  // Latched, so closing the modal doesn't rip it out mid-animation.
  const mounted = useMountedOnce(open);
  if (!mounted) return null;

  return (
    <ProTrialModal
      open={open}
      onOpenChange={onOpenChange}
      feature={variant === "signup" ? "forecast-week" : "forecast-14d"}
      from="explore-forecast"
      spotName={spotName}
      placeName={placeName}
      context={typeof dayIndex === "number" ? { day_index: dayIndex } : undefined}
    />
  );
}
