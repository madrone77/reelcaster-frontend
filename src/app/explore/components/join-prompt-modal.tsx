"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { useAnalytics } from "@/hooks/use-analytics";
import { captureWall } from "@/lib/attribution";
import { reportPaywall } from "@/lib/paywall-counter";
import { noteWallShown } from "@/lib/upgrade-nag";
import { TRIAL_DAYS } from "@/lib/pricing";
import type { NagFeatureId, PlanTierId } from "@/lib/plan-features";
import { joinPromptFor, type JoinPromptKey } from "../lib/join-prompt-copy";

/**
 * The small wall on /explore: what you reached for, and the account that
 * gets you closer to it.
 *
 * IT IS THE SAME WALL, IN A SMALLER ROOM. Every trigger that used to open
 * <ProTrialModal> on this surface — the ad frame's third spot open, a locked
 * day tile, the star at the saved-spot cap, add-a-spot, alerts, catch
 * reports — opens this instead on arm b of `explore_join_prompt_v1`. Nothing
 * about what is gated changes. What changes is the first thing a tap gets:
 * a fourteen-row plan matrix and a card form, or two sentences and a free
 * account.
 *
 * THE ASK IS AN ACCOUNT. "Join now" and "Sign in", in that order, because
 * the reader this fires for most often has neither. Pro is still sold, from
 * the quiet line under the buttons, and pressing it hands off to the full
 * modal with the same feature and surface — so a reader who wants the pitch
 * is one tap from all of it and nobody is shown it who did not ask.
 *
 * IT DOES NOT OVERSELL. Most of these walls are Pro-only and an account does
 * not open them; ../lib/join-prompt-copy carries that rule and the wording.
 *
 * SHAPE AND SIZE ARE THE INTRO CARD'S: about 340px of card, a title, a line
 * or two, a full-width button. Not the intro card's transparency, though.
 * That card was about the map behind it and deliberately had no scrim and no
 * focus trap; this one is a question that wants an answer, so it uses the
 * shared <Dialog> like every other wall and closes the same four ways.
 *
 * IT REPORTS EXACTLY AS THE BIG MODAL DOES — same `feature`, same `surface`,
 * same impression/cta_click/dismiss triple through lib/paywall-counter, the
 * same `captureWall` cookie and the same `noteWallShown`. That is not
 * incidental: the split's whole read is walls seen, walls taken and trials
 * started per arm, and an arm that counted differently could not be compared
 * to the one it replaced.
 */
export default function JoinPromptModal({
  open,
  onOpenChange,
  feature,
  prompt,
  from,
  spotName,
  context,
  onStartTrial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the counter records. Unchanged from the wall this replaces. */
  feature: NagFeatureId;
  /** What the words say. Defaults to `feature`; see JoinPromptKey. */
  prompt?: JoinPromptKey;
  /** The surface id the wall already reported under. */
  from: string;
  /** Named in the title's second line where there is one. */
  spotName?: string;
  context?: Record<string, string | number | boolean>;
  /** Hands off to the full <ProTrialModal>. The parent does the swap. */
  onStartTrial: () => void;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();

  const copy = joinPromptFor(prompt ?? feature);
  const viewerTier: PlanTierId = isPaid ? "pro" : user ? "free" : "anon";

  /**
   * A signed-in free angler has already done the joining. Showing them "Join
   * now" is the modal failing to look at who it is talking to, and the two
   * walls that fire for them almost exclusively — the alert limit, the saved
   * spot cap — are Pro walls anyway. For them the trial is the only honest
   * button, so it becomes the primary one and the account row goes.
   */
  const hasAccount = Boolean(user);

  /**
   * Where to come back to, captured from the address bar rather than built
   * from a router hook: /explore keeps its whole state in the query string
   * (the camera, the day, the ad frame), and `useSearchParams` would put a
   * Suspense requirement on every component that renders this wall to fetch
   * something `window.location` already has. Read on open, so it reflects
   * the map as it stood when they were stopped.
   */
  const [next, setNext] = useState("/explore");
  useEffect(() => {
    if (!open) return;
    setNext(`${window.location.pathname}${window.location.search}`);
  }, [open]);

  const contextRef = useRef(context);
  contextRef.current = context;

  // Refs, not state: nothing here is rendered, and a setState on open would
  // redraw the map behind the modal to store a timestamp only a beacon reads.
  const openedAt = useRef<number | null>(null);
  const acted = useRef(false);

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    acted.current = false;
    trackEvent("Upgrade Prompt Shown", {
      feature,
      viewerTier,
      from,
      shape: "join-prompt",
      timestamp: new Date().toISOString(),
    });
    reportPaywall("impression", {
      feature,
      surface: from,
      viewerTier,
      context: contextRef.current,
    });
    // Same two side effects the big modal has on open: restart the engagement
    // count so the depth gate cannot stack on top of a wall, and drop the
    // 30-minute cookie that tells /signup or Stripe which wall sent them.
    noteWallShown();
    captureWall(feature, from);
  }, [open, feature, viewerTier, from, trackEvent]);

  /**
   * A close with no click is a refusal. A close after one is not: the account
   * links navigate and the trial line swaps this modal for the big one, and
   * both would otherwise be filed as somebody saying no.
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && !acted.current) {
        reportPaywall("dismiss", {
          feature,
          surface: from,
          viewerTier,
          context: contextRef.current,
          dwellMs: openedAt.current ? Date.now() - openedAt.current : undefined,
        });
      }
      onOpenChange(nextOpen);
    },
    [feature, from, viewerTier, onOpenChange],
  );

  /**
   * One click counter for all three buttons, marked by where it goes.
   *
   * `destination` is never "checkout" here, which matters: the counter route
   * answers a checkout tap with a Meta event id, and this modal has no card
   * form on it. The trial line is a hop to the modal that does.
   */
  const takeCta = useCallback(
    (destination: "signup" | "login" | "trial-modal") => {
      acted.current = true;
      trackEvent("Paywall CTA Clicked", {
        feature,
        viewerTier,
        from,
        shape: "join-prompt",
        destination,
      });
      reportPaywall("cta_click", {
        feature,
        surface: from,
        viewerTier,
        context: { ...contextRef.current, join_prompt_cta: destination },
      });
    },
    [trackEvent, feature, viewerTier, from],
  );

  const startTrial = useCallback(() => {
    takeCta("trial-modal");
    onStartTrial();
  }, [takeCta, onStartTrial]);

  const query = `?next=${encodeURIComponent(next)}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // The intro card's measurements, in a dialog. 360px rather than the
        // 420 the depth gate uses: this one has two sentences, not a list.
        className="max-w-[360px] p-0 overflow-hidden"
        data-testid="join-prompt-modal"
        data-feature={feature}
        data-prompt={prompt ?? feature}
      >
        <div className="px-6 pt-6 pb-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-[19px] font-semibold leading-tight tracking-tight text-rc-ink">
              {copy.title}
            </DialogTitle>
            <DialogDescription className="text-[14.5px] leading-relaxed text-rc-ink-soft">
              {copy.body}
            </DialogDescription>
          </DialogHeader>

          {spotName && (
            <p className="mt-2 text-[13px] leading-relaxed text-rc-ink-mute">
              {spotName}
            </p>
          )}

          {hasAccount ? (
            <button
              type="button"
              onClick={startTrial}
              data-testid="join-prompt-trial-primary"
              className="mt-5 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
            >
              Start {TRIAL_DAYS}-day free trial
            </button>
          ) : (
            <>
              <Link
                href={`/signup${query}`}
                onClick={() => takeCta("signup")}
                data-testid="join-prompt-signup"
                className="mt-5 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
              >
                Join now
              </Link>
              <Link
                href={`/login${query}`}
                onClick={() => takeCta("login")}
                data-testid="join-prompt-signin"
                className="mt-2 flex w-full items-center justify-center rounded-xl border border-rc-rule px-4 py-3 text-[15px] font-semibold text-rc-ink transition-colors hover:bg-rc-badge/10"
              >
                Sign in
              </Link>
              {/* The whole Pro pitch, one tap away and not a step sooner. */}
              <button
                type="button"
                onClick={startTrial}
                data-testid="join-prompt-trial"
                className="mt-3 w-full rounded-lg py-2 text-[13px] font-medium text-rc-ink-mute underline-offset-4 transition-colors hover:text-rc-ink-soft hover:underline"
              >
                Or start a {TRIAL_DAYS}-day free trial of Pro
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
