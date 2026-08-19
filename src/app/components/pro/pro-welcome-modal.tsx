'use client';

/**
 * One-time "Welcome to Pro" onboarding wizard.
 *
 * Mounted once at the root so it can catch the user wherever they land after
 * signing in — there is no single post-login destination. It renders nothing
 * until `/api/pro/welcome` says the user is Pro and has never dismissed it,
 * which means signed-out visitors and public crawlers pay one fetch that
 * returns `{show:false}` and nothing more.
 *
 * Four steps: what Pro opened up, who you are (name + units), where you fish
 * (region + home spot), and one alert on that spot. Only the first two are
 * required — someone who hasn't settled on a home spot is better off skipping
 * to the map than picking one under pressure, and an alert with no spot behind
 * it has nothing to fire on.
 *
 * Each field saves to wherever that field already lives: the name and units to
 * auth metadata, the home spot to both localStorage and the profile copy, the
 * alert to /api/alerts, the region to user_settings via this route. Nothing
 * batches into a single write at the end, so closing the wizard halfway keeps
 * whatever was already entered.
 *
 * The dismissal is recorded server-side, not in localStorage: a welcome that
 * reappears on every new device stops reading as a welcome.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  CalendarRange,
  Check,
  Crown,
  Fish,
  Layers,
  Loader2,
  MapPin,
  BellRing,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { useAnalytics } from '@/hooks/use-analytics';
import { useUnitPreferences } from '@/contexts/unit-preferences-context';
import { saveHomeSpot } from '@/app/explore/lib/use-home-spot';
import StepYou, {
  UNIT_PRESETS,
  type UnitPreset,
} from './onboarding/step-you';
import StepWater from './onboarding/step-water';
import StepAlert, {
  DEFAULT_ALERT_DRAFT,
  type AlertDraft,
} from './onboarding/step-alert';
import type { PickedSpot } from './onboarding/spot-typeahead';

interface WelcomeState {
  show: boolean;
  comped?: boolean;
  tier?: string;
  trialing?: boolean;
  until?: string | null;
  region?: string | null;
}

const FEATURES = [
  {
    icon: CalendarRange,
    title: '14-day forecast',
    body: 'The full two-week outlook, hour by hour. Plan the trip, not just the morning.',
  },
  {
    icon: Fish,
    title: 'Five species at once',
    body: 'Compare the bite score across species on a spot instead of flipping between them.',
  },
  {
    icon: BellRing,
    title: 'Up to 10 alerts, by email or SMS',
    body: 'Get a ping when a spot you care about crosses the score you set.',
  },
  {
    icon: MapPin,
    title: 'Your own spots',
    body: 'Drop a pin anywhere in covered water and get it scored like a published spot. No one-spot cap on favourites.',
  },
  {
    icon: Layers,
    title: 'Bathymetry',
    body: 'Drop-offs, ledges, and channel structure under the live forecast map.',
  },
];

const STEP_COUNT = 4;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ProWelcomeModal() {
  const { user, session, loading: authLoading } = useAuth();
  const { trackEvent } = useAnalytics();
  const { setUnits } = useUnitPreferences();
  const pathname = usePathname();
  const router = useRouter();

  const [state, setState] = useState<WelcomeState>({ show: false });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tracked = useRef(false);
  // Escape, the backdrop, the X, and Finish can all race each other. Latch so
  // only the first one records the close.
  const closed = useRef(false);

  // Draft — each step commits its own fields as it advances.
  const [firstName, setFirstName] = useState('');
  const [preset, setPreset] = useState<UnitPreset>('bc');
  const [region, setRegion] = useState<string | null>(null);
  const [spot, setSpot] = useState<PickedSpot | null>(null);
  const [alertDraft, setAlertDraft] = useState<AlertDraft>(DEFAULT_ALERT_DRAFT);

  // Never interrupt the purchase flow: popping "Welcome to Pro" on the pricing
  // page reads as premature (mid-checkout, or to someone whose tier flipped
  // elsewhere), and /billing/success celebrates on its own. The modal instead
  // catches the buyer on the page they land on next (/explore after the
  // success redirect) — and comped users anywhere else, as before.
  const suppressed =
    pathname === '/pricing' || (pathname?.startsWith('/billing') ?? false);

  useEffect(() => {
    if (authLoading || !user || suppressed) return;
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        if (!s || cancelled) return;

        const res = await fetch('/api/pro/welcome', {
          headers: { Authorization: `Bearer ${s.access_token}` },
        });
        if (!res.ok || cancelled) return;

        const body: WelcomeState = await res.json();
        if (!body.show || cancelled) return;

        setState(body);
        if (body.region) setRegion(body.region);
        if (!tracked.current) {
          tracked.current = true;
          trackEvent('Pro Welcome Shown', {
            comped: !!body.comped,
            trialing: !!body.trialing,
            tier: body.tier,
          });
        }
      } catch {
        // A welcome modal is never worth surfacing an error for.
      }
    })();

    return () => {
      cancelled = true;
    };
    // trackEvent is stable for the life of the provider; re-running on it would
    // re-fire the impression event. `user?.id` rather than `user`: AuthProvider
    // re-emits a fresh user object on every auth event, and an object dep made
    // this gate call /api/pro/welcome twice on every page load, site-wide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, suppressed]);

  /**
   * Record the close and hide. `completed` distinguishes reaching the end from
   * bailing out — both stop the wizard reappearing, only one counts as
   * onboarded. The UI closes immediately; the write is bookkeeping.
   */
  const close = useCallback(
    async (completed: boolean, reachedStep: number) => {
      if (closed.current) return;
      closed.current = true;
      setState({ show: false });
      trackEvent(completed ? 'Pro Onboarding Completed' : 'Pro Welcome Dismissed', {
        step: reachedStep,
        named: !!firstName.trim(),
        homeSpot: !!spot,
        alert: !!alertDraft.speciesId && completed,
      });
      try {
        const {
          data: { session: s },
        } = await supabase.auth.getSession();
        if (!s) return;
        await fetch('/api/pro/welcome', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${s.access_token}`,
          },
          body: JSON.stringify({ completed, region: region ?? undefined }),
        });
      } catch {
        // If this fails the wizard simply shows once more next session.
      }
    },
    [trackEvent, firstName, spot, alertDraft.speciesId, region],
  );

  useEffect(() => {
    if (!state.show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void close(false, step);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.show, close, step]);

  // The alert step has nothing to hang an alert on without a spot, so with none
  // pinned the wizard ends at step 2. Computed here rather than at render
  // because advance/skip both need it to know where the end is.
  const lastStep = spot ? STEP_COUNT - 1 : 2;

  // ── per-step commits ───────────────────────────────────────────────────
  const saveYou = async () => {
    // Sequential, not Promise.all: both of these are `auth.updateUser` calls
    // against the same user_metadata blob, and firing them together races two
    // read-modify-writes over one object — the loser's key silently vanishes.
    await supabase.auth.updateUser({ data: { first_name: firstName.trim() } });
    await setUnits(UNIT_PRESETS[preset].units);
  };

  const saveAlert = async (): Promise<boolean> => {
    if (!spot || !alertDraft.speciesId || !session?.access_token) return true;
    const channels: ('email' | 'sms')[] = [];
    if (alertDraft.email) channels.push('email');
    if (alertDraft.sms) channels.push('sms');
    if (channels.length === 0) {
      setError('Pick at least one way to reach you, or skip this step.');
      return false;
    }
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name: `${alertDraft.speciesName} ≥${alertDraft.threshold} at ${spot.name}`,
        location_lat: spot.lat,
        location_lng: spot.lng,
        location_name: spot.name,
        triggers: {
          fishing_score: {
            enabled: true,
            min_score: alertDraft.threshold,
            species: alertDraft.speciesSlug ?? undefined,
          },
        },
        logic_mode: 'AND',
        cooldown_hours: 12,
        alert_kind: 'score',
        target_bluecaster_spot_slug: spot.slug,
        target_species: alertDraft.speciesSlug ?? null,
        score_threshold: alertDraft.threshold,
        delivery_channels: channels,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Couldn't create that alert. You can add one from the spot page later.");
      return false;
    }
    return true;
  };

  const advance = async () => {
    setError(null);
    setSaving(true);
    try {
      if (step === 1) await saveYou();
      if (step === 2 && spot) await saveHomeSpot(spot.slug);
      if (step === 3) {
        const ok = await saveAlert();
        if (!ok) return;
      }

      if (step === lastStep) {
        await close(true, step);
        // Land them where the work they just did pays off.
        router.push(spot ? `/explore/spot/${spot.slug}` : '/explore');
        return;
      }
      setStep((s) => s + 1);
    } catch {
      setError('Something went wrong saving that. Try again, or skip.');
    } finally {
      setSaving(false);
    }
  };

  const skip = async () => {
    setError(null);
    if (step === lastStep) {
      await close(true, step);
      router.push(spot ? `/explore/spot/${spot.slug}` : '/explore');
      return;
    }
    setStep((s) => s + 1);
  };

  if (!state.show || suppressed) return null;

  const { comped, trialing, until } = state;
  const untilLabel = until ? formatDate(until) : null;

  const isLast = step === lastStep;
  const canAdvance = step !== 1 || firstName.trim().length > 0;

  const TITLES = ['Welcome to Pro.', 'About you', 'Your water', 'One alert to start'];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-title"
      data-testid="pro-welcome-modal"
      data-step={step}
      data-comped={comped ? 'true' : 'false'}
      onClick={() => void close(false, step)}
    >
      <div
        // The feature list is taller than a phone viewport, so the panel — not
        // the backdrop — takes the scroll. That keeps the margin visible on
        // every edge instead of the sheet running flush off the top and bottom.
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
              <Crown className="w-4.5 h-4.5 text-rc-brand" />
            </span>
            <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
              {comped ? 'Complimentary' : 'ReelCaster Pro'}
            </p>
          </div>

          <h2
            id="pro-welcome-title"
            className="text-2xl sm:text-3xl font-black tracking-[-0.02em] text-rc-ink"
          >
            {TITLES[step]}
          </h2>

          {step === 0 ? (
            <p className="mt-2 text-sm sm:text-base leading-relaxed text-rc-ink-soft">
              {comped ? (
                <>
                  A full year of ReelCaster Pro is on us
                  {untilLabel ? <>, yours through {untilLabel}</> : null}. Nothing
                  to pay, no card on file. Here&rsquo;s what just opened up.
                </>
              ) : trialing ? (
                <>
                  Your free trial is on
                  {untilLabel ? (
                    <>, with nothing charged before {untilLabel}</>
                  ) : null}
                  , and you can cancel anytime before then. Here&rsquo;s what just
                  opened up.
                </>
              ) : (
                <>
                  Your account is now Pro
                  {untilLabel ? <>, renewing {untilLabel}</> : null}. Here&rsquo;s
                  what just opened up.
                </>
              )}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
              {step === 1
                ? 'Two quick things, so every forecast reads the way you expect.'
                : step === 2
                  ? 'Pin the water you fish most and your dashboard opens on it.'
                  : 'Set it once and we watch the forecast for you.'}
            </p>
          )}

          {/* Progress — hidden on the intro, where there is nothing to be
              partway through yet. */}
          {step > 0 && (
            <div
              className="mt-4 flex items-center gap-1.5"
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={lastStep + 1}
              aria-label={`Step ${step + 1} of ${lastStep + 1}`}
            >
              {Array.from({ length: lastStep + 1 }, (_, i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i <= step ? 'bg-rc-brand' : 'bg-rc-rule'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-5">
          {step === 0 && (
            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex items-start gap-3">
                  <Icon className="w-4.5 h-4.5 text-rc-brand mt-0.5 shrink-0" />
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

          {step === 1 && (
            <StepYou
              firstName={firstName}
              onFirstNameChange={setFirstName}
              preset={preset}
              onPresetChange={setPreset}
            />
          )}

          {step === 2 && (
            <StepWater
              region={region}
              onRegionChange={setRegion}
              spot={spot}
              onSpotChange={setSpot}
            />
          )}

          {step === 3 && spot && (
            <StepAlert
              spot={spot}
              draft={alertDraft}
              onChange={setAlertDraft}
            />
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-rc-poor"
              data-testid="pro-welcome-error"
            >
              {error}
            </p>
          )}
        </div>

        <div className="px-6 pb-6 pt-1 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => void advance()}
            disabled={saving || !canAdvance}
            data-testid="pro-welcome-cta"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-rc-brand hover:bg-rc-brand-hover disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === 0
              ? 'Set up my account'
              : isLast
                ? 'Finish'
                : 'Continue'}
            {isLast && !saving && <Check className="w-4 h-4" />}
          </button>
          {/* No skip on step 1 — the name and units are the two fields every
              other surface reads, so they're the one required step. Closing the
              wizard outright is still available (X, Escape, backdrop); a "Skip"
              that walks past a required field would only make "required" a
              lie. */}
          {step !== 1 && (
            <button
              type="button"
              onClick={() =>
                step === 0 ? void close(false, step) : void skip()
              }
              disabled={saving}
              data-testid="pro-welcome-skip"
              className="inline-flex items-center justify-center rounded-full border border-rc-rule px-5 py-2.5 text-sm font-medium text-rc-ink hover:bg-rc-surface disabled:opacity-50 transition-colors"
            >
              {step === 0 ? 'Maybe later' : isLast ? 'Done' : 'Skip'}
            </button>
          )}
        </div>

        {comped && step === 0 && (
          <p className="px-6 pb-6 -mt-2 text-xs text-rc-ink-mute">
            We&rsquo;ll let you know before the year is up. You won&rsquo;t be
            charged unless you choose to subscribe.
          </p>
        )}
      </div>
    </div>
  );
}
