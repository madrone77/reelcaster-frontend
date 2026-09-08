"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import { useJoinPrompt } from "@/app/components/split-test/use-join-prompt";
import type { NagFeatureId } from "@/lib/plan-features";
import type { JoinPromptKey } from "../lib/join-prompt-copy";
import JoinPromptModal from "./join-prompt-modal";

// Loaded on the tap that opens it, not with the map — the plan matrix, the
// pricing tables and the Stripe client are a large thing to parse on a page
// whose whole job is a map. Same reasoning as ./upgrade-dialog, which this
// now sits under.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

/**
 * Every wall /explore can raise, and which of the two shapes answers it.
 *
 * ONE SWITCH, not nine. The map raises walls from six components — the star
 * on a card and in the drawer, the reports strip on both, a locked day tile
 * in three places, add-a-spot, alerts, and the ad frame's third spot open —
 * and each of them used to name <ProTrialModal> itself. Putting the arm check
 * in each would have been nine copies of the same condition and nine chances
 * for one of them to drift out of the test. They all render this instead, with
 * the props they already passed.
 *
 * Arm a, and everyone outside the test, gets exactly what they got before:
 * <ProTrialModal>, same feature, same surface, same reporting. Arm b gets
 * <JoinPromptModal>, which reports through the same counters under the same
 * ids so the two arms are comparable. See use-join-prompt for what the test
 * asks and how it is read.
 *
 * THE TRIAL LINE ESCALATES rather than navigates. Pressing it on the small
 * modal swaps in the full one, still open, still carrying this wall's feature
 * and surface — so the reader who wants the pitch gets all of it without a
 * page load, and the big modal fires its own impression because it really was
 * shown. That is why `escalated` is state here and not inside the small modal:
 * the swap is between two siblings, and only their parent can make it.
 *
 * SCOPE IS /explore. The same walls exist on the spot page, the dashboard and
 * the city pages and are deliberately untouched: the test is about the surface
 * that sees the most bought traffic, and widening it would put four more
 * populations into one number.
 */
export default function ExploreWall({
  open,
  onOpenChange,
  feature,
  prompt,
  from,
  spotName,
  placeName,
  cityName,
  context,
  eligible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the counter records, on both arms. */
  feature: NagFeatureId;
  /** What the small modal's words say, where that differs from `feature`. */
  prompt?: JoinPromptKey;
  from: string;
  spotName?: string;
  placeName?: string;
  cityName?: string;
  context?: Record<string, string | number | boolean>;
  /**
   * Whether this wall is in the test at all. True everywhere on /explore.
   *
   * It exists for one caller: ./upgrade-dialog is the shared locked-day
   * wrapper, and the city page and the spot page render it too. Those are out
   * of scope, so they pass false and get the full modal and no exposure — a
   * wall counted into a test it cannot be treated by would sit in arm b's
   * denominator having never seen arm b.
   */
  eligible?: boolean;
}) {
  const { compact } = useJoinPrompt(open && eligible);

  /**
   * Latched for the life of the wall, then cleared on close. Without the
   * clear, a reader who opened the pitch once would get the big modal for
   * every wall afterwards and quietly leave arm b for the rest of the visit.
   */
  const [escalated, setEscalated] = useState(false);
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setEscalated(false);
      onOpenChange(next);
    },
    [onOpenChange],
  );

  // Keeps the dynamic chunk off page load while still letting the modal
  // animate closed. Same latch ./upgrade-dialog used.
  const mounted = useMountedOnce(open);
  if (!mounted) return null;

  if (compact && eligible && !escalated) {
    return (
      <JoinPromptModal
        open={open}
        onOpenChange={handleOpenChange}
        feature={feature}
        prompt={prompt}
        from={from}
        spotName={spotName}
        context={context}
        onStartTrial={() => setEscalated(true)}
      />
    );
  }

  return (
    <ProTrialModal
      open={open}
      onOpenChange={handleOpenChange}
      feature={feature}
      from={from}
      spotName={spotName}
      placeName={placeName}
      cityName={cityName}
      context={context}
    />
  );
}
