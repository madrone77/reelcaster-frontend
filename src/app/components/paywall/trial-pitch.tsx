'use client';

import { Check } from 'lucide-react';
import { DialogTitle } from '@/components/ui/dialog';
import { useTrialCta } from './trial-cta';
import { sheetFeatures, type PlanTierId } from '@/lib/plan-features';
import { PLAN_LABELS } from '@/lib/plan-labels';
import { REMINDER_LEAD_DAYS, TRIAL_DAYS } from '@/lib/pricing';
import {
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from '@/lib/forecast-horizon';

/**
 * The argument the trial modal makes, in the pieces both of its shapes use.
 *
 * These were written for the phone sheet and lived inside it. The centred
 * dialog now makes the same argument in its left column, so they moved here
 * rather than being copied: two shapes of one modal that each carry their own
 * version of "what Pro adds" is two things to keep in step, and the one that
 * gets edited is whichever the next session happens to open.
 *
 * What stays with each shape is only the frame — the sheet's grab handle and
 * pinned controls, the dialog's two columns and its plan matrix. The headline
 * is shared too, as of the change that brought `TrialHeadline` here: the
 * dialog used to compose its own from the wall the reader hit ("Set an alert
 * for Oak Bay Flats") and now says what the sheet says, so the two shapes read
 * identically and the place is named on both.
 */

/** The day the reminder email goes out. Both numbers come from the sender. */
const REMINDER_DAY = TRIAL_DAYS - REMINDER_LEAD_DAYS;

/** What the reader has today, in the two numbers the headline argues about. */
function viewerPlan(tier: PlanTierId) {
  return tier === 'anon'
    ? { label: PLAN_LABELS.anon, days: ANON_FORECAST_DAYS }
    : { label: PLAN_LABELS.free, days: FREE_FORECAST_DAYS };
}

/** The eyebrow over the headline, on both shapes. */
export function TrialEyebrow({ className }: { className?: string }) {
  return (
    <p
      className={`font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase ${className ?? ''}`}
    >
      {TRIAL_DAYS}-day free trial
    </p>
  );
}

/**
 * What the reader has against what they'd get, in one line and two numbers.
 *
 * The forecast horizon rather than a feature, because it is the wall most
 * readers arrive from and the only difference that can be stated as a
 * comparison this short.
 */
export function PlanCompareLine({
  viewerTier,
  className,
  ...rest
}: {
  viewerTier: PlanTierId;
  className?: string;
  /**
   * Anything else lands on the paragraph. The dialog wraps this in a
   * `DialogDescription asChild`, which needs to hand it an id: this sentence
   * is what the modal is about, so it is the accessible description, and
   * Radix warns when a dialog has none.
   */
} & React.HTMLAttributes<HTMLParagraphElement>) {
  const plan = viewerPlan(viewerTier);
  return (
    <p
      {...rest}
      className={`text-sm leading-5 text-rc-ink-soft ${className ?? ''}`}
    >
      {plan.label} shows {plan.days}. Pro shows {PRO_FORECAST_DAYS} everywhere.
    </p>
  );
}

/**
 * The headline, on both shapes: what Pro shows you, where you are standing.
 *
 * One sentence for every wall. The dialog used to name the wall instead —
 * "Set an alert for Oak Bay Flats", "Unlock all fresh catch reports" — which
 * answered the reader's own action but could only name the place on the six
 * of thirteen walls whose phrasing took one, so the commonest walls on
 * /explore said the city on a phone and nothing on a desktop. Naming the place
 * everywhere is worth more than naming the wall: the reader knows what they
 * just clicked, and what they want to know is what they get.
 *
 * The place is set in brand blue because it is the one word here the reader
 * chose. A surface that cannot honestly name one drops the phrase rather than
 * inventing a subject.
 */
export function TrialHeadline({
  placeName,
  placeKind = 'spot',
  className,
}: {
  placeName?: string;
  /**
   * Which kind of place that is, because English cares: you fish AT a spot and
   * IN a city. Only the preposition depends on it.
   */
  placeKind?: 'spot' | 'city';
  className?: string;
}) {
  return (
    <DialogTitle
      className={`font-black tracking-[-0.02em] text-balance text-rc-ink ${className ?? ''}`}
    >
      See the next {PRO_FORECAST_DAYS} days
      {placeName ? (
        <>
          {placeKind === 'city' ? ' in ' : ' at '}
          <span className="text-rc-brand">{placeName}</span>
        </>
      ) : null}
    </DialogTitle>
  );
}

/** Three rows of what paying adds, led by the one that blocked the reader. */
export function TrialFeatureList({
  cityName,
  className,
}: {
  /** Names the reports row after the city it covers, where there is one. */
  cityName?: string;
  className?: string;
}) {
  const features = sheetFeatures(cityName);
  return (
    <ul className={`space-y-2.5 ${className ?? ''}`}>
      {features.map((f) => (
        <li key={f.id} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft"
          >
            <Check className="size-3 text-rc-brand" strokeWidth={3} />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] leading-5 font-semibold text-rc-ink">
              {f.title}
            </span>
            <span className="block text-[13px] leading-[18px] text-rc-ink-mute">
              {f.detail}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * What happens, and when, on three rows.
 *
 * The reason this earns its space: the objection to a card-required trial is
 * never the price, it is not knowing when the price arrives. A reader who can
 * see the reminder lands before the charge does not have to trust us about it.
 *
 * Must be rendered inside a `TrialCtaProvider` — it reads the same resolution
 * of trial eligibility the buy button uses, so the date in the last row is the
 * date the button would actually produce.
 */
export function TrialTimeline({
  priceAmount,
  className,
}: {
  /** Formatted price for this reader, already currency-resolved. */
  priceAmount: string;
  className?: string;
}) {
  const { chargeDate, trialOn } = useTrialCta();
  const rows = [
    {
      key: 'today',
      when: 'Today',
      amount: '$0.00',
      note: `Pro unlocks now. Nothing is charged for ${TRIAL_DAYS} days.`,
      tone: 'now' as const,
    },
    {
      key: 'reminder',
      when: `Day ${REMINDER_DAY}`,
      amount: 'Email reminder',
      // The row's whole job is to answer "what if I forget", so it says so.
      // It was the one row with no note under it, which read as the one row
      // with nothing to add.
      note: "So you don't forget",
      tone: 'pending' as const,
    },
    {
      key: 'charge',
      when: `Day ${TRIAL_DAYS}`,
      amount: `${priceAmount}/yr`,
      // "Day 7" is a countdown, not a date, and the date is the half a reader
      // needs to put it in a calendar.
      //
      // One sentence, not two. It used to open by stating the charge —
      // "Charged Sep 9. Cancel any time before then…" — which puts the bill
      // first and the way out second, in a row whose amount column is already
      // showing the price. Naming the date inside the cancel clause says the
      // same two things in the order a reader hesitating over a card wants
      // them.
      note:
        trialOn && chargeDate
          ? `Cancel any time before ${chargeDate} and you pay nothing.`
          : 'Cancel any time before this and you pay nothing.',
      tone: 'charge' as const,
    },
  ];

  return (
    <div
      className={`rounded-xl border border-rc-rule-soft bg-rc-surface p-4 ${className ?? ''}`}
    >
      <ol className="relative">
        <span
          aria-hidden
          className="absolute top-2 bottom-3 left-[7px] w-px bg-rc-rule"
        />
        {rows.map((row, i) => (
          <li
            key={row.key}
            className={`relative flex gap-3 pl-6 ${i === 0 ? '' : 'pt-3.5'}`}
          >
            <span
              aria-hidden
              className={`absolute left-0 size-[15px] rounded-full border-2 ${
                i === 0 ? 'top-[2px]' : 'top-[16px]'
              } ${
                row.tone === 'now'
                  ? 'border-rc-brand bg-rc-brand'
                  : row.tone === 'charge'
                    ? 'border-rc-ink bg-rc-panel'
                    : 'border-rc-rule bg-rc-panel'
              }`}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-rc-mono text-[10px] font-semibold tracking-[0.14em] text-rc-ink-mute uppercase">
                  {row.when}
                </span>
                <span
                  className={`text-sm leading-5 font-semibold ${
                    row.tone === 'now' ? 'text-rc-good-ink' : 'text-rc-ink'
                  }`}
                >
                  {row.amount}
                </span>
              </div>
              {row.note && (
                <p className="mt-0.5 text-xs leading-4 text-rc-ink-mute">
                  {row.note}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
