"use client";

import Link from "next/link";
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
 * WHEN IT OPENS is not this component's business — it rides the same engagement
 * count every other proactive ask on this page uses (@/lib/upgrade-nag), so the
 * two can never both fire in one visit.
 *
 * THE DISMISS IS PLAIN. "Not right now" and nothing else: no confirm-shaming,
 * no second thought, no smaller print explaining what they are giving up. The
 * map itself says that, once, on the way down, and then keeps a way back
 * visible for as long as they stay.
 */
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
  // Come back to the map, not to a dashboard. Registering is meant to feel like
  // the depth switching back on, which it cannot do from another page.
  const signupHref = `/signup?next=${encodeURIComponent(pathname || "/m/explore")}`;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDismiss(); }}>
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
              Create a free account and keep the depth map. No card needed.
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
            data-testid="depth-gate-signup"
            className="mt-5 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
          >
            Create a free account
          </Link>

          <button
            type="button"
            onClick={onDismiss}
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
