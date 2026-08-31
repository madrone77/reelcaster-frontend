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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "pro" | "signup";
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
    />
  );
}
