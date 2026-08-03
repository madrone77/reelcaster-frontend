"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { Check, Minus } from "lucide-react";
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
import {
  TrialBuy,
  TrialCadence,
  TrialCtaProvider,
  TrialTerms,
} from "./trial-cta";
import { TRIAL_DAYS } from "@/lib/pricing";
import {
  FREE_FAVORITE_SPOTS,
  NAG_FEATURES,
  PLAN_FEATURES,
  PLAN_TIERS,
  PRO_ROW_START,
  nagHeadline,
  nagSubhead,
  type NagFeatureId,
  type PlanCell,
  type PlanTierId,
} from "@/lib/plan-features";

/**
 * The upgrade nag for /explore. Two jobs, in this order:
 *
 *   1. Answer the thing the angler just tried to do — "Start your 7-day Pro
 *      trial to create an alert". The headline names the action, so the modal
 *      never reads as a generic interruption.
 *   2. Show the whole plan matrix underneath, so the decision is made here
 *      instead of on a round trip to /plans.
 *
 * The viewer's current tier column is marked, and the row that blocked them is
 * highlighted, so "what I have" and "what I'd get" are both one glance.
 *
 * Copy + limits come from `@/lib/plan-features` — never hardcode them here.
 */
export default function ProTrialModal({
  open,
  onOpenChange,
  feature,
  /** Overrides the auto-detected tier. Only for surfaces that already know. */
  viewerTier: viewerTierProp,
  /** Where the CTA lands. Defaults to /plans carrying the feature context. */
  ctaHref,
  /** Analytics + deep-link context for where the nag fired. */
  from = "explore",
  /** Names the spot in the headline ("Set an alert for Oak Bay Flats"). */
  spotName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: NagFeatureId;
  viewerTier?: PlanTierId;
  ctaHref?: string;
  from?: string;
  spotName?: string;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();

  const pathname = usePathname();
  const returnTo = pathname || "/explore";
  const nag = NAG_FEATURES[feature];
  const viewerTier: PlanTierId =
    viewerTierProp ?? (isPaid ? "pro" : user ? "free" : "anon");

  // A signed-out visitor blocked by something a FREE account unlocks is sold
  // the account, not a subscription. Everyone else — signed in or not — gets
  // the cadence choice and the payment handoff.
  const sellsAccount = nag.unlocksAt === "free" && viewerTier === "anon";
  const signupHref = sellsAccount
    ? `/signup?next=${encodeURIComponent("/explore")}`
    : undefined;
  const ctaLabel = sellsAccount
    ? "Create free account"
    : `Start ${TRIAL_DAYS}-day free trial`;

  useEffect(() => {
    if (!open) return;
    trackEvent("Upgrade Prompt Shown", {
      feature,
      viewerTier,
      from,
      timestamp: new Date().toISOString(),
    });
  }, [open, feature, viewerTier, from, trackEvent]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Column layout, not a single scrolling box: the headline and the buy
          button stay put while the plan table scrolls under them, so the CTA
          is never pushed off a short screen. */}
      <DialogContent
        data-testid="pro-trial-modal"
        data-feature={feature}
        className="bg-rc-panel border-rc-rule text-rc-ink p-0 gap-0 sm:max-w-lg max-h-[88dvh] flex flex-col overflow-hidden"
      >
        {/* One provider around all three pieces: the cadence sits by the plan
            table, the button up top, the terms at the foot — and they still
            share the selected plan. */}
        <TrialCtaProvider
          from={from}
          theme="light"
          onActivate={(plan) =>
            trackEvent("Paywall CTA Clicked", {
              feature,
              viewerTier,
              from,
              plan: plan ?? "signup",
              destination: plan ? "checkout" : signupHref,
            })
          }
        >
          {/* pr-10 clears the dialog's own close button — which is also why
              there's no "Not now": two dismissals for one modal. */}
          <DialogHeader className="shrink-0 px-4 pr-10 pt-6 pb-5 sm:px-6 sm:pr-12 text-left">
            <p className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-rc-brand">
              ReelCaster Pro
            </p>
            <DialogTitle className="mt-2 text-xl sm:text-2xl font-black tracking-[-0.02em] text-rc-ink text-balance">
              {nagHeadline(nag, viewerTier, spotName)}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
              {nagSubhead(nag, viewerTier)}
            </DialogDescription>
          </DialogHeader>

          {/* Buy, then cadence — the toggle sits against the plan table it
              re-prices, rather than above the button it feeds. */}
          <div className="shrink-0 px-4 sm:px-6 pb-4">
            {ctaHref ? (
              <Link
                href={ctaHref}
                data-testid="pro-trial-cta"
                onClick={() =>
                  trackEvent("Paywall CTA Clicked", {
                    feature,
                    viewerTier,
                    from,
                    href: ctaHref,
                  })
                }
                className="block text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
              >
                {ctaLabel}
              </Link>
            ) : (
              <TrialBuy signupHref={signupHref} signupLabel={ctaLabel} />
            )}
            {!ctaHref && !sellsAccount && <TrialCadence className="mt-3" />}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <PlanMatrix viewerTier={viewerTier} highlightRowId={nag.rowId} />
          </div>

          {/* Terms sit down here rather than under the button: short, and the
              last thing read before the free-tier alternative. */}
          <div className="shrink-0 border-t border-rc-rule px-4 sm:px-6 py-4">
            {!ctaHref && !sellsAccount && <TrialTerms className="text-center" />}

            {/* The free tier, offered last and on purpose: after the matrix
                has shown what an account gets you without paying. Only for
                visitors who don't have one. */}
            {viewerTier === "anon" && (
              <div className="mt-3 text-center">
                <Link
                  href={`/signup?next=${encodeURIComponent(returnTo)}`}
                  data-testid="free-signup-cta"
                  onClick={() =>
                    trackEvent("Paywall CTA Clicked", {
                      feature,
                      viewerTier,
                      from,
                      plan: "free",
                      destination: "signup",
                    })
                  }
                  className="text-sm font-semibold text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
                >
                  Sign up today as a free user
                </Link>
                <p className="mt-1.5 text-[11px] leading-relaxed text-rc-ink-mute">
                  No card. Keeps today&apos;s score, a week of forecast, and{" "}
                  {FREE_FAVORITE_SPOTS === 1
                    ? "one saved spot"
                    : `${FREE_FAVORITE_SPOTS} saved spots`}
                  .
                </p>
              </div>
            )}
          </div>
        </TrialCtaProvider>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------------- */

// Narrow value columns on a phone so the feature label keeps most of the row;
// they widen once there's room for the longer strings ("Unlimited").
const COL =
  "grid grid-cols-[minmax(0,1fr)_repeat(3,58px)] sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(64px,84px))]";

function PlanMatrix({
  viewerTier,
  highlightRowId,
}: {
  viewerTier: PlanTierId;
  highlightRowId: string;
}) {
  return (
    <div className="border-t border-rc-rule">
      {/* Column heads — sticky so the tier you're reading stays labelled while
          the groups scroll past inside the dialog. */}
      <div
        className={`${COL} sticky top-0 z-10 bg-rc-panel border-b border-rc-rule px-4 sm:px-6 py-2.5`}
      >
        <div className="rc-label text-rc-ink-mute self-end">
          What you get
        </div>
        {PLAN_TIERS.map((t) => {
          const current = t.id === viewerTier;
          return (
            <div key={t.id} className="text-center">
              <div
                className={`font-rc-mono text-[10px] font-bold tracking-[0.08em] uppercase ${
                  t.id === "pro"
                    ? "text-rc-brand"
                    : current
                      ? "text-rc-ink"
                      : "text-rc-ink-mute"
                }`}
              >
                {t.label}
              </div>
              <div className="mt-0.5 text-[10px] leading-none text-rc-ink-mute">
                {current ? "You" : t.price}
              </div>
            </div>
          );
        })}
      </div>

      {PLAN_FEATURES.map((row, i) => {
        const hit = row.id === highlightRowId;
        return (
          <div
            key={row.id}
            data-row={row.id}
            data-highlighted={hit || undefined}
            className={`${COL} items-center px-4 sm:px-6 py-2 border-t ${
              // The seam between "free and serious" and "what paying adds" —
              // the one place the table makes an argument rather than a list.
              i === PRO_ROW_START ? "border-rc-rule" : "border-rc-rule/60"
            } ${hit ? "bg-rc-brand-soft" : ""}`}
          >
            <div
              className={`pr-3 text-[13px] leading-snug ${
                hit ? "font-semibold text-rc-ink" : "text-rc-ink-soft"
              }`}
            >
              {row.label}
            </div>
            {PLAN_TIERS.map((t) => (
              <Cell key={t.id} value={row[t.id]} emphasis={t.id === "pro"} />
            ))}
          </div>
        );
      })}

      <p className="px-4 sm:px-6 py-4 text-[11px] leading-relaxed text-rc-ink-mute border-t border-rc-rule">
        Pro is sold in British Columbia, Washington, and Oregon. Billed in CAD
        in Canada, USD in the US.
      </p>
    </div>
  );
}

function Cell({ value, emphasis }: { value: PlanCell; emphasis: boolean }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <Check
          className={`w-4 h-4 ${emphasis ? "text-rc-brand" : "text-rc-good"}`}
          aria-label="Included"
        />
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <Minus className="w-3.5 h-3.5 text-rc-ink-mute/50" aria-label="Not included" />
      </div>
    );
  }
  return (
    <div
      className={`text-center font-rc-mono text-[11px] leading-tight px-0.5 ${
        emphasis ? "font-bold text-rc-brand" : "text-rc-ink-soft"
      }`}
    >
      {value}
    </div>
  );
}
