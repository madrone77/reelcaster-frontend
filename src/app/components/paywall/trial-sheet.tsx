'use client';

import Link from 'next/link';
import { DialogTitle } from '@/components/ui/dialog';
import { TrialBuy, TrialCtaProvider, TrialExpress } from './trial-cta';
import {
  PlanCompareLine,
  TrialEyebrow,
  TrialFeatureList,
  TrialTimeline,
} from './trial-pitch';
import { type PlanTierId } from '@/lib/plan-features';
import { PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';

/**
 * The phone shape of the trial offer: a bottom sheet, wallet first.
 *
 * Same modal, same triggers, same analytics as the centred dialog in
 * `pro-trial-modal` — this is a different arrangement of the same offer for a
 * screen you hold in one hand, not a second paywall. `ProTrialModal` picks
 * between the two and owns everything either of them reports. The eyebrow, the
 * comparison line, the feature rows and the timeline are the same components
 * the dialog's left column uses; see ./trial-pitch.
 *
 * Three deliberate departures from the desktop dialog:
 *
 * **No plan matrix.** Fourteen rows is a comparison, and a comparison wants a
 * page. What a phone has room to answer is "what happens if I tap this", so
 * the argument here is three lines of what paying adds and a timeline of what
 * it costs and when. `/plans` is still one tap away and still carries the
 * table, and the dialog keeps the matrix in a column of its own.
 *
 * **The wallet is back, and it leads.** #467 took Apple Pay off the centred
 * dialog because the wallet row, its divider and the email form stacked into
 * three asks above the table. That objection does not survive the table
 * coming out: with the checkout pinned to the bottom edge there is one block
 * of controls, at the bottom of the screen, where a thumb already is.
 * `TrialExpress` renders nothing when no wallet exists, and its own divider
 * goes with it, so a device without Apple Pay sees a single card button.
 *
 * **The charge date is a row, not a footnote.** A card-required trial that
 * auto-charges has to say the date and the amount before the tap. The
 * timeline is where a reader will actually meet it.
 */
export default function TrialSheet({
  viewerTier,
  placeName,
  placeKind = 'spot',
  cityName,
  from,
  region,
  ctaHref,
  ctaLabel,
  priceAmount,
  onCtaClick,
  onActivate,
}: {
  viewerTier: PlanTierId;
  /**
   * The blue word in the headline: what the reader was looking at.
   *
   * A spot on a spot page, the city under the camera on the map. Both are
   * places the reader chose, which is the whole reason the headline names
   * one. Absent on a surface that cannot honestly name either, and the
   * headline then drops the phrase rather than inventing a subject.
   */
  placeName?: string;
  /**
   * Which kind of place that is, because English cares: you fish AT a spot
   * and IN a city. Only the preposition depends on it.
   */
  placeKind?: 'spot' | 'city';
  /**
   * The city the reports row names, which is not always the headline's
   * subject: on a spot page the headline names the spot and this names the
   * city it sits in. Falls back to the subject when that already is a city.
   */
  cityName?: string;
  from: string;
  region?: string;
  /** Set when the surface sends the reader somewhere instead of selling here. */
  ctaHref?: string;
  ctaLabel: string;
  /** Formatted price for this reader, already currency-resolved. */
  priceAmount: string;
  onCtaClick: (extra: Record<string, unknown>) => void;
  onActivate: (method: 'annual' | 'wallet' | 'signup') => void;
}) {
  return (
    <TrialCtaProvider
      from={from}
      region={region}
      theme="light"
      onActivate={onActivate}
    >
      {/* Grab handle. Decorative: the sheet closes by the X, the scrim or
          Escape, all three of which the dialog primitive already owns. */}
      <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-rc-rule" />
      </div>

      {/* Everything above the controls scrolls; the controls do not. On the
          shortest phones that is the difference between the buy button being
          on screen and being a scroll away. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
        <TrialEyebrow className="pr-10" />

        {/* The spot is the subject, and it is set in brand blue because it is
            the one word on the sheet the reader chose. A surface with no spot
            in hand (the viewport strip on /explore, a marketing page) drops
            the phrase rather than inventing a subject. */}
        <DialogTitle className="mt-2 pr-10 text-[22px] leading-[28px] font-black tracking-[-0.02em] text-balance text-rc-ink">
          See the next {PRO_FORECAST_DAYS} days
          {placeName ? (
            <>
              {placeKind === 'city' ? ' in ' : ' at '}
              <span className="text-rc-brand">{placeName}</span>
            </>
          ) : null}
        </DialogTitle>

        <PlanCompareLine viewerTier={viewerTier} className="mt-1.5" />

        <TrialFeatureList
          cityName={cityName ?? (placeKind === 'city' ? placeName : undefined)}
          className="mt-4"
        />

        <TrialTimeline priceAmount={priceAmount} className="mt-4" />
      </div>

      {/* The controls, pinned to the bottom edge. Wallet first: the buyer who
          has one never types anything. */}
      <div className="shrink-0 border-t border-rc-rule-soft px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {ctaHref ? (
          <Link
            href={ctaHref}
            data-testid="pro-trial-cta"
            onClick={() => onCtaClick({ href: ctaHref, position: 'sheet' })}
            className="block rounded-lg bg-rc-brand px-4 py-3 text-center text-[15px] font-bold text-white transition-colors hover:bg-rc-brand-hover"
          >
            {ctaLabel}
          </Link>
        ) : (
          <>
            <TrialExpress region={region} className="mb-3" />
            <TrialBuy signupLabel={ctaLabel} hideLabel />
          </>
        )}
      </div>
    </TrialCtaProvider>
  );
}
