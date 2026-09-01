'use client';

/**
 * The three-step new-user tour.
 *
 * Shown once to every new account, Pro or free. It teaches rather than
 * collects: what the score is made of, that it runs a week ahead hour by hour,
 * and the three things that make it yours. Nothing here is a form, so there is
 * no half-finished state to preserve and no step that can fail.
 *
 * Each step carries a small drawn example rather than a screenshot. The score
 * pills, the week strip, and the feature rows are built from the same tokens
 * the real surfaces use, so they stay honest when the palette moves and cost
 * nothing to load.
 *
 * Mounting, ordering against the Pro wizard, and the "already seen" check all
 * live in `welcome-gate.tsx`. By the time this renders the decision is made.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BellRing,
  Check,
  Fish,
  Gauge,
  Loader2,
  Star,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAnalytics } from '@/hooks/use-analytics';

const STEP_COUNT = 3;

const TITLES = [
  'Every spot gets a score',
  'Plan the week, not just the morning',
  'Make it yours',
];

const SUBTITLES = [
  'One number for how the fishing should be, and the reasons behind it.',
  'The forecast runs days ahead, hour by hour, so you can pick the window.',
  'Three things that turn the map into your map.',
];

/** What actually feeds a score, in the order an angler would rank it. */
const FACTORS = [
  'Tide and current',
  'Wind and swell',
  'Light at dawn and dusk',
  'Water temperature',
  'Season and where the fish are',
  'Catch reports off that water',
];

const SCORE_EXAMPLES = [
  { value: 86, label: 'Go' },
  { value: 61, label: 'Fair' },
  { value: 34, label: 'Sit it out' },
];

type Tier = 'good' | 'fair' | 'poor';

/**
 * The same cut points `tierFor` uses (75 / 55). Kept local rather than
 * imported because every value on this screen is a drawn constant, not a real
 * score, so the modal must never hold a null tier.
 */
function tierOf(value: number): Tier {
  if (value >= 75) return 'good';
  if (value >= 55) return 'fair';
  return 'poor';
}

/** A drawn week, not real data. The shape is the lesson: the peak has a day. */
const WEEK = [
  { day: 'Mon', value: 41 },
  { day: 'Tue', value: 58 },
  { day: 'Wed', value: 74 },
  { day: 'Thu', value: 88 },
  { day: 'Fri', value: 66 },
  { day: 'Sat', value: 49 },
  { day: 'Sun', value: 37 },
];

const PEAK = Math.max(...WEEK.map((d) => d.value));

const MAKE_IT_YOURS = [
  {
    icon: Star,
    title: 'Save the spots you fish',
    body: 'Saved spots ride along on your dashboard, scored for the day before you open anything.',
  },
  {
    icon: BellRing,
    title: 'Set an alert',
    body: 'Tell us a spot and a score, and we watch the forecast for you. Member accounts get one alert by email.',
  },
  {
    icon: Fish,
    title: 'Log your catches',
    body: 'Every logged catch sharpens the forecast for that water, yours and everyone else’s.',
  },
];

/** Pill treatment: tinted background, matching darker ink. */
const PILL: Record<Tier, string> = {
  good: 'bg-rc-good-bg text-rc-good-ink border-rc-good-border',
  fair: 'bg-rc-fair-bg text-rc-fair-ink border-rc-fair-border',
  poor: 'bg-rc-poor-bg text-rc-poor-ink border-rc-poor/25',
};

/** Bar treatment: the solid tier fill, same as a score pin on the map. */
const BAR: Record<Tier, string> = {
  good: 'bg-rc-good',
  fair: 'bg-rc-fair',
  poor: 'bg-rc-poor',
};

const BAR_INK: Record<Tier, string> = {
  good: 'text-rc-good',
  fair: 'text-rc-fair',
  poor: 'text-rc-poor',
};

export default function NewUserWelcomeModal({
  isPro,
  onClose,
}: {
  /** Pro accounts get the 14-day line instead of the 7-day one. */
  isPro: boolean;
  /** Called once the close is recorded, with whether they reached the end. */
  onClose: (completed: boolean) => void;
}) {
  const { trackEvent } = useAnalytics();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [leaving, setLeaving] = useState(false);
  // Escape, the backdrop, the X, and the final button can all race each other.
  // Latch so only the first one records the close.
  const closed = useRef(false);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    trackEvent('Welcome Tour Shown', { pro: isPro });
    // trackEvent is stable for the life of the provider; depending on it would
    // re-fire the impression.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  /**
   * Record the close and hand back to the gate. `completed` separates reading
   * the tour from bailing out of it; both stop it reappearing, only one says
   * the lesson landed. The UI closes immediately, the write is bookkeeping.
   */
  const close = useCallback(
    async (completed: boolean, reachedStep: number) => {
      if (closed.current) return;
      closed.current = true;
      setLeaving(true);
      trackEvent(completed ? 'Welcome Tour Completed' : 'Welcome Tour Dismissed', {
        step: reachedStep + 1,
        of: STEP_COUNT,
        pro: isPro,
      });
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          await fetch('/api/welcome', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
      } catch {
        // If this fails the tour simply shows once more next session. Never
        // worth surfacing an error over.
      }
      onClose(completed);
    },
    [trackEvent, isPro, onClose],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void close(false, step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, step]);

  const isLast = step === STEP_COUNT - 1;

  const advance = () => {
    if (isLast) {
      void close(true, step);
      // Land them on the map the tour just described.
      router.push('/explore');
      return;
    }
    const next = step + 1;
    setStep(next);
    trackEvent('Welcome Tour Step', { step: next + 1, of: STEP_COUNT });
  };

  const horizon = isPro ? '14 days' : '7 days';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-tour-title"
      data-testid="welcome-tour-modal"
      data-step={step}
      onClick={() => void close(false, step)}
    >
      <div
        // The panel takes the scroll, not the backdrop, so the margin stays
        // visible on every edge instead of the sheet running flush off the top
        // and bottom of a phone.
        className="relative w-full sm:max-w-lg max-h-full overflow-y-auto bg-white rounded-2xl border border-rc-rule shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => void close(false, step)}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-full text-rc-ink-mute hover:text-rc-ink hover:bg-rc-surface transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="px-6 pt-7 pb-5 border-b border-rc-rule">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-9 h-9 rounded-full bg-rc-brand-soft flex items-center justify-center shrink-0">
              <Gauge className="w-4.5 h-4.5 text-rc-brand" />
            </span>
            <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
              Welcome to ReelCaster
            </p>
          </div>

          <h2
            id="welcome-tour-title"
            className="text-2xl sm:text-3xl font-black tracking-[-0.02em] text-rc-ink"
          >
            {TITLES[step]}
          </h2>
          <p className="mt-2 text-sm sm:text-base leading-relaxed text-rc-ink-soft">
            {SUBTITLES[step]}
          </p>

          <div
            className="mt-4 flex items-center gap-1.5"
            role="progressbar"
            aria-valuenow={step + 1}
            aria-valuemin={1}
            aria-valuemax={STEP_COUNT}
            aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
          >
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? 'bg-rc-brand' : 'bg-rc-rule'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-5">
          {step === 0 && (
            <div>
              <div className="flex items-center gap-2">
                {SCORE_EXAMPLES.map(({ value, label }) => (
                  <div
                    key={label}
                    className={`flex-1 rounded-xl border px-3 py-3 text-center ${PILL[tierOf(value)]}`}
                  >
                    <p className="text-2xl font-black tabular-nums leading-none">
                      {value}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide">
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-sm leading-relaxed text-rc-ink-soft">
                Pick a species and every spot on the map carries a score out of
                100 for it. High means the conditions line up for that fish, on
                that water, at that hour.
              </p>

              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-rc-ink-mute">
                What goes into it
              </p>
              {/* Two columns even on a phone. Stacked, six factors push the
                  primary button off the bottom of the screen, and the point of
                  the list is the breadth of it rather than any one line. */}
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {FACTORS.map((factor) => (
                  <li
                    key={factor}
                    className="flex items-start gap-1.5 text-[13px] sm:text-sm text-rc-ink-soft"
                  >
                    <Check className="w-3.5 h-3.5 text-rc-brand mt-1 shrink-0" />
                    {factor}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
                Open any spot and the score breaks apart into those pieces, so
                you can see which one is holding the day back.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="rounded-xl border border-rc-rule bg-rc-surface p-4">
                <div className="flex items-stretch gap-1.5 h-28">
                  {WEEK.map(({ day, value }) => {
                    const tier = tierOf(value);
                    const best = value === PEAK;
                    return (
                      <div
                        key={day}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <span
                          className={`text-[10px] font-bold tabular-nums shrink-0 ${BAR_INK[tier]}`}
                        >
                          {value}
                        </span>
                        {/* The bar's percentage height has to resolve against a
                            box of its own. Sized inside the column instead, it
                            competes with the two labels for the same flex
                            space and every day flattens to the same bar. */}
                        <div className="w-full flex-1 flex items-end">
                          <span
                            className={`w-full rounded-sm ${BAR[tier]} ${
                              best ? 'ring-2 ring-rc-ink/15' : ''
                            }`}
                            style={{ height: `${value}%` }}
                          />
                        </div>
                        <span
                          className={`text-[10px] shrink-0 ${
                            best ? 'font-bold text-rc-ink' : 'text-rc-ink-mute'
                          }`}
                        >
                          {day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-rc-ink-soft">
                Your forecast runs {horizon} out and breaks down hour by hour.
                Thursday is the trip. Sunday is the one you would have driven
                out for and regretted.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-rc-ink-soft">
                Open a spot for the full day: the tide curve, wind through the
                morning, water temperature, which species are actually around,
                and the regulations in force that day.
              </p>
              {!isPro && (
                <p className="mt-3 text-sm leading-relaxed text-rc-ink-mute">
                  Days 8 to 14 are part of Pro, if you ever want to plan further
                  out than a week.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
            <ul className="space-y-4">
              {MAKE_IT_YOURS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full bg-rc-brand-soft flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-rc-brand" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-rc-ink">{title}</p>
                    <p className="text-sm text-rc-ink-soft leading-relaxed mt-0.5">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 pb-6 pt-1 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={advance}
            disabled={leaving}
            data-testid="welcome-tour-cta"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-rc-brand hover:bg-rc-brand-hover disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {leaving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLast ? 'Start exploring' : 'Next'}
          </button>
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={leaving}
              data-testid="welcome-tour-back"
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-rc-rule px-5 py-2.5 text-sm font-medium text-rc-ink hover:bg-rc-surface disabled:opacity-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void close(false, step)}
              disabled={leaving}
              data-testid="welcome-tour-skip"
              className="inline-flex items-center justify-center rounded-full border border-rc-rule px-5 py-2.5 text-sm font-medium text-rc-ink hover:bg-rc-surface disabled:opacity-50 transition-colors"
            >
              Skip the tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
