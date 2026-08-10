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
import { TrialBuy, TrialCtaProvider, TrialExpress } from "./trial-cta";
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

  // Every wall sells the trial, including the ones a free account would also
  // open. The free tier isn't hidden — it's the link at the foot of the
  // modal, after the matrix has shown what the tiers actually differ on.
  const ctaLabel = `Start ${TRIAL_DAYS}-day free trial`;

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
      {/* ONE scrolling box. This used to pin the headline and the buy button
          and scroll only the plan table between them — which on a phone left a
          narrow strip of moving content trapped between two frozen bands, and
          read as a broken page rather than a deliberate layout.

          So the shell stays put and everything inside it scrolls together. The
          close button is the one exception: it's absolutely positioned on the
          shell, OUTSIDE the scroller, so it can't be scrolled away from — which
          matters more here than it did before, now that the buy button can be. */}
      <DialogContent
        data-testid="pro-trial-modal"
        data-feature={feature}
        className="bg-rc-panel border-rc-rule text-rc-ink p-0 gap-0 sm:max-w-lg max-h-[88dvh] flex flex-col overflow-hidden [&>[data-slot=dialog-close]]:z-20"
      >
        {/* overscroll-contain so a flick past the end of the modal on a phone
            doesn't start scrolling the page underneath it. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {/* One provider around all three pieces: the wallet buttons and the
            buy form up top, the terms at the foot — sharing one resolution of
            trial eligibility rather than each asking again. */}
        <TrialCtaProvider
          from={from}
          theme="light"
          onActivate={(method) =>
            trackEvent("Paywall CTA Clicked", {
              feature,
              viewerTier,
              from,
              plan: "annual",
              method,
              destination: method === "wallet" ? "wallet" : "checkout",
            })
          }
        >
          {/* pr-10 clears the dialog's own close button — which is also why
              there's no "Not now": two dismissals for one modal. */}
          <DialogHeader className="px-4 pr-10 pt-6 pb-5 sm:px-6 sm:pr-12 text-left">
            <p className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] uppercase text-rc-brand">
              ReelCaster Pro
            </p>
            <DialogTitle className="mt-2 text-xl sm:text-2xl font-black tracking-[-0.02em] text-rc-ink text-balance">
              {nagHeadline(nag, viewerTier, spotName)}
            </DialogTitle>
          </DialogHeader>

          {/* Wallets first, then the card path. A buyer with Apple Pay set up
              is one tap from done and should never have to scroll past a form
              to find that out; a buyer without one sees the form exactly where
              it was, because <TrialExpress> renders nothing — not even its
              divider — when no wallet is available. */}
          <div className="px-4 sm:px-6 pb-4">
            {!ctaHref && <TrialExpress className="mb-4" />}
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
              <TrialBuy signupLabel={ctaLabel} />
            )}
          </div>

          <PlanMatrix viewerTier={viewerTier} highlightRowId={nag.rowId} />

          {/* The second ask. Someone who read the whole table has just been
              convinced by it, and making them scroll back up to act on that is
              how you lose them. Both copies share one email field's worth of
              state through the provider, so a half-typed address at the top is
              already there at the bottom. */}
          <div className="border-t border-rc-rule px-4 sm:px-6 py-4">
            {!ctaHref && (
              <TrialBuy signupLabel={ctaLabel} testId="trial-cta-bottom" />
            )}

            {/* The disclosure, directly under the button it belongs to — which
                is the arrangement the rest of this code insists on (see
                trial-cta.tsx). The Terms and Privacy links live here because
                this is now the only place on the modal that carries them. */}
            <DialogDescription className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
              {nagSubhead()}{" "}
              <Link
                href="/terms"
                className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                Terms
              </Link>
              {" · "}
              <Link
                href="/privacy"
                className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
              >
                Privacy
              </Link>
            </DialogDescription>

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
        </div>
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
          the rows scroll past. Now that the whole modal is one scroller these
          stick to the top of the dialog rather than to a table-sized window,
          which is the only thing that stays fixed while you read the rows. The
          z sits below the close button's (see DialogContent) so it slides
          under the X instead of over it. */}
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

      {/* Names only what a customer can actually use today. Oregon used to be
          listed here and in COVERED_PROVINCES despite having no cities in
          BlueCaster at all, so this sold water we don't forecast; it has been
          swept out of the covered set and every other surface that named it.
          "More coming soon" covers the next region without naming a date.

          The currency sentence stays: the price above says "$33" and nothing
          else on this modal says which dollar that is. */}
      <p className="px-4 sm:px-6 py-4 text-[11px] leading-relaxed text-rc-ink-mute border-t border-rc-rule">
        Pro available in British Columbia and Washington. More coming soon.
        Billed in CAD in Canada, USD in the US.
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
