"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ImagePlus, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { uploadCatchPhoto, getCatchPhotoSignedUrl } from "@/lib/catch-photo-upload";
import { fetchCatchPreview } from "@/lib/bluecaster-client";

/** A spot to log against (from the spot page or BlueCaster preview match). */
export interface CatchFormSpot {
  id?: string | null;
  name: string;
  slug?: string | null;
  lat: number;
  lng: number;
  /** e.g. "Juan de Fuca" — shown under the name. */
  region?: string | null;
  /** km from the photo's EXIF GPS, when known (standalone flow). */
  distanceKm?: number | null;
}

/** Conditions captured at log time, rendered in the auto-captured card + persisted. */
export interface CatchConditions {
  score?: number | null;
  tidePhase?: string | null;
  windKt?: number | null;
  windDir?: string | null;
  waterTempC?: number | null;
  airTempC?: number | null;
  /** Display time, e.g. "2:34 PM". */
  capturedLabel?: string | null;
}

export interface SpeciesOption {
  id: string;
  name: string;
}

interface CatchFormProps {
  spot: CatchFormSpot;
  conditions?: CatchConditions | null;
  speciesOptions: SpeciesOption[];
  initialSpeciesId?: string | null;
  initialSizeText?: string;
  /** A photo already chosen upstream (the standalone dropzone). */
  initialPhotoFile?: File | null;
  /** ISO time of the catch; defaults to now. */
  caughtAtIso?: string | null;
  /** Link target for "Back to {spot}" on the success screen. */
  spotHref?: string;
  /** Called by "Back to {spot}" when no spotHref (e.g. dialog close). */
  onClose?: () => void;
}

interface SavedCatch {
  speciesName: string | null;
  sizeText: string;
  spotName: string;
  timeLabel: string | null;
  photoUrl: string | null;
}

const MAX_BYTES = 25 * 1024 * 1024;

export default function CatchForm({
  spot,
  conditions,
  speciesOptions,
  initialSpeciesId = null,
  initialSizeText = "",
  initialPhotoFile = null,
  caughtAtIso = null,
  spotHref,
  onClose,
}: CatchFormProps) {
  const { user, session } = useAuth();

  const [speciesId, setSpeciesId] = useState<string | null>(initialSpeciesId);
  const [sizeText, setSizeText] = useState(initialSizeText);
  const [notes, setNotes] = useState("");

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiHint, setAiHint] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedCatch | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const firstName = displayFirstName(user?.email, user?.user_metadata);

  // Handle a selected photo: upload to Storage + run BlueCaster vision preview
  // to pre-fill species/size (best-effort; never blocks).
  const handlePhoto = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError("Photo is over 25 MB — pick a smaller one.");
        return;
      }
      if (!user?.id) {
        setError("Please sign in again to upload.");
        return;
      }
      setPhotoFile(file);
      setUploading(true);
      try {
        const [path, preview] = await Promise.all([
          uploadCatchPhoto(file, user.id),
          fetchCatchPreview(file).catch(() => null),
        ]);
        setPhotoPath(path);

        if (preview && preview.status === "ok") {
          const visName = preview.vision.species?.name;
          if (visName) {
            const match = speciesOptions.find(
              (s) => s.name.toLowerCase() === visName.toLowerCase(),
            );
            setSpeciesId((cur) => cur ?? match?.id ?? cur);
            const pct = Math.round((preview.vision.species?.confidence ?? 0) * 100);
            setAiHint(`Looks like ${visName}${pct ? ` (${pct}%)` : ""}`);
          }
          const lb = preview.vision.size_estimate_lb;
          if (lb) setSizeText((cur) => cur || `${Math.round(lb)} lb`);
        }
      } catch {
        setError("Couldn't upload that photo — try again.");
        setPhotoFile(null);
      } finally {
        setUploading(false);
      }
    },
    [user, speciesOptions],
  );

  // A photo handed in from the dropzone was already run through the vision
  // preview at the page level (to discover the spot), so just upload it here —
  // don't pay for a second preview call.
  useEffect(() => {
    if (!initialPhotoFile || !user?.id) return;
    setPhotoFile(initialPhotoFile);
    setUploading(true);
    uploadCatchPhoto(initialPhotoFile, user.id)
      .then((path) => setPhotoPath(path))
      .catch(() => setError("Couldn't upload that photo — try again."))
      .finally(() => setUploading(false));
  }, [initialPhotoFile, user?.id]);

  const removePhoto = async () => {
    setAiHint(null);
    setPhotoFile(null);
    const path = photoPath;
    setPhotoPath(null);
    if (path) {
      const { supabase } = await import("@/lib/supabase");
      await supabase.storage.from("catch-photos").remove([path]).catch(() => {});
    }
  };

  const handleSave = async () => {
    if (!speciesId || !session?.access_token) return;
    setSaving(true);
    setError(null);
    const species = speciesOptions.find((s) => s.id === speciesId) ?? null;
    const { weightKg, lengthCm } = parseSize(sizeText);
    const caughtAt = caughtAtIso ?? new Date().toISOString();

    try {
      const res = await fetch("/api/catches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          caught_at: caughtAt,
          location_lat: spot.lat,
          location_lng: spot.lng,
          location_name: spot.name,
          outcome: "landed",
          species_id: species?.id ?? null,
          species_name: species?.name ?? null,
          length_cm: lengthCm ?? undefined,
          weight_kg: weightKg ?? undefined,
          notes: notes.trim() || undefined,
          photos: photoPath ? [photoPath] : [],
          weather_snapshot: conditions ? snapshotJson(conditions) : undefined,
          client_id: crypto.randomUUID(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Couldn't save your catch.");
        setSaving(false);
        return;
      }
      const photoUrl = photoPath ? await getCatchPhotoSignedUrl(photoPath) : null;
      setSaved({
        speciesName: species?.name ?? null,
        sizeText: sizeText.trim(),
        spotName: spot.name,
        timeLabel: conditions?.capturedLabel ?? null,
        photoUrl,
      });
    } catch {
      setError("Couldn't save your catch.");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSpeciesId(null);
    setSizeText("");
    setNotes("");
    setPhotoFile(null);
    setPhotoPath(null);
    setAiHint(null);
    setError(null);
    setSaved(null);
  };

  // ── Success screen ────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div className="rc-label text-[10px] text-rc-good">CATCH SAVED</div>
        <div className="mt-4 w-16 h-16 rounded-full bg-rc-good-bg flex items-center justify-center">
          <Check className="w-8 h-8 text-rc-good" />
        </div>
        <div className="mt-4 text-3xl font-bold text-rc-ink">Nice one,</div>
        <div className="text-3xl font-bold text-rc-brand">{firstName}.</div>

        <div className="mt-6 w-full rounded-xl border border-rc-rule bg-rc-panel p-3 flex items-center gap-3 text-left">
          <div className="shrink-0 w-12 h-12 rounded-lg bg-rc-surface overflow-hidden">
            {saved.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={saved.photoUrl}
                alt={saved.speciesName ?? "catch"}
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="rc-label text-[9px] text-rc-brand">
              {(saved.speciesName ?? "Catch").toUpperCase()}
            </div>
            {saved.sizeText && (
              <div className="text-lg font-bold text-rc-ink leading-tight">
                {saved.sizeText}
              </div>
            )}
            <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
              {saved.spotName}
              {saved.timeLabel ? ` · ${saved.timeLabel}` : ""}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={resetForm}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
        >
          Log another catch
        </button>
        {spotHref ? (
          <Link
            href={spotHref}
            className="mt-2 w-full px-4 py-3 rounded-xl text-rc-ink font-semibold hover:bg-rc-surface transition-colors"
          >
            Back to {saved.spotName}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-2 w-full px-4 py-3 rounded-xl text-rc-ink font-semibold hover:bg-rc-surface transition-colors"
          >
            Back to {saved.spotName}
          </button>
        )}
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────
  const conditionLine = conditions ? buildConditionLine(conditions) : null;

  return (
    <div>
      <div className="rc-label text-[10px] text-rc-ink-mute">LOG A CATCH</div>
      <h2 className="mt-1 text-3xl font-bold tracking-[-0.02em] text-rc-ink">
        What did you land?
      </h2>

      {/* Auto-captured spot + conditions */}
      <div className="mt-5">
        <div className="rc-label text-[9px] text-rc-ink-mute">
          SPOT · AUTO-CAPTURED
        </div>
        <div className="mt-1.5 rounded-xl border border-rc-brand/40 bg-rc-brand-soft px-4 py-3">
          <div className="font-bold text-rc-ink">
            {spot.name}
            {conditions?.capturedLabel ? ` · ${conditions.capturedLabel}` : ""}
          </div>
          <div className="font-rc-mono text-[11px] text-rc-ink-soft mt-0.5">
            {(conditionLine ??
              [spot.region, spot.distanceKm != null ? `${spot.distanceKm.toFixed(1)} km` : null]
                .filter(Boolean)
                .join(" · ")) ||
              "Conditions captured"}
          </div>
        </div>
      </div>

      {/* Species */}
      <div className="mt-5">
        <div className="rc-label text-[9px] text-rc-ink-mute">SPECIES</div>
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
                {shortSpecies(s.name)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Size */}
      <div className="mt-5">
        <div className="rc-label text-[9px] text-rc-ink-mute">SIZE</div>
        <input
          type="text"
          value={sizeText}
          onChange={(e) => setSizeText(e.target.value)}
          placeholder="Weight · length (optional)"
          className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 text-rc-ink placeholder:text-rc-ink-mute outline-none focus:border-rc-brand transition-colors"
        />
      </div>

      {/* Photo */}
      <div className="mt-5">
        <div className="rc-label text-[9px] text-rc-ink-mute">PHOTO</div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhoto(f);
            e.target.value = "";
          }}
        />
        {photoFile ? (
          <div className="mt-2 rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 flex items-center gap-3">
            <div className="shrink-0 w-9 h-9 rounded-md bg-rc-brand-soft flex items-center justify-center">
              {uploading ? (
                <Loader2 className="w-4 h-4 text-rc-brand animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4 text-rc-brand" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-rc-ink truncate">
                {photoFile.name}
              </div>
              {aiHint && (
                <div className="flex items-center gap-1 font-rc-mono text-[11px] text-rc-brand mt-0.5">
                  <Sparkles className="w-3 h-3" /> {aiHint}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={removePhoto}
              className="shrink-0 font-rc-mono text-sm font-semibold text-rc-poor hover:underline"
            >
              Remove
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mt-2 w-full rounded-xl border border-dashed border-rc-rule bg-rc-surface py-5 text-rc-ink-mute hover:border-rc-brand hover:text-rc-brand transition-colors flex items-center justify-center gap-2"
          >
            <ImagePlus className="w-4 h-4" /> Tap to add
          </button>
        )}
      </div>

      {/* Notes */}
      <div className="mt-5">
        <div className="rc-label text-[9px] text-rc-ink-mute">NOTES · OPTIONAL</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes"
          rows={2}
          className="mt-2 w-full rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 text-rc-ink placeholder:text-rc-ink-mute outline-none focus:border-rc-brand transition-colors resize-none"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={!speciesId || saving || uploading}
        className="mt-6 w-full px-4 py-3.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors disabled:bg-rc-rule disabled:text-rc-ink-mute disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Save Catch
      </button>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

/** Short pill label, e.g. "Chinook Salmon" → "Chinook". */
function shortSpecies(name: string): string {
  return name.replace(/\s+(Salmon|Crab)$/i, "").replace(/^Pacific\s+/i, "");
}

function displayFirstName(
  email?: string | null,
  metadata?: Record<string, unknown> | undefined,
): string {
  const full = (metadata?.full_name ?? metadata?.name) as string | undefined;
  const raw = full?.trim().split(/\s+/)[0] || email?.split("@")[0] || "angler";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function parseSize(text: string): {
  weightKg: number | null;
  lengthCm: number | null;
} {
  let weightKg: number | null = null;
  let lengthCm: number | null = null;
  const kg = text.match(/(\d+(?:\.\d+)?)\s*kg/i);
  const lb = text.match(/(\d+(?:\.\d+)?)\s*(?:lbs?|#)/i);
  if (kg) weightKg = parseFloat(kg[1]);
  else if (lb) weightKg = parseFloat(lb[1]) * 0.453592;
  const cm = text.match(/(\d+(?:\.\d+)?)\s*cm/i);
  const inch = text.match(/(\d+(?:\.\d+)?)\s*(?:in\b|inch|inches|")/i);
  if (cm) lengthCm = parseFloat(cm[1]);
  else if (inch) lengthCm = parseFloat(inch[1]) * 2.54;
  const clamp = (n: number | null) =>
    n == null ? null : Math.min(500, Math.max(0, Math.round(n * 10) / 10));
  return { weightKg: clamp(weightKg), lengthCm: clamp(lengthCm) };
}

function buildConditionLine(c: CatchConditions): string | null {
  const parts: string[] = [];
  if (c.score != null) parts.push(`Score ${Math.round(c.score)}`);
  const tide = [c.tidePhase, c.windDir].filter(Boolean).join(" ");
  if (tide) parts.push(tide);
  if (c.windKt != null)
    parts.push(`${Math.round(c.windKt)} kt${c.windDir ? ` ${c.windDir}` : ""}`);
  if (c.waterTempC != null) parts.push(`${c.waterTempC.toFixed(1)}°C`);
  return parts.length ? parts.join(" · ") : null;
}

function snapshotJson(c: CatchConditions): Record<string, unknown> {
  return {
    rc_score: c.score ?? null,
    tide_phase: c.tidePhase ?? null,
    wind_kt: c.windKt ?? null,
    wind_dir: c.windDir ?? null,
    water_temp_c: c.waterTempC ?? null,
    air_temp_c: c.airTempC ?? null,
  };
}
