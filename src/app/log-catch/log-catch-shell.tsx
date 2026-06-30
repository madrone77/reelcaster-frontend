"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Upload } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { useAuth } from "@/contexts/auth-context";
import { fetchCatchPreview } from "@/lib/bluecaster-client";
import type { CatchPreviewResponse } from "@/lib/bluecaster/catch-ingest-types";
import { SPECIES_OPTIONS } from "@/app/config/species";
import CatchForm, {
  type CatchFormSpot,
  type CatchConditions,
} from "./catch-form";

const TZ = "America/Vancouver";

/**
 * Standalone "Log a catch" page (desktop mockup). Drop a photo → BlueCaster
 * reads EXIF + runs vision to pre-fill species/size/spot/time/conditions →
 * the shared CatchForm lets the angler confirm and save to their catch log.
 */
export default function LogCatchShell() {
  const { user, loading } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CatchPreviewResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = async (f: File) => {
    setError(null);
    if (f.size > 25 * 1024 * 1024) {
      setError("Photo is over 25 MB — pick a smaller one.");
      return;
    }
    setFile(f);
    setAnalyzing(true);
    try {
      const result = await fetchCatchPreview(f);
      setPreview(result);
      if (!result) {
        // Vision unavailable — still let them log manually.
        setPreview({
          status: "ok",
          observed_at: null,
          observed_at_source: null,
          spot_match: null,
          spot_candidates: [],
          species_at_spot: [],
          exif: { captured_at: null, lat: null, lng: null, camera: null },
          vision: {
            species: null,
            species_id: null,
            lure: null,
            size_estimate_lb: null,
            lighting_window: null,
            no_fish_detected: false,
          },
          snapshot: null,
          needs_input: ["spot", "species"],
        });
      }
    } catch {
      setError("Couldn't analyze that photo — try again.");
      setFile(null);
    } finally {
      setAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
  };

  // Derive the form context once a preview is in.
  const formContext = preview ? buildFormContext(preview) : null;

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-14">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
          {!loading && !user ? (
            <SignedOut />
          ) : preview && formContext ? (
            formContext.spot ? (
              <div className="rounded-2xl border border-rc-rule bg-rc-panel p-6 shadow-rc-panel">
                <CatchForm
                  spot={formContext.spot}
                  conditions={formContext.conditions}
                  speciesOptions={SPECIES_OPTIONS}
                  initialSpeciesId={formContext.initialSpeciesId}
                  initialSizeText={formContext.initialSizeText}
                  initialPhotoFile={file}
                  caughtAtIso={formContext.caughtAtIso}
                  onClose={reset}
                />
              </div>
            ) : (
              <Rejected
                message={
                  preview.status === "rejected"
                    ? (preview.message ??
                      "We couldn't read that photo. Use an original camera/phone photo.")
                    : "We couldn't read a location from this photo. Try logging from a spot page instead."
                }
                onRetry={reset}
              />
            )
          ) : (
            <Dropzone
              analyzing={analyzing}
              dragOver={dragOver}
              error={error}
              fileRef={fileRef}
              onChoose={() => fileRef.current?.click()}
              onFile={onPick}
              setDragOver={setDragOver}
            />
          )}
        </div>
      </main>
    </div>
  );
}

// ── sub-views ────────────────────────────────────────────────────────

function Dropzone({
  analyzing,
  dragOver,
  error,
  fileRef,
  onChoose,
  onFile,
  setDragOver,
}: {
  analyzing: boolean;
  dragOver: boolean;
  error: string | null;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onChoose: () => void;
  onFile: (f: File) => void;
  setDragOver: (v: boolean) => void;
}) {
  return (
    <div className="text-center">
      <div className="rc-label text-[10px] text-rc-ink-mute">
        REELCASTER · CATCH LOG
      </div>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.02em] text-rc-ink">
        Log a catch
      </h1>
      <p className="mt-3 text-rc-ink-soft max-w-lg mx-auto">
        Drop one photo. We read EXIF and run vision to pull species, lure, size,
        location and time — then attach the tide / wind / temp snapshot. You
        just confirm.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`mt-8 rounded-2xl border-2 border-dashed py-16 px-6 transition-colors ${
          dragOver
            ? "border-rc-brand bg-rc-brand-soft/40"
            : "border-rc-rule bg-rc-panel"
        }`}
      >
        <div className="w-14 h-14 mx-auto rounded-full bg-rc-brand-soft flex items-center justify-center">
          {analyzing ? (
            <Loader2 className="w-6 h-6 text-rc-brand animate-spin" />
          ) : (
            <Upload className="w-6 h-6 text-rc-brand" />
          )}
        </div>
        <div className="mt-4 text-xl font-bold text-rc-ink">
          {analyzing ? "Reading your photo…" : "Drop a fishing photo"}
        </div>
        <div className="mt-1 font-rc-mono text-[12px] text-rc-ink-mute">
          JPG · PNG · HEIC · WebP — EXIF read for time &amp; location
        </div>
        {!analyzing && (
          <button
            type="button"
            onClick={onChoose}
            className="mt-5 px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
          >
            Choose photo
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2 inline-block">
          {error}
        </div>
      )}

      <div className="mt-10 text-left">
        <div className="rc-label text-[9px] text-rc-ink-mute">
          OR PICK FROM A RECENT UPLOAD
        </div>
        <div className="mt-3 flex gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-16 h-16 rounded-lg bg-rc-surface border border-rc-rule"
              aria-hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function Rejected({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-8 text-center">
      <div className="text-lg font-bold text-rc-ink">Hmm — couldn&apos;t use that one</div>
      <p className="mt-2 text-sm text-rc-ink-soft">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
      >
        Try another photo
      </button>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-8 text-center">
      <h1 className="text-2xl font-bold text-rc-ink">Log a catch</h1>
      <p className="mt-2 text-sm text-rc-ink-soft">
        Sign in to log catches to your private catch log.
      </p>
      <Link
        href="/login?next=/log-catch"
        className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────

function buildFormContext(p: CatchPreviewResponse): {
  spot: CatchFormSpot | null;
  conditions: CatchConditions | null;
  initialSpeciesId: string | null;
  initialSizeText: string;
  caughtAtIso: string | null;
} {
  const m = p.spot_match;
  const lat = m?.lat ?? p.exif.lat;
  const lng = m?.lng ?? p.exif.lng;
  const spot: CatchFormSpot | null =
    lat != null && lng != null
      ? {
          id: m?.id ?? null,
          name: m?.name ?? "Logged from photo",
          slug: null,
          lat,
          lng,
          region: null,
          distanceKm: m ? Math.round((m.distance_m / 1000) * 10) / 10 : null,
        }
      : null;

  const visName = p.vision.species?.name;
  const matched = visName
    ? SPECIES_OPTIONS.find((s) => s.name.toLowerCase() === visName.toLowerCase())
    : undefined;
  const lb = p.vision.size_estimate_lb;

  const observed = p.observed_at ? new Date(p.observed_at) : null;
  const capturedLabel = observed
    ? new Intl.DateTimeFormat("en-US", {
        timeZone: TZ,
        hour: "numeric",
        minute: "2-digit",
      }).format(observed)
    : null;

  const conditions: CatchConditions | null = p.snapshot
    ? {
        score: null,
        tidePhase: p.snapshot.tide_phase,
        windKt: p.snapshot.wind_kn,
        windDir: p.snapshot.wind_dir,
        waterTempC: p.snapshot.water_temp_c,
        airTempC: null,
        capturedLabel,
      }
    : capturedLabel
      ? { capturedLabel }
      : null;

  return {
    spot,
    conditions,
    initialSpeciesId: matched?.id ?? null,
    initialSizeText: lb ? `${Math.round(lb)} lb` : "",
    caughtAtIso: observed ? observed.toISOString() : null,
  };
}
