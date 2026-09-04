"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Waves, CalendarDays, BellRing } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FREE_FORECAST_DAYS } from "@/lib/forecast-horizon";
import { reportPaywall } from "@/lib/paywall-counter";
import { trackEvent } from "@/lib/analytics";

/**
 * "Enjoying ReelCaster?" — the one ask on /m/explore.
 *
 * THE ASK IS A FREE ACCOUNT, not the Pro trial, and that is the whole point of
 * having a second modal rather than reusing <ProTrialModal>. Registering is
 * what brings depth back, so it is the honest thing to ask for; it is also by
 * far the lower-friction request sixty seconds after an ad click, because the
 * trial runs through checkout and this does not ask for a card at all. Pro is
 * still sold, later, on the locked days 8–14 and on alerts, exactly where the
 * tier matrix already sells it.
 *
 * THE PROMISES ARE THE FREE TIER'S, precisely. Depth, a week of forecast rather
 * than two days, one email alert. It must not promise the fortnight: a free
 * account does not get it, and a gate that oversells is worse than one that
 * asks twice.
 *
 * WHEN IT OPENS is not this component's business — it rides the engagement
 * count in @/lib/upgrade-nag. It used to share that count with an unprompted
 * Pro ask, and the sharing was what stopped the two firing in one visit; that
 * ask has since been removed for converting at zero, so this is now the only
 * thing the count opens.
 *
 * THE DISMISS IS PLAIN. "Not right now" and nothing else: no confirm-shaming,
 * no second thought, no smaller print explaining what they are giving up. The
 * map itself says that, once, on the way down, and then keeps a way back
 * visible for as long as they stay.
 *
 * IT REPORTS ITSELF, like every other wall in the app. It did not, for its
 * whole life, and the reason is worth writing down: the paywall reporter
 * validates against NAG_FEATURES and this ask is not a Pro wall, so it had no
 * feature id to report under and was counted nowhere — on the one surface that
 * sees the most bought traffic in the product. `depth-gate` is now a member of
 * that enum (unlocksAt "free", no matrix row, since what it sells is an
 * account) and the three outcomes are reported here: shown, taken, refused.
 */
/** Where this ask stands, as it should read on the admin's surface list. */
const SURFACE = "explore-depth-gate";

export default function DepthGatePrompt({
  open,
  onDismiss,
}: {
  open: boolean;
  /** Records the decline and strips depth. Also fires on Esc and scrim click:
   *  a dismissed dialog is a dismissal however it was dismissed, and treating
   *  Esc as "ask me again later" would let somebody keep the preview forever
   *  by pressing one key. */
  onDismiss: () => void;
}) {
  const pathname = usePathname();

  /**
   * The reporting triple. Tier is "anon" without asking: this dialog only
   * opens for a signed-out visitor (see `depthAsk` in explore-shell), and what
   * it offers is the account itself, so there is no other tier it could be
   * shown to.
   */
  const openedAt = useRef<number | null>(null);
  const acted = useRef(false);

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    acted.current = false;
    reportPaywall("impression", {
      feature: "depth-gate",
      surface: SURFACE,
      viewerTier: "anon",
    });
    trackEvent("Depth Gate Shown", { surface: SURFACE, feature: "depth-gate" });
  }, [open]);

  /**
   * Every way out of this dialog lands here, which is the point: "Not right
   * now", the close button, Esc and a scrim click are one decision and the
   * component already treats them as one. The report distinguishes only
   * between leaving through the offer and leaving past it.
   */
  const dismiss = useCallback(() => {
    if (!acted.current) {
      reportPaywall("dismiss", {
        feature: "depth-gate",
        surface: SURFACE,
        viewerTier: "anon",
        dwellMs: openedAt.current ? Date.now() - openedAt.current : undefined,
      });
      trackEvent("Depth Gate Dismissed", {
        surface: SURFACE,
        dwell_ms: openedAt.current ? Date.now() - openedAt.current : undefined,
      });
    }
    onDismiss();
  }, [onDismiss]);

  const takeOffer = useCallback(() => {
    acted.current = true;
    reportPaywall("cta_click", {
      feature: "depth-gate",
      surface: SURFACE,
      viewerTier: "anon",
    });
    trackEvent("Depth Gate Accepted", {
      surface: SURFACE,
      dwell_ms: openedAt.current ? Date.now() - openedAt.current : undefined,
    });
  }, []);
  // Come back to the map, not to a dashboard. Registering is meant to feel like
  // the depth switching back on, which it cannot do from another page.
  const signupHref = `/signup?next=${encodeURIComponent(pathname || "/m/explore")}`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) dismiss(); }}>
      <DialogContent
        className="max-w-[420px] p-0 overflow-hidden"
        data-testid="depth-gate-prompt"
      >
        <div className="px-6 pt-6 pb-5">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight text-rc-ink">
              Enjoying ReelCaster?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-rc-ink-mute">
              Become a Member and keep the depth map. No card needed.
            </DialogDescription>
          </DialogHeader>

          <ul className="mt-4 flex flex-col gap-2.5">
            <Promise icon={Waves}>Charted depth at every spot</Promise>
            <Promise icon={CalendarDays}>
              {FREE_FORECAST_DAYS} days of forecast, not two
            </Promise>
            <Promise icon={BellRing}>An email alert on your spot</Promise>
          </ul>

          <Link
            href={signupHref}
            onClick={takeOffer}
            data-testid="depth-gate-signup"
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
          >
            Become a Member
          </Link>

          <button
            type="button"
            onClick={dismiss}
            data-testid="depth-gate-dismiss"
            className="mt-1 w-full rounded-lg py-2.5 text-[13px] font-medium text-rc-ink-mute transition-colors hover:text-rc-ink-soft"
          >
            Not right now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Promise({
  icon: Icon,
  children,
}: {
  icon: typeof Waves;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5 text-[13.5px] text-rc-ink-soft">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft text-rc-brand">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </li>
  );
}
