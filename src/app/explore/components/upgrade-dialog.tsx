"use client";

import ProTrialModal from "@/app/components/paywall/pro-trial-modal";

/**
 * Shown when a locked forecast day is tapped. Thin wrapper over the shared
 * `<ProTrialModal>` so every locked day, favourite cap and alert wall on
 * /explore shows one modal with one plan matrix.
 *
 * `variant` picks WHICH WALL was hit, not who hit it:
 *
 * - "pro" (default): a Pro day (8–14).
 * - "signup": a locked day that a free account unlocks (3–7), so the modal
 *   sells the account rather than the subscription.
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
  return (
    <ProTrialModal
      open={open}
      onOpenChange={onOpenChange}
      feature={variant === "signup" ? "forecast-week" : "forecast-14d"}
      from="explore-forecast"
    />
  );
}
