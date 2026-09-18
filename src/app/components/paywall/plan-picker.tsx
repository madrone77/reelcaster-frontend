'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTrialCta } from './trial-cta';
import { TRIAL_DAYS, annualSavingsPercent, dollars } from '@/lib/pricing';

/**
 * Two cards under the sheet's title: Yearly, then Monthly.
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
 */
export default function PlanPicker({ className }: { className?: string }) {
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
              'relative flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rc-brand focus-visible:ring-offset-2',
              selected
                ? 'border-rc-brand bg-rc-brand-soft/40 ring-1 ring-rc-brand'
                : 'border-rc-rule bg-rc-panel hover:border-rc-ink-mute',
            )}
          >
            {card.badge && (
              <span className="absolute -top-2.5 right-3 rounded-full bg-rc-brand px-2 py-0.5 font-rc-mono text-[10px] font-semibold tracking-[0.06em] text-white uppercase">
                {card.badge}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-full border',
                selected ? 'border-rc-brand bg-rc-brand' : 'border-rc-rule bg-rc-panel',
              )}
            >
              {selected && <Check className="size-3 text-white" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] leading-5 font-semibold text-rc-ink">
                {card.title}
              </span>
              <span className="block text-[12px] leading-4 text-rc-ink-soft">
                {card.detail}
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="text-[15px] leading-5 font-semibold text-rc-ink">
                {card.price}
              </span>
              <span className="text-[12px] text-rc-ink-soft"> {card.per}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
