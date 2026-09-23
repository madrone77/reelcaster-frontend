'use client';

import Link from 'next/link';
import { DialogDescription } from '@/components/ui/dialog';
import { MONTHLY_ON, TrialBuy, TrialCtaProvider } from './trial-cta';
import BrandHeader from './brand-header';
import PlanPicker from './plan-picker';
import {
  PlanCompareLine,
  TrialEyebrow,
  TrialFeatureList,
  TrialHeadline,
  TrialTimeline,
} from './trial-pitch';
import type { PlanTierId } from '@/lib/plan-features';

/**
 * The centred dialog's left column, drawn as the phone sheet.
 *
 * Casey, 2026-09-22, on the desktop modal: the eyebrow, the fortnight
 * headline, the three ticked rows with a sentence under each, the three-step
 * timeline, then the email field and the button. That column is the whole
 * offer and it makes it in one screen; the plan matrix beside it is the part
 * that needs a desktop's width, and it is dropped here rather than stacked
 * under the argument the way the old single-column dialog used to stack it.
 *
 * Nothing new is written for this shape. Every piece comes from ./trial-pitch,
 * which is where the two shapes of this modal already share their argument, so
 * a copy edit lands on the phone and the desktop at once and neither can drift
 * into being the one that got updated. What this file owns is the frame: the
 * grab handle, the one scrolling lane, and the controls pinned to the foot of
 * the screen.
 *
 * What it does NOT carry, and why:
 *
 * - **The plan matrix, and the Terms/Privacy pair that lives under it.** The
 *   table goes; the links do not, because a card-required trial has to state
 *   its terms in front of the tap. They sit under the button instead, in the
 *   fine print's own grey — the same treatment they get in ./charge-terms.
 * - **The charge line.** The timeline's last row is the disclosure here: it
 *   names the date and the amount, three lines above the thumb. A sentence
 *   under the button saying it again would be the third place on one screen.
 * The cards are here (Casey, same evening: "it still needs a monthly or yearly
 * selector… put that below the 3 feature checklist"), but no plan-picker ARM
 * is: they are drawn whenever the monthly price is for sale, the way the
 * timeline sheet draws them, so a reader on this sheet adds nothing to
 * plan_picker_v3's counters. Choosing Monthly retitles the eyebrow and
 * collapses the timeline to today's charge — both shared pieces already
 * follow the plan.
 *
 * What it does NOT carry, and why:
 * - **The wallet row.** Both live phone sheets dropped it: on a phone Apple
 *   Pay draws a full-width black button above the field, which is a second ask
 *   stacked over the one this screen is built around. The desktop column keeps
 *   it because there it is usually nothing at all.
 */

/** Stripe Checkout's field and button, at the sizes the live sheets use. */
const INPUT = 'h-11 rounded-md px-3 text-[16px]';
const BUTTON =
  'inline-flex h-12 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[17px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

export default function TrialSheetPitch({
  placeName,
  placeKind,
  cityName,
  headline,
  from,
  region,
  viewerTier,
  ctaLabel,
  priceAmount,
  onActivate,
}: {
  placeName?: string;
  placeKind?: 'spot' | 'city';
  cityName?: string;
  /** The wall's own line, when it has one (the locked-pin walls). */
  headline?: string;
  from: string;
  region?: string;
  /** Which plan the reader is on today, for the compare line. */
  viewerTier: PlanTierId;
  ctaLabel: string;
  priceAmount: string;
  onActivate: (method: 'annual' | 'monthly' | 'wallet' | 'signup') => void;
}) {
  // An explicit city wins; otherwise the place is a city only when the caller
  // named no spot. The same resolution ./pro-trial-modal makes for its left
  // column, so the brand row and the reports row never disagree.
  const city = cityName ?? (placeKind === 'city' ? placeName : undefined);
  // The headline names a SPOT only, as it does on the desktop: the city is
  // already in the brand row above it and in the reports row below it, and a
  // screen that says Tacoma three times spends its biggest line saying
  // nothing new.
  const spot = placeKind === 'city' ? undefined : placeName;
  return (
    <TrialCtaProvider from={from} region={region} theme="light" onActivate={onActivate}>
      <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
        <div className="h-1 w-10 rounded-full bg-rc-rule" />
      </div>

      {/* One lane, and the only scroller. pr-9 on the head clears the
          dialog's own close button, the way the desktop column does.

          12px gutters rather than the desktop's 16: this column has a phone's
          width instead of half a 1024px panel, and the same inset around less
          room is a wider margin around a narrower argument. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pt-2 pb-3">
        <div className="pr-9">
          <BrandHeader city={city} />
        </div>

        <div className="mt-5 pr-9">
          <TrialEyebrow />
          <TrialHeadline
            placeName={spot}
            text={headline}
            className="mt-1.5 text-[26px] leading-[30px]"
          />
        </div>

        {/* This sentence is what the sheet is about, so it is the accessible
            description — the same role it plays on the desktop. */}
        <DialogDescription asChild>
          <PlanCompareLine viewerTier={viewerTier} className="mt-1.5" />
        </DialogDescription>

        {/* `gap-2` on the rows: the tick and the line it belongs to, closer
            together than the desktop sets them. The desktop's own spacing is
            untouched — this is the one place that asks for less. */}
        <TrialFeatureList cityName={city} className="mt-5 [&_li]:gap-2" />

        {/* Yearly beside Monthly, under the rows and over the timeline, so the
            reader has chosen a card before the timeline says when it charges.
            The desktop column puts them in the same place. */}
        {MONTHLY_ON && <PlanPicker className="mt-5" />}

        {/* What happens and when. On the desktop this scrolls with the
            argument and the controls sit below it; a phone has one lane, so it
            is the last thing read before the thumb reaches the field.

            `mt-auto` takes whatever height the phone has spare and puts it in
            ONE gap, above this, so the timeline sits against the controls it
            discloses. With the cards drawn there is barely any spare on a tall
            phone; the gap opens when Monthly collapses the timeline to a
            single row, and it opens above the card rather than under it.
            Content taller than the lane zeroes the auto margin and the lane
            scrolls. `px-3` and the tighter dot column bring the card in line
            with the gutters around it. */}
        <TrialTimeline
          priceAmount={priceAmount}
          className="mt-auto pt-5 px-3 [&_li]:pl-5"
        />
      </div>

      <div className="shrink-0 border-t border-rc-rule-soft bg-rc-panel px-3 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
        <TrialBuy
          signupLabel={ctaLabel}
          hideLabel
          placeholder="Enter your email"
          buttonClassName={BUTTON}
          inputClassName={INPUT}
        />
        {/* The small print the dropped column was carrying. Grey and
            unruled: on a screen with one action, a blue underlined pair under
            the button reads as two more things to tap. */}
        <p className="mt-2.5 text-center text-[11px] leading-relaxed text-rc-ink-mute">
          <Link href="/terms" className="hover:text-rc-ink">
            Terms
          </Link>
          {' · '}
          <Link href="/privacy" className="hover:text-rc-ink">
            Privacy
          </Link>
        </p>
      </div>
    </TrialCtaProvider>
  );
}
