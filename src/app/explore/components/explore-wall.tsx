"use client";

import { useEffect } from "react";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import { useTrialModal } from "@/hooks/use-paywall-modal";
import { useIsPhone } from "@/hooks/use-is-phone";
import { coverMap } from "@/lib/map/map-cover";
import type { NagFeatureId } from "@/lib/plan-features";

/**
 * Every wall /explore can raise, in one place.
 *
 * ONE COMPONENT, not nine. The map raises walls from six components: the
 * star on a card and in the drawer, the reports strip on both, a locked day
 * tile in three places, add-a-spot, alerts, and the ad frame's third spot
 * open. They all render this, with the props they already passed, and this
 * renders <ProTrialModal>: the same sheet every other surface in the product
 * opens, reported the same way.
 *
 * It used to choose between that sheet and a two-step "join prompt" for a
 * split test (explore_join_prompt_v1, concluded 2026-09-10). The chooser and
 * the second modal are gone: a locked thing opens the sheet, and nothing
 * between the tap and the sheet reads a cookie or a registry.
 *
 * The modal chunk is warmed on an idle frame and rendered without a Suspense
 * boundary (@/hooks/use-paywall-modal), so the tap has nothing to download.
 */
export default function ExploreWall({
  open,
  onOpenChange,
  feature,
  from,
  spotName,
  placeName,
  cityName,
  headline,
  context,
  region,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the counter records. */
  feature: NagFeatureId;
  from: string;
  spotName?: string;
  placeName?: string;
  cityName?: string;
  /** The wall's own sentence for the modal; see ProTrialModal. */
  headline?: string;
  context?: Record<string, string | number | boolean>;
  /**
   * Billing region of the water under the camera ("WA", "BC"), when known.
   * Prices the sheet and the Stripe session in that currency rather than the
   * reader's IP country.
   */
  region?: string;
}) {
  /**
   * Pause the map on the TAP, not once the sheet is up.
   *
   * <ProTrialModal> covers the map while it is open (FE #781, the frozen
   * email field), but it can only do that once it has mounted. This component
   * is statically imported and already mounted, so it takes the cover one
   * commit earlier, while the sheet's chunk is still resolving. Phone only:
   * the desktop dialog leaves the map visible around it. The cover is
   * counted, so this and the modal's own overlap harmlessly.
   */
  const phone = useIsPhone();
  useEffect(() => {
    if (!open || !phone) return;
    return coverMap();
  }, [open, phone]);

  // Keeps the chunk off page load while still letting the modal animate
  // closed. Same latch ./upgrade-dialog used.
  const mounted = useMountedOnce(open);
  const ProTrialModal = useTrialModal(mounted);
  if (!mounted || !ProTrialModal) return null;

  return (
    <ProTrialModal
      open={open}
      onOpenChange={onOpenChange}
      feature={feature}
      headline={headline}
      from={from}
      spotName={spotName}
      placeName={placeName}
      cityName={cityName}
      context={context}
      region={region}
    />
  );
}
