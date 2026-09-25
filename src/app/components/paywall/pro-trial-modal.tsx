"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { useAnalytics } from "@/hooks/use-analytics";
import { captureWall } from "@/lib/attribution";
import { reportPaywall } from "@/lib/paywall-counter";
import { reportModalOpen } from "@/lib/modal-timing";
import { noteWallShown } from "@/lib/upgrade-nag";
import {
  MONTHLY_ON,
  TrialBuy,
  TrialCtaProvider,
  TrialExpress,
  useTrialCta,
} from "./trial-cta";
import {
  PlanCompareLine,
  TrialEyebrow,
  TrialFeatureList,
  TrialHeadline,
  TrialTimeline,
} from "./trial-pitch";
import BrandHeader from "./brand-header";
import PlanMatrix from "./plan-matrix";
import PlanPicker from "./plan-picker";
import TrialSheetStripe from "./trial-sheet-stripe";
import { useIsPhone } from "@/hooks/use-is-phone";
import { coverMap } from "@/lib/map/map-cover";
import { TRIAL_DAYS } from "@/lib/pricing";
import { usePricing } from "@/app/components/split-test/use-pricing";
import { useSplitExposure } from "@/app/components/split-test/report";
import {
  NAG_FEATURES,
  type NagFeatureId,
  type PlanTierId,
} from "@/lib/plan-features";

/**
 * The upgrade nag for /explore. Two shapes, one modal.
 *
 * On a phone it is a bottom sheet drawn the way Stripe Checkout draws the
 * page after it, and it drops the plan matrix (see ./trial-sheet-stripe for
 * why). Everywhere else it is the centred dialog below. Both are opened by the same triggers, carry the same `from`,
 * and report through the same counters here — the shape changes, the
 * accounting does not.
 *
 * Two jobs, and at `lg` they get a column each rather than a queue:
 *
 *   1. Make the offer — what Pro shows you, where you are standing, what it
 *      costs and when — with the checkout directly under it. The headline is
 *      the sheet's, so both shapes read identically; it names the place rather
 *      than the wall, and ./trial-pitch has the reasoning.
 *   2. Show the whole plan matrix beside that, so the decision is made here
 *      instead of on a round trip to /plans.
 *
 * The viewer's current tier column is marked, and the row that blocked them is
 * highlighted, so "what I have" and "what I'd get" are both one glance. The
 * table is Free vs Pro for every viewer, signed out included — a signed-out
 * visitor is being asked whether to pay, and a third "Browsing" column made
 * that a three-way comparison. The free tier is no longer offered by name
 * here at all: this modal sells the trial, /plans and /signup still sell the
 * account, and a link out of a paywall to the free option was one more exit
 * on the surface with the most bought traffic in the product.
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
  /**
   * The place the phone sheet names when there is no single spot: the city
   * under the map camera. `spotName` wins where both exist, because a spot is
   * a more specific answer to "what was I looking at" than its city.
   */
  placeName,
  /** The city the spot sits in, for the sheet's reports line. */
  cityName,
  /** The wall's own sentence, when the fortnight line is not what it is
   *  selling ("Unlock scoring at all Seattle spots"). Both shapes show it. */
  headline,
  /**
   * Wall-specific detail for the event log: which locked day was tapped, which
   * limit was hit. Small scalars only — the server whitelists the shape.
   */
  context,
  /**
   * Billing region ('WA', 'BC', ...) when the page knows whose water it is
   * selling. It prices the sheet and the Stripe session in that currency, so a
   * Seattle page quotes USD to a reader on a Canadian IP. Unset, the price
   * follows the reader's location, as every wall that can open anywhere does.
   */
  region,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: NagFeatureId;
  viewerTier?: PlanTierId;
  ctaHref?: string;
  from?: string;
  spotName?: string;
  placeName?: string;
  cityName?: string;
  headline?: string;
  context?: Record<string, string | number | boolean>;
  region?: string;
}) {
  const { user } = useAuth();
  const { isPaid } = useSubscription();
  const { trackEvent } = useAnalytics();

  const nag = NAG_FEATURES[feature];
  const viewerTier: PlanTierId =
    viewerTierProp ?? (isPaid ? "pro" : user ? "free" : "anon");

  // Every wall sells the trial, including the ones a free account would also
  // open. The free tier isn't hidden — it's the link at the foot of the
  // modal, after the matrix has shown what the tiers actually differ on.
  const ctaLabel = `Start ${TRIAL_DAYS}-day free trial`;

  // The price this reader is quoted, and the exposure that quoting it counts
  // as. The modal is the highest-intent surface a price arm is shown on, so
  // its denominator is the one the report leans on hardest.
  const pricing = usePricing(region);
  useSplitExposure(pricing, "modal");

  // Which shape. trial_sheet_stripe_v1 (2026-09-06 to 2026-09-07) made the
  // Stripe-styled sheet the phone sheet; sheet_timeline_v1 (2026-09-22) put
  // it against a timeline sheet and ended in one sheet carrying both, which
  // is ./trial-sheet-stripe as it stands.
  const phone = useIsPhone();
  // sheet_pitch_v1 (2026-09-22 to 2026-09-23) put it against the desktop
  // dialog's left column drawn for the phone, and the sheet as it stands won
  // (3 trials to 0), so it is the phone sheet on every wall, iOS and Android.

  /**
   * The server-side counter behind /admin/reelcaster/paywalls and the
   * conversion panels on /admin/reelcaster/analytics. Mixpanel already has
   * these as events; this is the copy the admin dashboard can actually query,
   * and it is a day-grain count rather than a log.
   *
   * The request itself lives in lib/paywall-counter.ts, shared with the walls
   * that do not open this modal, so all of them report the same way.
   */
  /**
   * Held in a ref, and NOT in the dependency lists below.
   *
   * Callers pass this as an object literal, so it is a new identity on every
   * render of the page behind the modal. In a dependency array that would give
   * `bumpCounter` a new identity too, and the impression effect depends on
   * `bumpCounter` — so a wall left open while anything upstream re-rendered
   * would report an impression per render. A ref is read at call time and
   * changes nothing about when the effect runs.
   */
  const contextRef = useRef(context);
  contextRef.current = context;

  const bumpCounter = useCallback(
    (kind: "impression" | "cta_click", extra?: Record<string, string | number | boolean>) => {
      reportPaywall(kind, {
        feature,
        surface: from,
        viewerTier,
        context: extra ? { ...contextRef.current, ...extra } : contextRef.current,
      });
    },
    [feature, from, viewerTier],
  );

  /**
   * When this modal opened, and whether the reader did anything with it.
   *
   * Both exist for the dismissal report below. A wall that is seen and closed
   * is the most common thing that happens to a wall and was, until now, the
   * one outcome nothing recorded: the counter had an impression column and a
   * click column, and "saw it, said no" was inferred by subtracting one from
   * the other. That subtraction cannot tell a reflex close from a considered
   * no, and the difference between the two is the difference between a wall
   * that interrupts and a wall that fails to convince.
   *
   * Refs rather than state on purpose. Neither value is rendered, and a
   * setState on open would re-render the whole plan matrix to store a number
   * only a beacon will ever read.
   */
  const openedAt = useRef<number | null>(null);
  const acted = useRef(false);

  /**
   * Close without a click is a dismissal. Close AFTER a click is not: the CTA
   * navigates to /signup, to /plans or out to Stripe, and Radix fires the
   * close on the way out. Counting that as a refusal would put a dismissal on
   * every conversion this modal ever produced.
   */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && !acted.current) {
        reportPaywall("dismiss", {
          feature,
          surface: from,
          viewerTier,
          context: contextRef.current,
          dwellMs: openedAt.current ? Date.now() - openedAt.current : undefined,
        });
      }
      onOpenChange(next);
    },
    [feature, from, viewerTier, onOpenChange],
  );

  /**
   * Every CTA on this modal reports the same way, with one mark. A tap whose
   * next screen is the card — the annual button, the email form's submit, a
   * wallet — is the Begin checkout tap, and the counter route answers it with
   * a Meta event id (CHECKOUT_TAP_META_EVENT in src/lib/paywall-conversion.ts).
   * The sign-up link arrives here as method "signup" with the same
   * destination and is not one; neither is the plans link, which has none.
   */
  const trackCta = useCallback(
    (extra: Record<string, unknown>) => {
      trackEvent("Paywall CTA Clicked", {
        feature,
        viewerTier,
        from,
        ...extra,
      });
      acted.current = true;
      const checkoutTap = extra.destination === "checkout" && extra.method !== "signup";
      bumpCounter("cta_click", checkoutTap ? { checkout_tap: true } : undefined);
    },
    [trackEvent, feature, viewerTier, from, bumpCounter],
  );

  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    // Tap to painted sheet, for the admin's Modal open tile. See @/lib/modal-timing.
    reportModalOpen();
    acted.current = false;
    trackEvent("Upgrade Prompt Shown", {
      feature,
      viewerTier,
      from,
      timestamp: new Date().toISOString(),
    });
    bumpCounter("impression");
    // The plan matrix is now on screen, however it got there, so the
    // engagement count on /explore starts over rather than letting the depth
    // gate open on top of it a few clicks later. It restarts at what a lock is
    // worth, not at zero, because walking into a wall is the strongest buy
    // signal the page has. Harmless everywhere else: off /explore nothing
    // reads the count. See lib/upgrade-nag.ts.
    noteWallShown();
    // The cookie that carries this wall across the navigation to /signup or
    // out to Stripe, so whatever the visitor converts into knows which wall
    // sent them. Last touch wins, and it expires in 30 minutes.
    captureWall(feature, from);
  }, [open, feature, viewerTier, from, trackEvent, bumpCounter]);

  // The phone sheet fills the screen, so a map under it (Explore) has nothing
  // to draw for. Pausing it frees the main thread for the sheet: a map still
  // loading tiles underneath froze the email field for seconds on an iPhone.
  useEffect(() => {
    if (!open || !phone) return;
    return coverMap();
  }, [open, phone]);

  // Which shape. `useIsPhone` answers on the first client render, so the
  // shape this mounts in is the shape it keeps. It used to measure in an
  // effect and answer false first, which mounted and opened the centred
  // dialog, then swapped it for the sheet a frame later, and on WebKit the
  // sheet's outside-tap listener could catch the tail of the opening tap and
  // dismiss the sheet on the spot. See the hook for the full story.
  if (phone) {
    return (
      // handleOpenChange, not onOpenChange. Both shapes of this modal have to
      // close through the same handler or the sheet reports no dismissals at
      // all — impressions and CTA clicks are shared (the effect above and
      // `trackCta`), so the shape would have looked instrumented while the one
      // outcome most readers give it went unrecorded, on the surface that sees
      // the most bought traffic in the product.
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          variant="sheet"
          data-testid="pro-trial-modal"
          data-shape="sheet"
          data-feature={feature}
          // A fixed height, a sliver short of the top of the screen, so the
          // sheet reads as a page rather than a tray hanging a third of the
          // way down. It was 94dvh; with the plan cards and the quote both
          // drawn that scrolled on a 390x844 phone, and the last 6% is what
          // lets it sit still.
          className="bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 [&>[data-slot=dialog-close]]:z-20 h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)]"
        >
          <TrialSheetStripe
            placeName={spotName ?? placeName}
            // A spot when there is one, otherwise the city the map is on.
            placeKind={spotName ? 'spot' : 'city'}
            cityName={cityName}
            headline={headline}
            from={from}
            region={region}
            ctaHref={ctaHref}
            ctaLabel={ctaLabel}
            priceAmount={pricing.amount}
            onCtaClick={trackCta}
            // The plan is the method when the buy button was pressed with a
            // card chosen; a wallet tap is the annual plan (the sheet's
            // wallet never offers monthly).
            onActivate={(method) =>
              trackCta({
                plan: method === "monthly" ? "monthly" : "annual",
                method,
                destination: "checkout",
              })
            }
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Two columns from `lg` up: the offer on the left, the table on the
          right, each scrolling in its own lane.

          It was one 512px column for both, which is the phone's shape drawn on
          a 1440px screen. The matrix is fourteen rows, so the panel came to
          1303px of content in a 792px box: the buy button scrolled away, the
          table was cut off mid-row against the bottom edge with nothing to say
          it continued, and the second buy button that existed to answer that
          was itself below the fold. None of it was visible at once on the
          surface with the most room in the product.

          Split in two, the argument and the checkout are one screenful that
          never scrolls, and the table gets a column tall enough to read. It
          also retires the duplicate CTA: that button was there because the
          matrix pushed the first one out of sight, and beside the table
          instead of under it, the first one is always on screen. */}
      <DialogContent
        data-testid="pro-trial-modal"
        data-shape="dialog"
        data-feature={feature}
        /* Open with nothing focused.

           Radix focuses the first tabbable thing inside the content when the
           dialog opens, and on this modal that is the email field. On a phone
           the software keyboard then comes up with the modal, covering the
           headline, the price and the button before the reader has read any of
           it: the offer is sold from the top, so the top is what has to be on
           screen. The keyboard belongs to the moment the angler taps the field.

           Focus moves to the panel itself instead of being left on the trigger
           behind the scrim, so the tab order starts inside the dialog and Esc
           still closes it. */
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
        /* Below `lg` this is the old single column and the panel is the one
           scroller. At `lg` it becomes a fixed-height two-pane box and the
           columns scroll instead — hence `overflow-hidden` there, or the panel
           would scroll a thing whose halves already do.

           The height is the taller column's content, capped only by the
           screen. It was capped at 44rem, which made the left column scroll
           by a few lines once the plan picker arrived; then fixed at 51rem,
           which left a band of empty panel under the table. Sized to content,
           the shorter column ends where the longer one does and nothing
           scrolls. Only a screen shorter than the content falls back to the
           lanes scrolling. */
        className="bg-rc-panel border-rc-rule text-rc-ink p-0 gap-0 sm:max-w-lg lg:max-w-4xl max-h-[88dvh] lg:max-h-[calc(100dvh-2rem)] flex flex-col overflow-y-auto overscroll-contain lg:overflow-hidden [&>[data-slot=dialog-close]]:z-20 lg:[&>[data-slot=dialog-close]]:right-[calc(50%+1rem)]"
      >
        <DialogBody
          from={from}
          ctaHref={ctaHref}
          ctaLabel={ctaLabel}
          viewerTier={viewerTier}
          spotName={spotName}
          placeName={placeName}
          cityName={cityName}
          headline={headline}
          region={region}
          priceAmount={pricing.amount}
          highlightRowId={nag.rowId}
          trackCta={trackCta}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * The centred dialog's contents, inside the provider that prices them.
 *
 * Its own component, and not inline in the modal, so the plan-picker hook
 * runs only while the dialog is open: Radix mounts `DialogContent` on open,
 * and an exposure counted from the modal's own render would fire for every
 * wall that mounted closed. Same reason the sheet reads its arm inside
 * ./trial-sheet-stripe.
 */
function DialogBody({
  from,
  ctaHref,
  ctaLabel,
  viewerTier,
  spotName,
  placeName,
  cityName,
  headline,
  region,
  priceAmount,
  highlightRowId,
  trackCta,
}: {
  from: string;
  ctaHref?: string;
  ctaLabel: string;
  viewerTier: PlanTierId;
  spotName?: string;
  placeName?: string;
  cityName?: string;
  headline?: string;
  region?: string;
  priceAmount: string;
  highlightRowId?: string;
  trackCta: (extra: Record<string, unknown>) => void;
}) {
  // The two cards, whenever the monthly price is for sale. A wall that hands
  // in its own href sells nothing here, so there is nothing to pick.
  const picker = MONTHLY_ON && !ctaHref;
  return (
    <>
        {/* One provider around every piece: the wallet, the buy form, the
            timeline and the terms — sharing one resolution of trial
            eligibility rather than each asking again. The timeline prints the
            charge date this same resolution produces. */}
        <TrialCtaProvider
          from={from}
          region={region}
          theme="light"
          // The plan is the method when the buy button was pressed with a
          // card chosen; a wallet tap is the annual plan (the wallet row is
          // hidden while Monthly is chosen, see below).
          onActivate={(method) => {
            trackCta({
              plan: method === "monthly" ? "monthly" : "annual",
              method,
              destination: "checkout",
            });
          }}
        >
          {/* Equal halves, so the left column's right edge is the panel's 50%
              line — which is where the close button is moved to at `lg` (see
              the className above). Left where the primitive puts it, the X
              floats over the table's Pro column: over the price in the sticky
              head, and over a tick in whichever row is under it as the table
              scrolls. It belongs with the headline it dismisses anyway, and
              the header below already reserves `pr-12` for it. */}
          <div className="flex flex-col lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:overflow-hidden">
            {/* Left column: the argument, then the checkout under it.

                The same pieces the phone sheet leads with — see
                ./trial-pitch. What differs is the headline, which names the
                wall the reader walked into rather than the forecast horizon:
                the sheet has one screen and spends it on the commonest wall,
                and this has a column and can answer the actual one. */}
            {/* `min-h-0` and `flex-1` are `lg`-only on purpose. Below that the
                panel is the scroller and these are flex items in a column that
                overflows it, so a `min-h-0` here lets this one shrink past its
                content to nothing: the offer collapsed to zero height and drew
                itself on top of the table. Above `lg` the panel has stopped
                scrolling and they are what lets the two lanes size to it. */}
            <div className="flex flex-col lg:min-h-0 lg:overflow-hidden">
              {/* Scrolls only at `lg`, where the panel has stopped. Below that
                  the panel is the scroller and a second one here would trap a
                  strip of moving content between two frozen bands. */}
              <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain px-4 sm:px-6 pt-6 pb-4">
                {/* pr-10 clears the dialog's own close button — which is also
                    why there's no "Not now": two dismissals for one modal. */}
                <DialogHeader className="pr-10 sm:pr-12 text-left gap-0">
                  {/* The same brand row the phone sheet wears, naming the
                      same city — see ./brand-header. This shape had no mark
                      on it at all, so the one screen in the product that asks
                      for money was also the one that never said whose water
                      it was about. The two shapes are the same offer, and a
                      header that appeared on one of them only would be the
                      most visible place for them to drift. */}
                  <div className="mb-5">
                    <BrandHeader
                      city={cityName ?? (spotName ? undefined : placeName)}
                    />
                  </div>
                  <TrialEyebrow />
                  {/* The sheet's headline, not a second one. See
                      ./trial-pitch for why this stopped naming the wall.

                      A SPOT only. The city is in the brand row three lines
                      above and in the reports feature row below, and a
                      column that says Tacoma three times spends its best
                      line saying nothing new. A spot is not the same
                      answer: it is the mark the reader reached for, and no
                      other line here names it. */}
                  <TrialHeadline
                    placeName={spotName}
                    text={headline}
                    className="mt-2 text-xl sm:text-2xl"
                  />
                </DialogHeader>

                {/* asChild: this sentence is what the modal is about, so it
                    is the accessible description. It used to be the price
                    paragraph under the button, which is now gone. */}
                <DialogDescription asChild>
                  <PlanCompareLine viewerTier={viewerTier} className="mt-1.5" />
                </DialogDescription>

                {/* Same resolution the sheet makes: an explicit city wins,
                    otherwise the place is a city only when no spot was named. */}
                <TrialFeatureList
                  cityName={cityName ?? (spotName ? undefined : placeName)}
                  className="mt-4"
                />

                {/* Yearly beside Monthly, under the argument and over the
                    timeline, so the reader has chosen a card before the
                    timeline says when it charges. Plain cards here: the
                    dialog was asked the question on its own
                    (desktop_plan_picker_v1, concluded 2026-09-22 for the
                    cards) and the phone sheet draws day tiles instead. */}
                {picker && <PlanPicker className="mt-4" />}

                {/* What happens and when, on the shape that has the table
                    beside it to say what you get. The matrix answers "what am
                    I buying"; this answers "when does it charge me", which is
                    the question a card-required trial actually stalls on. */}
                <TrialTimeline priceAmount={priceAmount} className="mt-4" />
              </div>

              {/* The controls, at the foot of their own column so they stay on
                  screen however long the table beside them runs. Wallet first:
                  the buyer who has one never types anything.

                  Apple Pay was pulled from this modal in #467 because the
                  wallet row, its divider and the email form stacked into three
                  asks above the table. That objection was about a stack, and
                  there is no longer one — same reasoning that put the wallet
                  back on the phone sheet in #495. */}
              <div className="shrink-0 border-t border-rc-rule-soft px-4 sm:px-6 pt-4 pb-5">
                {ctaHref ? (
                  <Link
                    href={ctaHref}
                    data-testid="pro-trial-cta"
                    onClick={() => trackCta({ href: ctaHref, position: "top" })}
                    className="block text-center px-4 py-2.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2"
                  >
                    {ctaLabel}
                  </Link>
                ) : (
                  <>
                    {/* The wallet sells the annual plan only, so it steps
                        aside while the Monthly card is chosen rather than
                        charge a year the reader did not pick. */}
                    <WalletUnlessMonthly />
                    <TrialBuy signupLabel={ctaLabel} hideLabel />
                  </>
                )}
              </div>
            </div>

            {/* Right column: the table, in its own lane and its own scroller.
                Its sticky column heads stick to whichever of the two is
                scrolling it — the panel below `lg`, this div at `lg`. The
                top rule goes at `lg`, where there is nothing above it to be
                ruled off from. */}
            <div className="lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:border-l lg:border-rc-rule">
              {/* `sharedRows` off: this column is selling, and seven rows of
                  things the reader already has are not an argument for paying.
                  The customer quote takes their place. /billing/cancel keeps
                  them — see plan-matrix. */}
              <PlanMatrix
                viewerTier={viewerTier}
                highlightRowId={highlightRowId}
                withProof
                sharedRows={false}
                className="lg:border-t-0"
              />

              {/* Terms and Privacy, with the coverage and currency note the
                  table already ends on rather than under the buy button.

                  They sat with the button because a disclosure belongs with
                  the control it binds — but the disclosure itself has gone:
                  the amount and the charge date are in the timeline, which is
                  where a reader actually meets them, and repeating them under
                  the button said the same two facts a third time on one
                  screen. What is left is two links, and links are small print,
                  and the small print on this modal is here. Both columns are
                  on screen together at `lg`, so nothing has moved out of
                  sight at the moment of the ask.

                  Grey and unruled, in the paragraph's own ink: brand blue and
                  an underline made the two smallest things on the panel look
                  like the two things to tap, on a screen whose one action is
                  the buy button. Small print should read as small print. */}
              <p className="px-4 sm:px-6 pb-4 -mt-2 text-[11px] leading-relaxed text-rc-ink-mute">
                {/* See ./charge-terms for why these are not prefetched. */}
                <Link href="/terms" prefetch={false} className="hover:text-rc-ink">
                  Terms
                </Link>
                {" · "}
                <Link href="/privacy" prefetch={false} className="hover:text-rc-ink">
                  Privacy
                </Link>
              </p>
            </div>
          </div>
        </TrialCtaProvider>
    </>
  );
}

/** The wallet row, unless the picker has moved the plan to Monthly. */
function WalletUnlessMonthly() {
  const { plan } = useTrialCta();
  if (plan === "monthly") return null;
  return <TrialExpress className="mb-3" />;
}
