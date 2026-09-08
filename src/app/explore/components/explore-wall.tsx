"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import { useJoinPrompt } from "@/app/components/split-test/use-join-prompt";
import type { NagFeatureId } from "@/lib/plan-features";
import type { JoinPromptKey } from "../lib/join-prompt-copy";
import JoinPromptModal from "./join-prompt-modal";

// Loaded on the tap that opens them, not with the map — the plan matrix, the
// pricing tables and the Stripe client are a large thing to parse on a page
// whose whole job is a map. Same reasoning as ./upgrade-dialog, which this
// now sits under. The chooser is deferred for the same reason one step
// earlier: most readers who see the join prompt never ask for it.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);
const PlanChoiceModal = dynamic(
  () => import("@/app/components/paywall/plan-choice-modal"),
  { ssr: false },
);

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
  if (!mounted) return null;

  if (compact && eligible) {
    if (step === "choice") {
      return (
        <PlanChoiceModal
          open={open}
          onOpenChange={handleOpenChange}
          feature={feature}
          from={from}
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
