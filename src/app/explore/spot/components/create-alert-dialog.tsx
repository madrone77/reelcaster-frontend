"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Smartphone,
  SlidersHorizontal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { useSubscription } from "@/hooks/use-subscription";
import { tierFor, TIER_PILL, TIER_TEXT } from "../../lib/explore-data";

const E164_RE = /^\+[1-9]\d{7,14}$/;

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
 * Create-alert modal (light rc-*) over the existing `/api/alerts` engine. Builds
 * a score-threshold alert (`alert_kind:"score"`) for the given spot + species,
 * with email delivery (SMS gated to Pro). Matches the Pedder Bay mockup.
 */
export default function CreateAlertDialog({
  open,
  onOpenChange,
  spot,
  speciesOptions,
  initialSpeciesId,
  dailyScores = [],
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spot: AlertSpot;
  speciesOptions: AlertSpeciesOption[];
  initialSpeciesId?: string | null;
  /** Spot's 14-day daily scores (0–100), for the "~N days/week" estimate. */
  dailyScores?: (number | null)[];
  onCreated?: () => void;
}) {
  const { user, session } = useAuth();
  const { isPaid, phoneVerified, phoneE164, refresh } = useSubscription();
  const router = useRouter();

  const [threshold, setThreshold] = useState(75);
  const [speciesId, setSpeciesId] = useState<string | null>(
    initialSpeciesId ?? speciesOptions[0]?.id ?? null,
  );
  const [emailOn, setEmailOn] = useState(true);
  const [smsOn, setSmsOn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedCount, setUsedCount] = useState<number | null>(null);

  // Inline phone-verification (Pro users without a verified phone). Drives the
  // /api/alerts/verify-phone route (POST = send code, PUT = confirm).
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyStep, setVerifyStep] = useState<"enter-phone" | "enter-code">(
    "enter-phone",
  );
  const [phoneInput, setPhoneInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyInfo, setVerifyInfo] = useState<string | null>(null);

  const limit = isPaid ? 10 : 1;

  // Reset + fetch the user's current alert count whenever the modal opens.
  useEffect(() => {
    if (!open) return;
    setThreshold(75);
    setSpeciesId(initialSpeciesId ?? speciesOptions[0]?.id ?? null);
    setEmailOn(true);
    setSmsOn(false);
    setError(null);
    setVerifyOpen(false);
    setVerifyStep("enter-phone");
    setPhoneInput(phoneE164 ?? "");
    setCodeInput("");
    setVerifyError(null);
    setVerifyInfo(null);
    if (session?.access_token) {
      fetch("/api/alerts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setUsedCount(d?.profiles?.length ?? null))
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
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(
          body.upgrade_required
            ? "You've hit the free-tier limit of 1 alert. Upgrade for more."
            : (body.error ?? "Couldn't create the alert."),
        );
        setSaving(false);
        return;
      }
      onCreated?.();
      onOpenChange(false);
    } catch {
      setError("Couldn't create the alert.");
    } finally {
      setSaving(false);
    }
  };

  const handleSendCode = async () => {
    setVerifyError(null);
    setVerifyInfo(null);
    if (!E164_RE.test(phoneInput)) {
      setVerifyError("Enter a phone number like +15551234567 (with country code).");
      return;
    }
    if (!session?.access_token) {
      setVerifyError("Please sign in again.");
      return;
    }
    setVerifyBusy(true);
    try {
      const res = await fetch("/api/alerts/verify-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: phoneInput }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          res.status === 503
            ? "SMS verification isn't switched on yet — hang tight, it's coming soon."
            : (body.error ?? "Couldn't send the code."),
        );
      }
      setVerifyStep("enter-code");
      setVerifyInfo(`We texted a code to ${phoneInput}. It may take a minute.`);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Couldn't send the code.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    setVerifyError(null);
    setVerifyInfo(null);
    if (codeInput.length < 4) {
      setVerifyError("Enter the code we texted you.");
      return;
    }
    if (!session?.access_token) {
      setVerifyError("Please sign in again.");
      return;
    }
    setVerifyBusy(true);
    try {
      const res = await fetch("/api/alerts/verify-phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ phone: phoneInput, code: codeInput }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.approved) {
        throw new Error(body.error ?? "That code didn't match. Try again.");
      }
      // Verified — flip the subscription state so smsAvailable becomes true,
      // collapse the verify UI, and pre-arm the SMS channel for this alert.
      setVerifyOpen(false);
      setSmsOn(true);
      refresh();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Couldn't verify that code.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const smsAvailable = isPaid && phoneVerified;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">
          Create a score alert for {spot.name}
        </DialogTitle>
        <DialogDescription className="sr-only">
          We watch the forecast and notify you when your score threshold is met.
        </DialogDescription>

        <div className="rc-label text-[10px] text-rc-brand">
          CREATE ALERT · {spot.name.toUpperCase()}
        </div>
        <h2 className="mt-1.5 text-2xl font-bold tracking-[-0.02em] text-rc-ink">
          Get notified when conditions hit
        </h2>
        <p className="mt-1 text-sm text-rc-ink-soft">
          We&apos;ll watch the forecast and ping you when your threshold is met.
        </p>

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
              className={`text-6xl font-bold leading-none tracking-[-0.04em] ${TIER_TEXT[tier]}`}
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

          <div className="relative mt-4 h-5">
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

        {/* Delivery */}
        <div className="mt-6">
          <div className="rc-label text-[9px] text-rc-ink-mute">DELIVERY</div>
          <button
            type="button"
            onClick={() => setEmailOn((v) => !v)}
            className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 flex items-center gap-3 text-left"
          >
            <Mail className="w-5 h-5 text-rc-brand shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-bold text-rc-ink">Email</div>
              <div className="font-rc-mono text-[11px] text-rc-ink-mute truncate">
                {user?.email ?? "your email"}
              </div>
            </div>
            <Toggle on={emailOn} />
          </button>

          <div className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-surface px-4 py-3">
            <div className="flex items-center gap-3">
              <Smartphone
                className={`w-5 h-5 shrink-0 ${smsAvailable ? "text-rc-brand" : "text-rc-ink-mute"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-rc-ink flex items-center gap-1.5">
                  SMS
                  {smsAvailable && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-rc-good" />
                  )}
                </div>
                <div className="font-rc-mono text-[11px] text-rc-ink-mute">
                  {smsAvailable
                    ? "Instant texts"
                    : isPaid
                      ? "Verify your phone to enable SMS"
                      : "Available with Pro"}
                </div>
              </div>
              {smsAvailable ? (
                <button type="button" onClick={() => setSmsOn((v) => !v)}>
                  <Toggle on={smsOn} />
                </button>
              ) : isPaid ? (
                <button
                  type="button"
                  onClick={() => {
                    setVerifyOpen((v) => !v);
                    setVerifyError(null);
                    setVerifyInfo(null);
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-xs font-semibold transition-colors"
                >
                  {verifyOpen ? "CANCEL" : "VERIFY"}
                </button>
              ) : (
                <Link
                  href="/pricing?from=alerts"
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-rc-brand hover:bg-rc-brand-hover text-white text-xs font-semibold transition-colors"
                >
                  UPGRADE
                </Link>
              )}
            </div>

            {isPaid && !phoneVerified && verifyOpen && (
              <div className="mt-3 space-y-2 border-t border-rc-rule-soft pt-3">
                {verifyStep === "enter-phone" ? (
                  <>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      placeholder="+15551234567"
                      className="w-full rounded-lg border border-rc-rule bg-rc-panel px-3 py-2 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:border-rc-brand focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={verifyBusy || !phoneInput}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-rc-brand py-2 text-sm font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
                    >
                      {verifyBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send code
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={codeInput}
                      onChange={(e) =>
                        setCodeInput(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="123456"
                      className="w-full rounded-lg border border-rc-rule bg-rc-panel px-3 py-2 text-center text-sm tracking-[0.3em] text-rc-ink placeholder:tracking-normal placeholder:text-rc-ink-mute focus:border-rc-brand focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setVerifyStep("enter-phone");
                          setCodeInput("");
                          setVerifyError(null);
                          setVerifyInfo(null);
                        }}
                        disabled={verifyBusy}
                        className="rounded-lg border border-rc-rule px-3 py-2 text-sm font-semibold text-rc-ink transition-colors hover:bg-rc-panel disabled:opacity-60"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmCode}
                        disabled={verifyBusy || codeInput.length < 4}
                        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-rc-brand py-2 text-sm font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-60"
                      >
                        {verifyBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                        Confirm
                      </button>
                    </div>
                  </>
                )}
                {verifyError && (
                  <div className="rounded-lg bg-rc-poor-bg px-3 py-2 text-[12px] text-rc-poor-ink">
                    {verifyError}
                  </div>
                )}
                {verifyInfo && (
                  <div className="rounded-lg bg-rc-brand-soft px-3 py-2 text-[12px] text-rc-brand">
                    {verifyInfo}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

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

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 pt-4 border-t border-rc-rule-soft">
          <div className="font-rc-mono text-[11px] text-rc-ink-mute uppercase tracking-[0.04em]">
            {isPaid ? "PRO" : "FREE TIER"} ·{" "}
            {usedCount != null ? usedCount : "—"} of {limit}{" "}
            {limit === 1 ? "alert" : "alerts"}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2.5 rounded-xl border border-rc-rule text-rc-ink text-sm font-semibold hover:bg-rc-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white text-sm font-semibold transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Clock className="w-4 h-4" />
              )}
              Create alert →
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      className={`shrink-0 inline-flex items-center w-10 h-6 rounded-full transition-colors ${
        on ? "bg-rc-brand" : "bg-rc-rule"
      }`}
    >
      <span
        className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[18px]" : "translate-x-0.5"
        }`}
      />
    </span>
  );
}

function shortName(name: string): string {
  return name.replace(/\s+(Salmon|Crab)$/i, "").replace(/^Pacific\s+/i, "");
}
