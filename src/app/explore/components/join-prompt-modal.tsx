"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { useAnalytics } from "@/hooks/use-analytics";
import { captureWall } from "@/lib/attribution";
import { reportPaywall } from "@/lib/paywall-counter";
import { noteWallShown } from "@/lib/upgrade-nag";
import type { NagFeatureId, PlanTierId } from "@/lib/plan-features";
import { joinPromptFor, type JoinPromptKey } from "../lib/join-prompt-copy";

/**
 * The small wall on /explore: what you reached for, then Join now or Sign in.
 *
 * IT IS THE SAME WALL, IN A SMALLER ROOM. Every trigger that used to open
 * <ProTrialModal> on this surface — the ad frame's third spot open, a locked
 * day tile, the star at the saved-spot cap, add-a-spot, alerts, catch
 * reports — opens this instead on arm b of `explore_join_prompt_v1`. Nothing
 * about what is gated changes. What changes is the first thing a tap gets:
 * a fourteen-row plan matrix and a card form, or one line and two buttons.
 *
 * IT SAYS NOTHING ABOUT PLANS. No price, no trial, no "free account", no
 * Pro — Casey's call (2026-09-08). The title finishes the tap, the buttons
 * are Join now and Sign in, and that is the whole screen. Which plan, and
 * what it costs, is the next step's question and it has a screen built for
 * it: <PlanChoiceModal>, in the trial sheet's design system, raised by Join
 * now. Answering it here, over a map, in a box this size, is what made the
 * old wall read as a checkout the reader never opened.
 *
 * That also means nothing here can go stale. The body line this used to
 * carry had to name the forecast horizon and the saved-spot cap to stay
 * honest, and a sentence with a limit in it is a sentence that rots quietly.
 *
 * SHAPE AND SIZE ARE THE INTRO CARD'S: about 340px of card, a title, a
 * full-width button. Not the intro card's transparency, though. That card was
 * about the map behind it and deliberately had no scrim and no focus trap;
 * this one is a question that wants an answer, so it uses the shared <Dialog>
 * like every other wall and closes the same four ways.
 *
 * IT REPORTS EXACTLY AS THE BIG MODAL DOES — same `feature`, same `surface`,
 * the same impression/cta_click/dismiss triple through lib/paywall-counter,
 * the same `captureWall` cookie and the same `noteWallShown`. That is not
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
  onJoin,
  onSignupHref,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the counter records. Unchanged from the wall this replaces. */
  feature: NagFeatureId;
  /** What the title says. Defaults to `feature`; see JoinPromptKey. */
  prompt?: JoinPromptKey;
  /** The surface id the wall already reported under. */
  from: string;
  /** Named under the title where there is one. */
  spotName?: string;
  context?: Record<string, string | number | boolean>;
  /** Hands off to <PlanChoiceModal>. The parent does the swap. */
  onJoin: () => void;
  /** Reports the /signup href this wall would return to, for the next step. */
  onSignupHref?: (href: string) => void;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();

  const title = joinPromptFor(prompt ?? feature);
  const viewerTier: PlanTierId = isPaid ? "pro" : user ? "free" : "anon";

  /**
   * A signed-in angler has already done the joining, and the two walls that
   * fire for them almost exclusively — the alert limit, the saved-spot cap —
   * are answered on the next screen rather than this one. So they get one
   * neutral button through to it instead of an invitation to join twice.
   * Still not a word about a tier here: "See plans" is what it does.
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
    const here = `${window.location.pathname}${window.location.search}`;
    setNext(here);
    onSignupHref?.(`/signup?next=${encodeURIComponent(here)}`);
  }, [open, onSignupHref]);

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
   * A close with no click is a refusal. A close after one is not: Sign in
   * navigates and Join now swaps this modal for the plan chooser, and both
   * would otherwise be filed as somebody saying no.
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
   * One click counter for both buttons, marked by where it goes.
   *
   * `destination` is never "checkout" here, which matters: the counter route
   * answers a checkout tap with a Meta event id, and this modal is two
   * screens away from a card field.
   */
  const takeCta = useCallback(
    (destination: "plan-choice" | "login") => {
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

  const join = useCallback(() => {
    takeCta("plan-choice");
    onJoin();
  }, [takeCta, onJoin]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        // The intro card's measurements, in a dialog.
        className="max-w-[360px] p-0 overflow-hidden"
        data-testid="join-prompt-modal"
        data-feature={feature}
        data-prompt={prompt ?? feature}
      >
        <div className="px-6 pt-6 pb-5">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle className="text-[19px] font-semibold leading-tight tracking-tight text-rc-ink">
              {title}
            </DialogTitle>
            {spotName && (
              <p className="text-[13px] leading-relaxed text-rc-ink-mute">
                {spotName}
              </p>
            )}
          </DialogHeader>

          <button
            type="button"
            onClick={join}
            data-testid="join-prompt-join"
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
          >
            {hasAccount ? "See plans" : "Join now"}
          </button>

          {!hasAccount && (
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              onClick={() => takeCta("login")}
              data-testid="join-prompt-signin"
              className="mt-2 flex w-full items-center justify-center rounded-xl border border-rc-rule px-4 py-3 text-[15px] font-semibold text-rc-ink transition-colors hover:bg-rc-badge/10"
            >
              Sign in
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
