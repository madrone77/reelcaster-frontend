"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { useAuth } from "@/contexts/auth-context";
import {
  fetchCatchPreview,
  fetchNearestSpots,
  fetchSpotSnapshot,
  fetchSpotScoreHour,
  createCustomSpot,
  commitCatchToPool,
} from "@/lib/bluecaster-client";
import type {
  CatchPreviewResponse,
  CatchSnapshot,
  NearestSpotHit,
} from "@/lib/bluecaster/catch-ingest-types";
import { uploadCatchPhoto } from "@/lib/catch-photo-upload";
import { preparePhotoForAnalysis, type PreparedPhoto } from "@/lib/photo-prep";
import { resolveInitialPin, type PinSource } from "@/lib/geo-fallback";
import { getCurrentPosition, type GeoLocationError } from "@/lib/geolocation-service";
import { lbToKg, inToCm, ftToM } from "@/lib/units";
import { catchSnapshotToV2 } from "@/lib/catch-log-types";
import UploadStep from "./steps/upload-step";
import AnalyzingStep from "./steps/analyzing-step";
import LocationStep from "./steps/location-step";
import ReviewStep from "./steps/review-step";
import {
  applyOverrides,
  naiveToUtcIso,
  type WizardStep,
  type SelectedSpot,
  type SpeciesChoice,
  type ScoreSnapshot,
  type SnapshotOverrides,
  type StatDraft,
} from "./wizard/types";

/**
 * Photo-first catch wizard (2026-07 revamp):
 *   upload → analyzing (ONE BlueCaster preview call) → location picker
 *   (400 m spot matching on every pin move; create-a-spot fallback) →
 *   review (species/conditions/stats, all editable) → save (+ fire-and-
 *   forget commit into BlueCaster's intelligence pool).
 *
 * All data state lives here; the step components are presentational.
 */
export default function LogCatchShell() {
  const { user, session, loading } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<WizardStep>("upload");
  const [error, setError] = useState<string | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  // Photo
  const [prepared, setPrepared] = useState<PreparedPhoto | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const uploadPromiseRef = useRef<Promise<string | null> | null>(null);

  // Analysis
  const [preview, setPreview] = useState<CatchPreviewResponse | null>(null);
  const [previewDone, setPreviewDone] = useState(false);

  // Location
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinSource, setPinSource] = useState<PinSource>("default");
  const [resolvingPin, setResolvingPin] = useState(false);
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<NearestSpotHit | null>(null);
  const [candidates, setCandidates] = useState<NearestSpotHit[]>([]);
  const [dfoArea, setDfoArea] = useState<string | null>(null);
  const [spot, setSpot] = useState<SelectedSpot | null>(null);

  // Review
  const [species, setSpecies] = useState<SpeciesChoice | null>(null);
  const [caughtAtNaive, setCaughtAtNaive] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CatchSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [overrides, setOverrides] = useState<SnapshotOverrides>({});
  const [scoreSnapshot, setScoreSnapshot] = useState<ScoreSnapshot>({
    score: null,
    status: "none",
  });
  const [stats, setStats] = useState<StatDraft>({
    weightLb: "",
    lengthIn: "",
    lure: "",
    depthFt: "",
    notes: "",
  });
  const [saving, setSaving] = useState<"draft" | "logged" | null>(null);
  const [saved, setSaved] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchSeqRef = useRef(0);

  useEffect(
    () => () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    },
    [photoUrl],
  );

  const caughtAtUtcIso = useMemo(
    () => (caughtAtNaive ? naiveToUtcIso(caughtAtNaive) : null),
    [caughtAtNaive],
  );

  // ── Step 1 → 2: photo picked ─────────────────────────────────────────

  const handleFile = useCallback(
    async (f: File) => {
      setError(null);
      if (f.size > 25 * 1024 * 1024) {
        setError("Photo is over 25 MB — pick a smaller one.");
        return;
      }
      setStep("analyzing");
      setPreviewDone(false);
      setPhotoUrl(URL.createObjectURL(f));

      try {
        const prep = await preparePhotoForAnalysis(f);
        setPrepared(prep);

        // Storage upload runs in parallel with the analysis.
        if (user) {
          uploadPromiseRef.current = uploadCatchPhoto(prep.uploadFile, user.id).catch(
            () => null,
          );
        }

        const result = await fetchCatchPreview(prep.analysisFile, {
          exif_captured_at: prep.exif?.capturedAtNaive ?? null,
          exif_lat: prep.exif?.lat ?? null,
          exif_lng: prep.exif?.lng ?? null,
          camera: prep.exif?.camera ?? null,
          file_lastmod: prep.fileLastModNaive,
          tz_offset_minutes: prep.tzOffsetMinutes,
        });

        if (result && result.status === "rejected") {
          setRejection(
            result.rejection_reason === "no_fish_detected"
              ? "We couldn't spot a fish in that photo. Try a clearer shot of the catch."
              : (result.message ?? "We couldn't read that photo."),
          );
          return;
        }
        if (result && result.status === "duplicate") {
          setRejection(
            "This exact photo has already been logged. Every catch needs its own photo.",
          );
          return;
        }

        const p: CatchPreviewResponse =
          result ??
          ({
            status: "ok",
            observed_at: prep.exif?.capturedAtNaive ?? prep.fileLastModNaive,
            observed_at_source: prep.exif?.capturedAtNaive ? "exif" : "file_lastmod",
            spot_match: null,
            spot_candidates: [],
            species_at_spot: [],
            exif: {
              captured_at: prep.exif?.capturedAtNaive ?? null,
              lat: prep.exif?.lat ?? null,
              lng: prep.exif?.lng ?? null,
              camera: prep.exif?.camera ?? null,
            },
            vision: {
              species: null,
              species_id: null,
              species_slug: null,
              lure: null,
              size_estimate_lb: null,
              lighting_window: null,
              no_fish_detected: false,
            },
            snapshot: null,
            needs_input: ["location", "spot", "species"],
          } satisfies CatchPreviewResponse);

        setPreview(p);
        setCaughtAtNaive(p.observed_at ?? localNowNaive());
        if (p.vision.species) {
          setSpecies({
            bcId: p.vision.species_id,
            slug: p.vision.species_slug,
            name: p.vision.species.name,
            confidence: p.vision.species.confidence,
          });
        }
        if (p.vision.lure?.name) {
          setStats((s) => ({ ...s, lure: s.lure || p.vision.lure!.name }));
        }
        if (p.vision.size_estimate_lb) {
          setStats((s) => ({
            ...s,
            weightLb: s.weightLb || String(Math.round(p.vision.size_estimate_lb!)),
          }));
        }
        setPreviewDone(true);
      } catch {
        setError("Couldn't analyze that photo — try again.");
        setStep("upload");
      }
    },
    [user],
  );

  // ── Step 2 → 3: analysis finished ────────────────────────────────────

  const handleAnalyzeComplete = useCallback(async () => {
    setStep("location");
    setResolvingPin(true);
    const resolved = await resolveInitialPin(preview?.exif ?? null);
    setPin({ lat: resolved.lat, lng: resolved.lng });
    setPinSource(resolved.source);
    setResolvingPin(false);
    runMatch(resolved.lat, resolved.lng, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  // ── Nearest-spot matching (shared by location + review pin moves) ────

  const runMatch = useCallback((lat: number, lng: number, delay = 400) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++matchSeqRef.current;
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchNearestSpots(lat, lng, 400);
      if (seq !== matchSeqRef.current) return; // stale
      setSearching(false);
      if (!res) return;
      setMatch(res.match);
      setCandidates(res.candidates);
      setDfoArea(res.dfo_area?.subarea_label ?? null);
    }, delay);
  }, []);

  const handlePinMove = useCallback(
    (lat: number, lng: number) => {
      setPin({ lat, lng });
      runMatch(lat, lng);
    },
    [runMatch],
  );

  // Explicit opt-in from the map step — the one place the permission
  // popup is allowed to appear (user-initiated tap).
  const handleUseMyLocation = useCallback(async (): Promise<string | null> => {
    try {
      const pos = await getCurrentPosition();
      setPin({ lat: pos.latitude, lng: pos.longitude });
      setPinSource("geolocation");
      runMatch(pos.latitude, pos.longitude, 0);
      return null;
    } catch (err) {
      return (err as GeoLocationError).code === "PERMISSION_DENIED"
        ? "Location is blocked in your browser settings."
        : "Couldn't get your location — drag the pin instead.";
    }
  }, [runMatch]);

  // ── Snapshot + score refresh ─────────────────────────────────────────

  const refreshSnapshot = useCallback(
    async (spotId: string, utcIso: string | null) => {
      if (!utcIso) return;
      setSnapshotLoading(true);
      // The preview already computed the snapshot for the matched spot at
      // the photo time — reuse it instead of refetching.
      if (
        preview?.snapshot &&
        preview.spot_match?.id === spotId &&
        utcIso === (preview.observed_at ? naiveToUtcIso(preview.observed_at) : null)
      ) {
        setSnapshot(preview.snapshot);
        setSnapshotLoading(false);
        return;
      }
      const res = await fetchSpotSnapshot(spotId, utcIso);
      setSnapshot(res?.snapshot ?? null);
      setSnapshotLoading(false);
    },
    [preview],
  );

  const refreshScore = useCallback(
    async (
      spotId: string,
      spotScoreStatus: "scored" | "pending" | "none",
      speciesBcId: string | null,
      utcIso: string | null,
    ) => {
      if (spotScoreStatus === "pending") {
        setScoreSnapshot({ score: null, status: "pending" });
        return;
      }
      if (!speciesBcId || !utcIso) {
        setScoreSnapshot({ score: null, status: "none" });
        return;
      }
      const res = await fetchSpotScoreHour(spotId, speciesBcId, utcIso);
      const best = res?.stocks?.length
        ? Math.max(...res.stocks.map((s) => s.score))
        : null;
      setScoreSnapshot(
        best !== null
          ? { score: Math.round(best * 100), status: "scored" }
          : { score: null, status: "none" },
      );
    },
    [],
  );

  // ── Step 3 → 4: spot chosen ──────────────────────────────────────────

  const adoptSpot = useCallback(
    (hit: NearestSpotHit, mgmt: string | null) => {
      const selected: SelectedSpot = {
        id: hit.id,
        name: hit.name,
        slug: hit.slug,
        lat: hit.lat,
        lng: hit.lng,
        score: hit.score,
        scoreStatus: hit.score_status,
        distanceM: hit.distance_m,
        mgmtArea: mgmt ? `DFO ${mgmt}` : null,
      };
      setSpot(selected);
      setOverrides({});
      refreshSnapshot(hit.id, caughtAtUtcIso);
      refreshScore(hit.id, hit.score_status, species?.bcId ?? null, caughtAtUtcIso);
      return selected;
    },
    [caughtAtUtcIso, species, refreshSnapshot, refreshScore],
  );

  const handleUseSpot = useCallback(
    (hit: NearestSpotHit) => {
      adoptSpot(hit, dfoArea);
      setStep("review");
    },
    [adoptSpot, dfoArea],
  );

  const handleCreateSpot = useCallback(
    async (name: string): Promise<string | null> => {
      if (!pin || !session?.access_token) return "You need to be signed in.";
      const res = await createCustomSpot(
        { name, lat: pin.lat, lng: pin.lng },
        session.access_token,
      );
      if (!res) return "Couldn't create the spot — try again.";
      const hit: NearestSpotHit = {
        id: res.spot.id,
        name: res.spot.name,
        slug: res.spot.slug,
        lat: res.spot.lat,
        lng: res.spot.lng,
        distance_m: 0,
        status: "approved",
        is_published: false,
        score: null,
        best_species_id: null,
        score_status: "pending",
      };
      setMatch(hit);
      setCandidates((c) => [hit, ...c]);
      adoptSpot(hit, res.mgmt_area?.subarea_label ?? dfoArea);
      setStep("review");
      return null;
    },
    [pin, session, adoptSpot, dfoArea],
  );

  // ── Review-screen edits ──────────────────────────────────────────────

  // Pin dragged on the review map: re-match; adopt the new match (or clear
  // the spot when the pin lands in unmapped water).
  useEffect(() => {
    if (step !== "review" || searching) return;
    if (match && match.id !== spot?.id) {
      adoptSpot(match, dfoArea);
    } else if (!match && spot) {
      setSpot(null);
      setSnapshot(null);
      setScoreSnapshot({ score: null, status: "none" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, searching, step]);

  const handleSpeciesChange = useCallback(
    (choice: SpeciesChoice) => {
      setSpecies(choice);
      if (spot) {
        refreshScore(spot.id, spot.scoreStatus, choice.bcId, caughtAtUtcIso);
      }
    },
    [spot, caughtAtUtcIso, refreshScore],
  );

  const handleTimeChange = useCallback(
    (naive: string) => {
      setCaughtAtNaive(naive);
      const utc = naiveToUtcIso(naive);
      if (spot && utc) {
        refreshSnapshot(spot.id, utc);
        refreshScore(spot.id, spot.scoreStatus, species?.bcId ?? null, utc);
      }
    },
    [spot, species, refreshSnapshot, refreshScore],
  );

  const handleOverride = useCallback(
    (key: keyof SnapshotOverrides, value: number | undefined) => {
      setOverrides((o) => {
        const next = { ...o };
        if (value === undefined) delete next[key];
        else next[key] = value;
        return next;
      });
    },
    [],
  );

  // ── Save ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(
    async (status: "draft" | "logged") => {
      if (!session?.access_token || !pin || !caughtAtUtcIso || saving) return;
      setSaving(status);
      try {
        const photoPath = (await uploadPromiseRef.current) ?? null;
        const finalSnapshot = applyOverrides(snapshot, overrides);

        const weightLb = parseFloat(stats.weightLb);
        const lengthIn = parseFloat(stats.lengthIn);
        const depthFt = parseFloat(stats.depthFt);

        const res = await fetch("/api/catches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            caught_at: caughtAtUtcIso,
            location_lat: pin.lat,
            location_lng: pin.lng,
            location_name: spot?.name ?? null,
            outcome: "landed",
            status,
            species_id: species?.slug ?? null,
            species_name: species?.name ?? null,
            species_bc_id: species?.bcId ?? null,
            species_confidence: species?.confidence ?? null,
            weight_kg: Number.isFinite(weightLb)
              ? Math.round(lbToKg(weightLb) * 100) / 100
              : undefined,
            length_cm: Number.isFinite(lengthIn)
              ? Math.round(inToCm(lengthIn) * 10) / 10
              : undefined,
            depth_m: Number.isFinite(depthFt)
              ? Math.round(ftToM(depthFt) * 10) / 10
              : undefined,
            lure_name: stats.lure.trim() || undefined,
            notes: stats.notes.trim() || undefined,
            photos: photoPath ? [photoPath] : [],
            weather_snapshot: finalSnapshot ? catchSnapshotToV2(finalSnapshot) : null,
            moon_phase: finalSnapshot?.moon_phase ?? undefined,
            spot_id: spot?.id ?? undefined,
            spot_slug: spot?.slug ?? undefined,
            mgmt_area: spot?.mgmtArea ?? (dfoArea ? `DFO ${dfoArea}` : undefined),
            score: scoreSnapshot.status === "scored" ? scoreSnapshot.score : undefined,
            score_status: scoreSnapshot.status,
          }),
        });
        if (!res.ok) throw new Error(`save failed (${res.status})`);
        const { catch: saved } = (await res.json()) as { catch: { id: string } };

        // Intelligence-pool commit — logged catches only, never blocking.
        if (status === "logged" && spot && species?.bcId && prepared) {
          const token = session.access_token;
          commitCatchToPool(
            {
              spot_id: spot.id,
              species_id: species.bcId,
              observed_at: caughtAtUtcIso,
              time_input_kind: "exact",
              location_input_kind: "exact_gps",
              lat: pin.lat,
              lng: pin.lng,
              lure: stats.lure.trim() || undefined,
              depth_m: Number.isFinite(depthFt)
                ? Math.round(ftToM(depthFt) * 10) / 10
                : undefined,
              notes: stats.notes.trim() || undefined,
              fish: [
                {
                  count: 1,
                  is_anchor: true,
                  ...(Number.isFinite(weightLb)
                    ? { weight_kg: Math.round(lbToKg(weightLb) * 100) / 100 }
                    : null),
                  ...(Number.isFinite(lengthIn)
                    ? { length_cm: Math.round(inToCm(lengthIn) * 10) / 10 }
                    : null),
                },
              ],
              contributes_to_pool: true,
              gps_stays_private: true,
            },
            prepared.uploadFile,
            saved.id,
            token,
          )
            .then((pool) => {
              if (pool?.observation_id) {
                fetch("/api/catches", {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    id: saved.id,
                    pool_observation_id: pool.observation_id,
                  }),
                }).catch(() => undefined);
              }
            })
            .catch(() => undefined);
        }

        setSaved(true);
        setTimeout(() => router.push("/catches"), 900);
      } catch {
        setError("Couldn't save your catch — try again.");
        setSaving(null);
      }
    },
    [
      session,
      pin,
      caughtAtUtcIso,
      saving,
      snapshot,
      overrides,
      stats,
      species,
      spot,
      dfoArea,
      scoreSnapshot,
      prepared,
      router,
    ],
  );

  const resetAll = useCallback(() => {
    setStep("upload");
    setError(null);
    setRejection(null);
    setPrepared(null);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    uploadPromiseRef.current = null;
    setPreview(null);
    setPreviewDone(false);
    setPin(null);
    setMatch(null);
    setCandidates([]);
    setSpot(null);
    setSpecies(null);
    setCaughtAtNaive(null);
    setSnapshot(null);
    setOverrides({});
    setScoreSnapshot({ score: null, status: "none" });
    setStats({ weightLb: "", lengthIn: "", lure: "", depthFt: "", notes: "" });
    setSaving(null);
    setSaved(false);
  }, [photoUrl]);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-14">
        <div
          className={`mx-auto px-4 sm:px-6 ${
            step === "review"
              ? "max-w-3xl py-10"
              : step === "location"
                ? "max-w-5xl py-6"
                : "max-w-2xl py-10"
          }`}
        >
          {!loading && !user ? (
            <SignedOut />
          ) : saved ? (
            <SavedState />
          ) : rejection ? (
            <Rejected message={rejection} onRetry={resetAll} />
          ) : step === "upload" ? (
            <UploadStep onFile={handleFile} error={error} />
          ) : step === "analyzing" ? (
            <AnalyzingStep
              photoUrl={photoUrl}
              done={previewDone}
              onComplete={handleAnalyzeComplete}
            />
          ) : step === "location" ? (
            <LocationStep
              pin={pin}
              pinSource={pinSource}
              resolving={resolvingPin}
              searching={searching}
              match={match}
              candidates={candidates}
              mgmtArea={dfoArea}
              onPinMove={handlePinMove}
              onUseMyLocation={handleUseMyLocation}
              onUseSpot={handleUseSpot}
              onCreateSpot={handleCreateSpot}
            />
          ) : pin ? (
            <ReviewStep
              photoUrl={photoUrl}
              fishDetected={!preview?.vision.no_fish_detected}
              species={species}
              speciesAtSpot={
                spot && preview?.spot_match?.id === spot.id
                  ? (preview?.species_at_spot ?? [])
                  : []
              }
              caughtAtNaive={caughtAtNaive}
              pin={pin}
              spot={spot}
              match={match}
              candidates={candidates}
              mgmtArea={dfoArea}
              searching={searching}
              snapshot={snapshot}
              snapshotLoading={snapshotLoading}
              overrides={overrides}
              scoreSnapshot={scoreSnapshot}
              stats={stats}
              saving={saving}
              onChangePhoto={resetAll}
              onSpeciesChange={handleSpeciesChange}
              onTimeChange={handleTimeChange}
              onPinMove={handlePinMove}
              onCreateSpot={handleCreateSpot}
              onOverride={handleOverride}
              onStatsChange={(patch) => setStats((s) => ({ ...s, ...patch }))}
              onSave={handleSave}
            />
          ) : null}

          {error && step !== "upload" && !saved && (
            <div className="mt-4 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-sm px-3 py-2">
              {error}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── sub-views ────────────────────────────────────────────────────────

function SavedState() {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-10 text-center">
      <div className="mx-auto flex w-12 h-12 items-center justify-center rounded-full bg-emerald-500">
        <Check className="w-6 h-6 text-white" strokeWidth={3} />
      </div>
      <div className="mt-4 text-xl font-bold text-rc-ink">Catch saved</div>
      <p className="mt-1 text-sm text-rc-ink-soft">Taking you to your catches…</p>
    </div>
  );
}

function Rejected({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-8 text-center">
      <div className="text-lg font-bold text-rc-ink">
        Hmm — couldn&apos;t use that one
      </div>
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

function localNowNaive(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
