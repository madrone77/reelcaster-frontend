'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrialCta } from './trial-cta';
import { TRIAL_DAYS, annualSavingsPercent, dollars } from '@/lib/pricing';

/**
 * How the cards are drawn. `tile` on the phone sheet, `card` in the desktop
 * dialog: the two shapes were asked the question separately and answered it
 * differently (plan_picker_v3 and desktop_plan_picker_v1, both concluded
 * 2026-09-22).
 */
export type PlanPickerLook = 'card' | 'tile';

/**
 * Two cards on either shape of the trial modal: Yearly, then Monthly. Under
 * the phone sheet's title, and under the desktop dialog's feature list.
 *
 * Yearly is preselected and carries the free week and the Save badge. The
 * badge is the arithmetic between the two prices (annualSavingsPercent), so
 * the number on screen is always the number the two cards imply. Monthly is
 * the plain card: billed today, no trial, no badge. It is there so the year
 * has a price to stand beside; the top-grossing paywalls in every category
 * checked on 2026-09-18 (Fishbrain, Flighty, Gaia, onX, Golfshot, NordVPN)
 * frame their annual this way and none of them show a year alone.
 *
 * A radio group, so a screen reader hears "Yearly, 1 of 2, selected". The
 * selected card takes the brand border and a filled tick; the other stays on
 * the rule colour with an empty ring. Prices are set to the cent in the
 * per-period column and the monthly-equivalent in soft ink, the way
 * Fishbrain's cards do it, because "$3.25 / mo" beside "$5 / mo" is the
 * comparison the badge is summarising.
 *
 * `look="tile"` draws them the way the forecast strip draws a day
 * (explore/components/day-cell): the chosen card takes the selected day's
 * solid brand fill with white type, the other stays a white panel on the rule
 * colour, and the Save badge becomes the gold tab the best day wears on its
 * top edge. A reader who has just tapped a day already reads that fill as
 * "this one" and that gold tab as "the good one", so the yearly card borrows
 * both. It was arm c of plan_picker_v3 and is the phone sheet's only look
 * since Casey concluded that test for it on 2026-09-22; the desktop dialog
 * keeps the plain cards.
 */
export default function PlanPicker({
  className,
  look = 'card',
}: {
  className?: string;
  look?: PlanPickerLook;
}) {
  const tile = look === 'tile';
  const s = useTrialCta();
  const save = annualSavingsPercent(s.annualCents, s.monthlyCents);
  const perMonth = dollars(Math.round(s.annualCents / 12));

  const cards: Array<{
    plan: 'annual' | 'monthly';
    title: string;
    detail: string;
    price: string;
    per: string;
    badge?: string;
  }> = [
    {
      plan: 'annual',
      title: 'Yearly',
      detail: s.annualTrial
        ? `${TRIAL_DAYS} days free, then ${dollars(s.annualCents)}/yr`
        : `${dollars(s.annualCents)}/yr, billed today`,
      price: perMonth,
      per: '/ mo',
      badge: save > 0 ? `Save ${save}%` : undefined,
    },
    {
      plan: 'monthly',
      title: 'Monthly',
      detail: 'Billed today, cancel anytime',
      price: dollars(s.monthlyCents),
      per: '/ mo',
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Choose a plan"
      className={cn('flex flex-col gap-2', className)}
    >
      {cards.map((card) => {
        const selected = s.plan === card.plan;
        return (
          <button
            key={card.plan}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`plan-card-${card.plan}`}
            onClick={() => s.setPlan(card.plan)}
            className={cn(
              'relative flex w-full items-center gap-3 border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2',
              tile ? 'rounded' : 'rounded-lg',
              selected
                ? tile
                  ? 'border-rc-brand bg-rc-brand text-white'
                  : 'border-rc-brand bg-rc-brand-soft/40 ring-1 ring-rc-brand'
                : tile
                  ? 'border-rc-rule bg-rc-panel hover:border-rc-brand hover:bg-rc-brand-soft/40'
                  : 'border-rc-rule bg-rc-panel hover:border-rc-ink-mute',
            )}
          >
            {card.badge && (
              <span
                className={cn(
                  'absolute right-3 font-rc-mono text-[10px] tracking-[0.06em] uppercase',
                  tile
                    ? '-top-2 rounded bg-rc-badge px-1.5 py-1 leading-none font-bold text-rc-ink'
                    : '-top-2.5 rounded-full bg-rc-brand px-2 py-0.5 font-semibold text-white',
                )}
              >
                {card.badge}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border',
                selected
                  ? tile
                    ? 'border-white bg-white'
                    : 'border-rc-brand bg-rc-brand'
                  : 'border-rc-rule bg-rc-panel',
              )}
            >
              {selected && (
                <Check
                  className={cn('size-3', tile ? 'text-rc-brand' : 'text-white')}
                  strokeWidth={3}
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={cn(
                  'block text-[15px] leading-5 font-semibold',
                  tile && selected ? 'text-white' : 'text-rc-ink',
                )}
              >
                {card.title}
              </span>
              <span
                className={cn(
                  'block text-[12px] leading-4',
                  tile && selected ? 'text-white/85' : 'text-rc-ink-soft',
                )}
              >
                {card.detail}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span
                className={cn(
                  'text-[15px] leading-5 font-semibold',
                  tile && selected ? 'text-white' : 'text-rc-ink',
                )}
              >
                {card.price}
              </span>
              <span
                className={cn(
                  'text-[12px]',
                  tile && selected ? 'text-white/85' : 'text-rc-ink-soft',
                )}
              >
                {' '}
                {card.per}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
