"use client";

import { useCallback, useEffect, useState } from "react";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import { usePlanChoiceModal, useTrialModal } from "@/hooks/use-paywall-modal";
import { useIsPhone } from "@/hooks/use-is-phone";
import { coverMap } from "@/lib/map/map-cover";
import { useJoinPrompt } from "@/app/components/split-test/use-join-prompt";
import type { NagFeatureId } from "@/lib/plan-features";
import type { JoinPromptKey } from "../lib/join-prompt-copy";
import JoinPromptModal from "./join-prompt-modal";

// Both modals are code-split — the plan matrix, the pricing tables and the
// Stripe client are a large thing to parse on a page whose whole job is a
// map — but neither is loaded ON the tap any more. @/hooks/use-paywall-modal
// warms the chunk on an idle frame and hands the component back without a
// Suspense boundary; see there and @/lib/paywall-preload for the two things
// that were costing a tapped wall two seconds.

/** Which of arm b's two screens the reader is on. */
type Step = "prompt" | "choice";

/**
 * Every wall /explore can raise, and which of the two shapes answers it.
 *
 * ONE SWITCH, not nine. The map raises walls from six components — the star
 * on a card and in the drawer, the reports strip on both, a locked day tile
 * in three places, add-a-spot, alerts, and the ad frame's third spot open —
 * and each of them used to name <ProTrialModal> itself. Putting the arm check
 * in each would have been nine copies of the same condition and nine chances
 * for one of them to drift out of the test. They all render this instead,
 * with the props they already passed.
 *
 * ARM A, and everyone outside the test, gets exactly what they got before:
 * <ProTrialModal>, same feature, same surface, same reporting.
 *
 * ARM B IS TWO SCREENS, and the first one asks almost nothing:
 *
 *   prompt  <JoinPromptModal>   what you reached for. Join now / Sign in,
 *                               and not a word about plans or prices.
 *   choice  <PlanChoiceModal>   the live trial sheet — the same rows, the
 *                               same email field, the same button — whose
 *                               button opens Stripe directly, with a bare
 *                               "Join as a Member" under it.
 *
 * No third modal, and no plan matrix on this arm: prompt, sheet, Stripe. The
 * old wall put the card form in front of a tapped star; this puts one small
 * question in front of it and then the same form, one deliberate tap later,
 * for the readers who answered it. Sign in and Join-as-a-Member navigate out
 * and end the chain there.
 *
 * THE STEP IS PARENT STATE, not something the modals hold, because the swap
 * is between siblings and only their parent can make one. It resets on close,
 * or a reader who once reached the sheet would keep reopening it for the rest
 * of the visit and quietly leave arm b's first screen behind.
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
  headline,
  context,
  eligible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the counter records, on every step and both arms. */
  feature: NagFeatureId;
  /** What the prompt's title says, where that differs from `feature`. */
  prompt?: JoinPromptKey;
  from: string;
  spotName?: string;
  placeName?: string;
  cityName?: string;
  /** The wall's own sentence for the full modal; see ProTrialModal. */
  headline?: string;
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
   * Pause the map on the TAP, not once the sheet is up.
   *
   * <ProTrialModal> already covers the map while it is open (FE #781, the
   * frozen email field). That cover can only be taken once the sheet has
   * mounted, which is the wrong end of the problem: the expensive moment is
   * the render before it, where the sheet's own work queues behind a map that
   * is still laying out symbols and drawing frames. This component is
   * statically imported and already mounted, so it can take the cover one
   * commit earlier — as the state that opens the wall lands, while the
   * sheet's chunk is still resolving.
   *
   * Phone only, and not for the join prompt: that one is a centred dialog
   * with the map visible around it, and a map that stops mid-load behind a
   * small dialog is a bug rather than an optimisation. The cover is counted,
   * so this and the modal's own overlap harmlessly.
   */
  const phone = useIsPhone();
  const sheetWillCover = phone && !(compact && eligible);
  useEffect(() => {
    if (!open || !sheetWillCover) return;
    return coverMap();
  }, [open, sheetWillCover]);

  const [step, setStep] = useState<Step>("prompt");
  /**
   * Where the chooser's Member button sends them. The prompt captures it from
   * the address bar as it opens (see there for why not `useSearchParams`) and
   * hands it up, so the chooser does not have to read the URL a second time
   * at a moment when the map behind it may have moved on.
   */
  const [signupHref, setSignupHref] = useState("/signup");

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) setStep("prompt");
      onOpenChange(next);
    },
    [onOpenChange],
  );

  // Keeps the dynamic chunks off page load while still letting a modal
  // animate closed. Same latch ./upgrade-dialog used.
  const mounted = useMountedOnce(open);
  // Warmed on an idle frame and rendered without a Suspense boundary; see
  // @/hooks/use-paywall-modal. Every wall the map raises renders this
  // component, and the warm is shared, so the nine of them cost one fetch.
  const ProTrialModal = useTrialModal(mounted && !(compact && eligible));
  const PlanChoiceModal = usePlanChoiceModal(mounted && compact && eligible);
  if (!mounted) return null;

  if (compact && eligible) {
    if (step === "choice") {
      if (!PlanChoiceModal) return null;
      return (
        <PlanChoiceModal
          open={open}
          onOpenChange={handleOpenChange}
          feature={feature}
          from={from}
          // The city under the map camera, unless a caller named one. The
          // chooser has no place of its own to draw on, and its header is
          // the same header the sheet on every other surface wears.
          cityName={cityName ?? placeName}
          signupHref={signupHref}
        />
      );
    }
    return (
      <JoinPromptModal
        open={open}
        onOpenChange={handleOpenChange}
        feature={feature}
        prompt={prompt}
        from={from}
        spotName={spotName}
        context={context}
        onJoin={() => setStep("choice")}
        onSignupHref={setSignupHref}
      />
    );
  }

  if (!ProTrialModal) return null;
  return (
    <ProTrialModal
      open={open}
      onOpenChange={handleOpenChange}
      feature={feature}
      headline={headline}
      from={from}
      spotName={spotName}
      placeName={placeName}
      cityName={cityName}
      context={context}
    />
  );
}
