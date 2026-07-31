"use client";

import ProTrialModal from "@/app/components/paywall/pro-trial-modal";

/**
 * Shown when a locked forecast day is tapped. Thin wrapper over the shared
 * `<ProTrialModal>` so every locked day, favourite cap and alert wall on
 * /explore shows one modal with one plan matrix.
 *
 * - "pro" (default): a signed-in free user tapped a Pro day (8–14).
 * - "signup": a signed-out visitor tapped a locked day — days 3–7 come with a
 *   free account, so the modal sells the account, not the subscription.
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
      viewerTier={variant === "signup" ? "anon" : "free"}
      from="explore-forecast"
    />
  );
}
