"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { fetchSpotLive } from "@/lib/bluecaster-client";
import { tierFor, TIER_PILL } from "@/app/explore/lib/explore-data";
import DeliveryChannelPicker from "@/app/components/alerts/delivery-channel-picker";
import type { PickedSpot } from "./spot-typeahead";

export interface AlertDraft {
  speciesId: string | null;
  speciesSlug: string | null;
  speciesName: string | null;
  threshold: number;
  email: boolean;
  sms: boolean;
}

export const DEFAULT_ALERT_DRAFT: AlertDraft = {
  speciesId: null,
  speciesSlug: null,
  speciesName: null,
  threshold: 75,
  email: true,
  sms: false,
};

/**
 * Step 4 — one score alert on the spot just pinned. Deliberately the simple
 * `alert_kind:"score"` shape (spot + species + threshold), not the condition-set
 * builder at /profile/custom-alerts: the point of the last onboarding step is
 * that the angler leaves with something that will actually fire, not that they
 * have seen every knob.
 *
 * The species roster and the 14-day scores both come from the spot's live page,
 * which is also what gives the "about N days a week" estimate its honesty — a
 * threshold nobody's water ever crosses is an alert that never arrives.
 */
export default function StepAlert({
  spot,
  draft,
  onChange,
  onUpgradeRequired,
}: {
  spot: PickedSpot;
  draft: AlertDraft;
  onChange: (next: AlertDraft) => void;
  onUpgradeRequired?: () => void;
}) {
  const [species, setSpecies] = useState<
    { id: string; name: string; slug: string }[] | null
  >(null);
  const [dailyScores, setDailyScores] = useState<(number | null)[]>([]);

  useEffect(() => {
    let cancelled = false;
    setSpecies(null);
    fetchSpotLive(spot.slug)
      .then((page) => {
        if (cancelled || !page) {
          if (!cancelled) setSpecies([]);
          return;
        }
        const roster = [...page.species]
          .sort((a, b) => a.rank - b.rank)
          .map((s) => ({ id: s.id, name: s.name, slug: s.slug }));
        setSpecies(roster);

        const top = roster[0];
        if (top && !draft.speciesId) {
          onChange({
            ...draft,
            speciesId: top.id,
            speciesSlug: top.slug,
            speciesName: top.name,
          });
        }
        setDailyScores(
          (page.daily14 ?? []).map((d) =>
            typeof d.score === "number" ? d.score : null,
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setSpecies([]);
      });
    return () => {
      cancelled = true;
    };
    // Refetch only when the spot changes; `draft` churns on every keystroke of
    // the slider and would restart the fetch each time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot.slug]);

  const daysPerWeek = useMemo(() => {
    const vals = dailyScores.filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    const hit = vals.filter((v) => v >= draft.threshold).length;
    return Math.round((hit / vals.length) * 7);
  }, [dailyScores, draft.threshold]);

  const tier = tierFor(draft.threshold);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-lg border border-rc-rule bg-rc-surface px-3 py-2.5">
        <MapPin className="w-4 h-4 text-rc-brand shrink-0" />
        <p className="text-sm font-medium text-rc-ink truncate">{spot.name}</p>
      </div>

      <div>
        <p className="text-sm font-semibold text-rc-ink mb-1.5">
          Which species?
        </p>
        {species === null ? (
          <div className="flex items-center gap-2 text-sm text-rc-ink-mute py-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading this spot&rsquo;s species…
          </div>
        ) : species.length === 0 ? (
          <p className="text-sm text-rc-ink-soft">
            We don&rsquo;t have a scored species roster for this spot yet, so
            there&rsquo;s nothing to alert on. Skip this, you can add an alert
            from any spot page once it&rsquo;s scored.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {species.map((s) => {
              const active = draft.speciesId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    onChange({
                      ...draft,
                      speciesId: s.id,
                      speciesSlug: s.slug,
                      speciesName: s.name,
                    })
                  }
                  className={`min-h-11 px-3.5 rounded-lg border text-sm font-medium transition-colors ${
                    active
                      ? "border-rc-brand bg-rc-brand-soft text-rc-brand"
                      : "border-rc-rule bg-white text-rc-ink hover:bg-rc-surface"
                  }`}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {species !== null && species.length > 0 && (
        <>
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label
                htmlFor="rc-onboarding-threshold"
                className="text-sm font-semibold text-rc-ink"
              >
                Ping me when the score hits
              </label>
              <span
                className={`px-2 py-0.5 rounded font-rc-mono text-xs font-bold ${TIER_PILL[tier]}`}
              >
                {draft.threshold}
              </span>
            </div>
            <input
              id="rc-onboarding-threshold"
              type="range"
              min={50}
              max={95}
              step={5}
              value={draft.threshold}
              onChange={(e) =>
                onChange({ ...draft, threshold: Number(e.target.value) })
              }
              className="w-full accent-rc-brand"
            />
            <p className="mt-1.5 text-xs text-rc-ink-mute">
              {daysPerWeek === null
                ? "We'll check every forecast run and let you know."
                : daysPerWeek === 0
                  ? "Nothing in the next two weeks reaches this. Try a lower score."
                  : `About ${daysPerWeek} day${daysPerWeek === 1 ? "" : "s"} a week at this spot lately.`}
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-rc-ink mb-1.5">
              How should we reach you?
            </p>
            <DeliveryChannelPicker
              emailOn={draft.email}
              onEmailChange={(on) => onChange({ ...draft, email: on })}
              smsOn={draft.sms}
              onSmsChange={(on) => onChange({ ...draft, sms: on })}
              onUpgradeRequired={onUpgradeRequired}
            />
          </div>
        </>
      )}
    </div>
  );
}
