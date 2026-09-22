'use client';

import Image from 'next/image';
import { Check, XIcon } from 'lucide-react';
import { DialogClose, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { MONTHLY_ON, TrialBuy, TrialCtaProvider, useTrialCta } from './trial-cta';
import { useBrandCity } from './brand-header';
import ChargeTerms from './charge-terms';
import PlanPicker from './plan-picker';
import { REMINDER_LEAD_DAYS, TRIAL_DAYS, dollars } from '@/lib/pricing';
import { PRO_FORECAST_DAYS } from '@/lib/forecast-horizon';

/**
 * Arm b of sheet_timeline_v1 (see ../split-test/use-sheet-timeline): the phone
 * trial sheet redrawn around a three-step trial timeline. Casey's design,
 * 2026-09-22, drawn first as a mockup and cut down from there.
 *
 * - A blue Pro banner: the gold-plus mark and the PRO badge, the header
 *   lockup at its header size, with the drag handle and a white close.
 * - A headline naming the place ("See the whole Seattle forecast"), or the
 *   wall's own line when the wall hands one in.
 * - The plain plan cards with the Save badge as the gold tab, then five rows.
 *   These scroll.
 * - A footer pinned to the bottom of the screen: Today / reminder email /
 *   trial ends, the email field, the button. The button never scrolls away,
 *   and the timeline is the disclosure: it names the charge date and the
 *   amount above the tap. Monthly, or a year with no trial, has no timeline,
 *   and the charge line the control draws takes its place.
 */

const INPUT = 'h-11 rounded-md px-3 text-[16px]';
const BUTTON =
  'inline-flex h-12 w-full items-center justify-center rounded-md bg-rc-brand px-4 text-[17px] font-bold text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-colors hover:bg-rc-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2 disabled:opacity-60';

function rows(city: string | null): readonly string[] {
  return [
    city
      ? `All ${PRO_FORECAST_DAYS} days of the ${city} forecast`
      : `All ${PRO_FORECAST_DAYS} days of the forecast`,
    'A text when your spot turns hot',
    city ? `Daily ${city} catch reports` : 'Daily catch reports',
    'Private spots only you can see',
    'No ads, no locks',
  ];
}

/** "Sep 26", the way the charge date is written. */
function shortDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default function TrialSheetTimeline({
  placeName,
  placeKind,
  cityName,
  headline,
  from,
  region,
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
  ctaLabel: string;
  priceAmount: string;
  onActivate: (method: 'annual' | 'monthly' | 'wallet' | 'signup') => void;
}) {
  const city = useBrandCity(cityName ?? (placeKind === 'city' ? placeName : undefined));
  return (
    <TrialCtaProvider from={from} region={region} theme="light" onActivate={onActivate}>
      <div className="flex shrink-0 flex-col items-center gap-1.5 bg-rc-brand px-3 pt-1.5 pb-2.5">
        <div aria-hidden className="h-1 w-10 rounded-full bg-white/45" />
        <div className="flex w-full items-center justify-between">
          <span aria-hidden className="size-11" />
          <span className="flex items-center gap-2">
            <Image src="/reelcaster-mark-pro.svg" alt="ReelCaster Pro" width={104} height={48} priority />
            <span
              aria-hidden
              className="rounded-[3px] bg-rc-badge px-1.5 py-0.5 text-[11px] leading-none font-black tracking-[0.12em] text-rc-brand"
            >
              PRO
            </span>
          </span>
          <DialogClose className="flex size-11 items-center justify-center rounded-md text-white focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none">
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">
        <div className="flex flex-col gap-1 text-center">
          <DialogTitle className="text-[24px] leading-7 font-extrabold tracking-[-0.02em] text-balance text-rc-ink">
            {headline ?? (city ? `See the whole ${city} forecast` : 'See the whole forecast')}
          </DialogTitle>
          <Subline />
        </div>

        {MONTHLY_ON && <PlanPicker goldBadge />}

        <div>
          <p className="mt-1 font-rc-mono text-[10.5px] font-semibold tracking-[0.24em] text-rc-ink-mute uppercase">
            What you get with Pro
          </p>
          <ul className="mt-1.5 divide-y divide-rc-rule-soft">
            {rows(city).map((row) => (
              <li key={row} className="flex items-center justify-between gap-3 py-2">
                <span className="text-[15px] leading-5 font-medium text-rc-ink">{row}</span>
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft"
                >
                  <Check className="size-3 text-rc-brand" strokeWidth={3} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-rc-rule-soft bg-rc-panel px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(20,22,31,0.06)]">
        <Timeline priceAmount={priceAmount} />
        <TrialBuy
          signupLabel={ctaLabel}
          hideLabel
          placeholder="Enter your email"
          buttonClassName={BUTTON}
          inputClassName={INPUT}
        />
      </div>
    </TrialCtaProvider>
  );
}

/** Under the headline: what the chosen card does today. */
function Subline() {
  const s = useTrialCta();
  const text =
    s.plan === 'monthly'
      ? `Pro for ${dollars(s.monthlyCents)} a month, starting today.`
      : !s.trialOn && !s.busy
        ? `Pro for ${dollars(s.annualCents)} a year.`
        : `Try Pro free for ${TRIAL_DAYS} days.`;
  return <p className="text-[15px] leading-5 text-rc-ink-soft">{text}</p>;
}

/**
 * Today, the reminder, the first charge. Only while the year is on a trial;
 * otherwise the control's charge line, since there is no week to draw.
 */
function Timeline({ priceAmount }: { priceAmount: string }) {
  const s = useTrialCta();
  const trial = s.plan === 'annual' && (s.trialOn || s.busy);
  if (!trial) {
    return (
      <DialogDescription asChild>
        <ChargeTerms priceAmount={priceAmount} className="order-last text-center" />
      </DialogDescription>
    );
  }
  const steps = [
    { when: 'Today', what: 'Pro unlocked', detail: 'Full access, free' },
    {
      when: shortDate(s.trialDays - REMINDER_LEAD_DAYS),
      what: 'Reminder email',
      detail: 'Before any charge',
    },
    { when: s.chargeDate, what: 'Trial ends', detail: `${dollars(s.annualCents)} a year starts` },
  ];
  return (
    <DialogDescription asChild>
      <ol aria-label="How the trial works" className="mb-0.5 grid grid-cols-3 gap-x-1.5">
        {steps.map((step, i) => (
          <li key={step.what} className="flex min-w-0 flex-col gap-1">
            <span aria-hidden className="flex items-center gap-1.5">
              <span className={`size-[7px] shrink-0 rounded-full ${i === 0 ? 'bg-rc-brand' : 'bg-rc-rule'}`} />
              {i < steps.length - 1 && <span className="h-0.5 flex-1 bg-rc-rule-soft" />}
            </span>
            <span className="flex flex-col gap-px text-[12px] leading-[15px]">
              <strong className="font-extrabold text-rc-ink">{step.when}</strong>
              <span className="font-semibold text-rc-ink">{step.what}</span>
              <span className="text-rc-ink-soft">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </DialogDescription>
  );
}
