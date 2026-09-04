"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, SlidersHorizontal } from "lucide-react";
import type { LeadTimeMode } from "@/lib/score-beats";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { trackEvent } from "@/lib/analytics";
import { useIsPhone } from "@/hooks/use-is-phone";
import DeliveryChannelPicker from "@/app/components/alerts/delivery-channel-picker";
import { tierFor, TIER_PILL, TIER_TEXT } from "../../lib/explore-data";

export interface AlertSpot {
  name: string;
  slug: string;
  lat: number;
  lng: number;
  city?: string | null;
  regAreaCode?: string | null;
}

export interface AlertSpeciesOption {
  id: string;
  name: string;
  slug?: string | null;
}

/**
 * The default threshold. 90, not 75.
 *
 * Scores have sat in a 70 to 90 band since the midday rescale, so 75 clears
 * on most days at most spots and the alert stops discriminating: the "~ 7
 * days a week match this" line under the slider was saying so. 90 is the top
 * of the band, the days worth a text.
 */
const DEFAULT_THRESHOLD = 90;

/**
 * The advance-notice choices, in the order they are shown. Each maps to a
 * `lead_time_mode` the engine already understands (see `score-beats.ts`,
 * which owns the day caps). The column has carried 'asap' for every alert
 * since the lead-time migration because nothing asked; this asks.
 */
const LEAD_OPTIONS: {
  mode: LeadTimeMode;
  label: string;
  sub: string;
  detail: string;
}[] = [
  {
    mode: "asap",
    label: "Up to 6 days",
    sub: "Plan the week",
    detail:
      "A heads-up when the best day in the next 6 clears your score, then a confirm the morning before it. One heads-up a week at most.",
  },
  {
    mode: "short",
    label: "Up to 3 days",
    sub: "Firmer forecast",
    detail:
      "Same two messages, but only for a day within the next 3, once the forecast has mostly settled.",
  },
  {
    mode: "day_of",
    label: "Morning of",
    sub: "Just tell me today",
    detail:
      "One message on the morning itself, on any day that clears your score. No advance notice.",
  },
];

/**
 * Create-alert modal (light rc-*) over the existing `/api/alerts` engine. Builds
 * a score-threshold alert (`alert_kind:"score"`) for the given spot + species,
 * with email delivery (SMS gated to Pro). Matches the Pedder Bay mockup.
 *
 * Two shapes of the same form. On a desktop it is the centred dialog it has
 * always been. On a phone it is a bottom sheet: it slides up from the edge the
 * thumb is already resting on, the form scrolls inside it, and the Create
 * button is pinned to the bottom where a phone expects the one thing it can
 * do next. Same state, same requests, same upgrade hand-off; only the
 * arrangement changes. `DialogContent variant="sheet"` owns the geometry, the
 * slide, the scrim and the keyboard measurement, the same way it does for the
 * trial offer in `pro-trial-modal`.
 */
export default function CreateAlertDialog({
  open,
  onOpenChange,
  spot,
  speciesOptions,
  initialSpeciesId,
  dailyScores = [],
  onCreated,
  onUpgradeRequired,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spot: AlertSpot;
  speciesOptions: AlertSpeciesOption[];
  initialSpeciesId?: string | null;
  /** Spot's 14-day daily scores (0–100), for the "~N days/week" estimate. */
  dailyScores?: (number | null)[];
  onCreated?: () => void;
  /**
   * Fired instead of showing the form when the angler has no alert slot left.
   * The parent opens `<ProTrialModal feature="alerts">` — filling in a form
   * you're not allowed to submit, then being told so by a red line of text,
   * is a worse answer than naming the wall up front.
   */
  onUpgradeRequired?: () => void;
}) {
  const { session } = useAuth();
  const { isPaid } = useSubscription();
  const router = useRouter();
  // Answers on the first client render, so the shape this mounts in is the
  // shape it keeps. See the hook for why an effect would not do.
  const phone = useIsPhone();

  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [leadMode, setLeadMode] = useState<LeadTimeMode>("asap");
  const [speciesId, setSpeciesId] = useState<string | null>(
    initialSpeciesId ?? speciesOptions[0]?.id ?? null,
  );
  const [emailOn, setEmailOn] = useState(true);
  const [smsOn, setSmsOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState<number | null>(null);

  const limit = isPaid ? 10 : 1;

  // Reset + fetch the user's current alert count whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setThreshold(DEFAULT_THRESHOLD);
    setLeadMode("asap");
    setSpeciesId(initialSpeciesId ?? speciesOptions[0]?.id ?? null);
    setEmailOn(true);
    setSmsOn(false);
    setError(null);
    if (session?.access_token) {
      fetch("/api/alerts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const used: number | null = d?.profiles?.length ?? null;
          setUsedCount(used);
          // Already out of slots — hand straight off to the upgrade modal
          // rather than rendering a form the API will refuse.
          if (!isPaid && onUpgradeRequired && used != null && used >= limit) {
            onOpenChange(false);
            onUpgradeRequired();
          }
        })
        .catch(() => setUsedCount(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const tier = tierFor(threshold);
  const daysPerWeek = useMemo(() => {
    const vals = dailyScores.filter((v): v is number => typeof v === "number");
    if (vals.length === 0) return null;
    const hit = vals.filter((v) => v >= threshold).length;
    return Math.round((hit / vals.length) * 7);
  }, [dailyScores, threshold]);

  const species = speciesOptions.find((s) => s.id === speciesId) ?? null;

  // Escape hatch to the full condition-set builder, carrying this spot's
  // context so the advanced page skips location entry (it's anchored here).
  const goAdvanced = () => {
    const params = new URLSearchParams({
      slug: spot.slug,
      name: spot.name,
      lat: String(spot.lat),
      lng: String(spot.lng),
      threshold: String(threshold),
    });
    if (spot.city) params.set("city", spot.city);
    if (spot.regAreaCode) params.set("area", spot.regAreaCode);
    if (species?.slug) params.set("species", species.slug);
    onOpenChange(false);
    router.push(`/profile/custom-alerts?${params.toString()}`);
  };

  const handleCreate = async () => {
    if (!session?.access_token || !species) {
      setError("Pick a species first.");
      return;
    }
    const channels: ("email" | "sms")[] = [];
    if (emailOn) channels.push("email");
    if (smsOn) channels.push("sms");
    if (channels.length === 0) {
      setError("Choose at least one delivery channel.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name: `${species.name} ≥${threshold} at ${spot.name}`,
          location_lat: spot.lat,
          location_lng: spot.lng,
          location_name: spot.name,
          triggers: {
            fishing_score: {
              enabled: true,
              min_score: threshold,
              species: species.slug ?? undefined,
            },
          },
          logic_mode: "AND",
          cooldown_hours: 12,
          alert_kind: "score",
          target_bluecaster_spot_slug: spot.slug,
          target_species: species.slug ?? null,
          score_threshold: threshold,
          delivery_channels: channels,
          lead_time_mode: leadMode,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        // The server is the real gate — a stale in-modal count can still let
        // someone reach submit. Hand off to the same upgrade modal.
        if (body.upgrade_required && onUpgradeRequired) {
          setSaving(false);
          onOpenChange(false);
          onUpgradeRequired();
          return;
        }
        setError(
          body.upgrade_required
            ? "You've hit the free-tier limit of 1 alert. Upgrade for more."
            : (body.error ?? "Couldn't create the alert."),
        );
        setSaving(false);
        return;
      }
      trackEvent("Alert Created", {
        surface: "spot-dialog",
        slug: spot.slug,
        species: species.slug,
        threshold,
        channels,
        lead_mode: leadMode,
        paid: isPaid,
      });
      onCreated?.();
      onOpenChange(false);
    } catch {
      setError("Couldn't create the alert.");
    } finally {
      setSaving(false);
    }
  };

  const a11y = (
    <>
      <DialogTitle className="sr-only">
        Create a score alert for {spot.name}
      </DialogTitle>
      <DialogDescription className="sr-only">
        We watch the forecast and notify you when your score threshold is met.
      </DialogDescription>
    </>
  );

  // The form itself: everything between the headline and the footer. One
  // tree for both shapes, so a field added here shows up on both.
  const form = (
    <>
      {/* Spot */}
      <div className="mt-5 rounded-xl bg-rc-brand-soft px-4 py-3">
        <div className="rc-label text-[9px] text-rc-brand">SPOT</div>
        <div className="font-bold text-rc-ink mt-0.5">
          {[spot.name, spot.city, spot.regAreaCode ? `PFMA ${spot.regAreaCode}` : null]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>

      {/* Threshold */}
      <div className="mt-6">
        <div className="rc-label text-[9px] text-rc-ink-mute">SCORE THRESHOLD</div>
        <div className="text-rc-ink-soft mt-1">
          Notify me when the score is at or above
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span
            className={`font-bold leading-none tracking-[-0.04em] ${
              phone ? "text-5xl" : "text-6xl"
            } ${TIER_TEXT[tier]}`}
          >
            {threshold}
          </span>
          <span
            className={`px-2 py-0.5 rounded font-rc-mono text-[11px] font-bold uppercase tracking-[0.06em] ${TIER_PILL[tier]}`}
          >
            {tier}
          </span>
        </div>
        {daysPerWeek != null && (
          <div className="font-rc-mono text-[12px] text-rc-ink-mute mt-1">
            ~ {daysPerWeek} {daysPerWeek === 1 ? "day" : "days"} a week match this
          </div>
        )}

        {/* A taller hit band on the phone: the visible track stays 8px, but
            the invisible range input underneath is what the thumb lands on. */}
        <div className={`relative mt-4 ${phone ? "h-8" : "h-5"}`}>
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full"
            style={{
              background:
                "linear-gradient(to right, var(--rc-poor-bg) 0%, var(--rc-poor-bg) 55%, var(--rc-fair-bg) 55%, var(--rc-fair-bg) 75%, var(--rc-good-bg) 75%, var(--rc-good-bg) 100%)",
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-rc-panel shadow ring-2"
            style={{
              left: `${threshold}%`,
              color:
                tier === "good"
                  ? "var(--rc-good)"
                  : tier === "fair"
                    ? "var(--rc-fair)"
                    : "var(--rc-poor)",
              // ring-2 uses currentColor via ring; emulate with border
              borderColor: "currentColor",
              borderWidth: 3,
            }}
          />
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="Score threshold"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <div className="flex justify-between font-rc-mono text-[10px] text-rc-ink-mute mt-1.5">
          <span>0</span>
          <span className="text-rc-poor">POOR</span>
          <span className="text-rc-fair">FAIR</span>
          <span className="text-rc-good">GOOD</span>
          <span>100</span>
        </div>
      </div>

      {/* Advance notice */}
      <div className="mt-6">
        <div className="rc-label text-[9px] text-rc-ink-mute">ADVANCE NOTICE</div>
        <div className="text-rc-ink-soft mt-1">How far ahead do you want to know</div>
        <div
          role="radiogroup"
          aria-label="Advance notice"
          className="mt-2 grid grid-cols-3 gap-2"
        >
          {LEAD_OPTIONS.map((o) => {
            const sel = o.mode === leadMode;
            return (
              <button
                key={o.mode}
                type="button"
                role="radio"
                aria-checked={sel}
                onClick={() => setLeadMode(o.mode)}
                className={`rounded-xl border px-2 py-2.5 text-center transition-colors ${
                  sel
                    ? "border-rc-brand bg-rc-brand text-white"
                    : "border-rc-rule bg-rc-panel text-rc-ink hover:border-rc-ink-mute"
                }`}
              >
                <div className="text-sm font-semibold leading-tight">{o.label}</div>
                <div
                  className={`mt-0.5 font-rc-mono text-[10px] leading-tight ${
                    sel ? "text-white/80" : "text-rc-ink-mute"
                  }`}
                >
                  {o.sub}
                </div>
              </button>
            );
          })}
        </div>
        {/* What the choice actually does, in the cadence the engine keeps.
            "Too loose" was the complaint: the angler had no way to know when
            the message would come or how many. This says it before Create. */}
        <p className="mt-2 text-[12px] leading-relaxed text-rc-ink-mute">
          {LEAD_OPTIONS.find((o) => o.mode === leadMode)?.detail}
        </p>
      </div>

      {/* Species */}
      <div className="mt-6">
        <div className="rc-label text-[9px] text-rc-ink-mute">SPECIES</div>
        <div className="text-rc-ink-soft mt-1">Which species should drive the alert</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {speciesOptions.map((s) => {
            const sel = s.id === speciesId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpeciesId(s.id)}
                className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  sel
                    ? "border-rc-brand bg-rc-brand text-white"
                    : "border-rc-rule bg-rc-panel text-rc-ink hover:border-rc-ink-mute"
                }`}
              >
                {shortName(s.name)}
              </button>
            );
          })}
        </div>
      </div>

      <DeliveryChannelPicker
        className="mt-6"
        emailOn={emailOn}
        onEmailChange={setEmailOn}
        smsOn={smsOn}
        onSmsChange={setSmsOn}
        resetKey={open}
        onUpgradeRequired={
          onUpgradeRequired
            ? () => {
                onOpenChange(false);
                onUpgradeRequired();
              }
            : undefined
        }
      />

      {error && (
        <div className="mt-4 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2">
          {error}
        </div>
      )}

      {/* Advanced escape hatch — condition-set builder for power users. */}
      <button
        type="button"
        onClick={goAdvanced}
        className="mt-5 inline-flex items-center gap-1.5 font-rc-mono text-[11px] font-semibold text-rc-ink-mute hover:text-rc-brand transition-colors"
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        Need specific conditions? Advanced setup →
      </button>
    </>
  );

  const quota = (
    <div className="font-rc-mono text-[11px] text-rc-ink-mute uppercase tracking-[0.04em]">
      {isPaid ? "PRO" : "MEMBER"} ·{" "}
      {usedCount != null ? usedCount : "—"} of {limit}{" "}
      {limit === 1 ? "alert" : "alerts"}
    </div>
  );

  const createButton = (
    <button
      type="button"
      onClick={handleCreate}
      disabled={saving}
      className={`rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
        phone ? "w-full px-4 py-3 text-[15px]" : "px-5 py-2.5 text-sm"
      }`}
    >
      {saving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Clock className="w-4 h-4" />
      )}
      Create alert →
    </button>
  );

  if (phone) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          variant="sheet"
          data-shape="sheet"
          className="bg-rc-panel border-rc-rule text-rc-ink gap-0 p-0 [&>[data-slot=dialog-close]]:z-20"
        >
          {a11y}

          {/* Grab handle. Decorative: the sheet closes by the X, the scrim or
              Escape, all three of which the dialog primitive already owns. */}
          <div className="flex shrink-0 justify-center pt-3 pb-1" aria-hidden>
            <div className="h-1 w-10 rounded-full bg-rc-rule" />
          </div>

          {/* The form scrolls; the footer does not. The species pills and
              the delivery rows push this past one screen on most phones,
              and the Create button must not be a scroll away. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-3">
            <div className="rc-label text-[10px] text-rc-brand pr-10">
              CREATE ALERT · {spot.name.toUpperCase()}
            </div>
            <h2 className="mt-1.5 pr-10 text-[22px] leading-[28px] font-bold tracking-[-0.02em] text-rc-ink">
              Get notified when conditions hit
            </h2>
            <p className="mt-1 text-sm text-rc-ink-soft">
              We&apos;ll watch the forecast and ping you when your threshold is met.
            </p>
            {form}
          </div>

          {/* Pinned to the bottom edge, under the thumb. No Cancel here: the
              X, the scrim and a swipe already answer that, and a second
              button beside the one that matters halves its width. */}
          <div className="shrink-0 border-t border-rc-rule-soft px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-2.5 flex justify-center">{quota}</div>
            {createButton}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-lg p-6">
        {a11y}

        <div className="rc-label text-[10px] text-rc-brand">
          CREATE ALERT · {spot.name.toUpperCase()}
        </div>
        <h2 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-rc-ink">
          Get notified when conditions hit
        </h2>
        <p className="mt-1 text-sm text-rc-ink-soft">
          We&apos;ll watch the forecast and ping you when your threshold is met.
        </p>

        {form}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-rc-rule-soft">
          {quota}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2.5 rounded-xl border border-rc-rule text-rc-ink text-sm font-semibold hover:bg-rc-surface transition-colors"
            >
              Cancel
            </button>
            {createButton}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function shortName(name: string): string {
  return name.replace(/\s+(Salmon|Crab)$/i, "").replace(/^Pacific\s+/i, "");
}
