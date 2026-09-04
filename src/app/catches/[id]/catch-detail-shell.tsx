"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { PAGE_MEASURE, READING_MEASURE } from "@/app/components/layout/page-measure";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import {
  fetchNearestSpots,
  fetchSpotSnapshot,
  fetchSpotScoreHour,
  createCustomSpot,
  commitCatchToPool,
} from "@/lib/bluecaster-client";
import type {
  CatchSnapshot,
  NearestSpotHit,
} from "@/lib/bluecaster/catch-ingest-types";
import { getCatchPhotoSignedUrl } from "@/lib/catch-photo-upload";
import {
  catchSnapshotToV2,
  storedToCatchSnapshot,
  type CatchLogRow,
} from "@/lib/catch-log-types";
import { kgToLb, cmToIn, mToFt, lbToKg, inToCm, ftToM, round1 } from "@/lib/units";
import ReviewStep from "@/app/log-catch/steps/review-step";
import {
  applyOverrides,
  naiveToUtcIso,
  type SelectedSpot,
  type SpeciesChoice,
  type ScoreSnapshot,
  type SnapshotOverrides,
  type StatDraft,
} from "@/app/log-catch/wizard/types";

/**
 * Catch detail — the same screen as the wizard's final (review) step,
 * hydrated from a saved catch_logs row. Everything stays editable; saving
 * PUTs the row. A draft's primary button publishes it (status → logged +
 * fire-and-forget pool commit); a logged catch gets a single Save changes.
 */
export default function CatchDetailShell({ catchId }: { catchId: string }) {
  const { user, session, loading } = useAuth();
  const router = useRouter();

  const [row, setRow] = useState<CatchLogRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Editable state, mirroring the wizard's review step
  const [species, setSpecies] = useState<SpeciesChoice | null>(null);
  const [caughtAtNaive, setCaughtAtNaive] = useState<string | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [spot, setSpot] = useState<SelectedSpot | null>(null);
  const [match, setMatch] = useState<NearestSpotHit | null>(null);
  const [candidates, setCandidates] = useState<NearestSpotHit[]>([]);
  // Fully rendered management area, regulator included ("DFO 19-3",
  // "WDFW 9"). BlueCaster composes it; nothing here adds a prefix.
  const [mgmtAreaLabel, setMgmtAreaLabel] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
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
  // Only adopt a re-match into `spot` after the USER moved the pin — the
  // load-time match query must not silently rewrite the saved spot.
  const pinDirtyRef = useRef(false);

  const caughtAtUtcIso = useMemo(
    () => (caughtAtNaive ? naiveToUtcIso(caughtAtNaive) : null),
    [caughtAtNaive],
  );

  // ── Load + hydrate ───────────────────────────────────────────────────

  useEffect(() => {
    if (!session?.access_token) return;
    let alive = true;
    (async () => {
      const res = await fetch(`/api/catches?id=${encodeURIComponent(catchId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!alive) return;
      if (!res.ok) {
        setLoadError(res.status === 404 ? "Catch not found." : "Couldn't load this catch.");
        return;
      }
      const { catch: c } = (await res.json()) as { catch: CatchLogRow };
      setRow(c);

      const lat = Number(c.location_lat);
      const lng = Number(c.location_lng);
      setPin({ lat, lng });
      setCaughtAtNaive(utcToNaiveLocal(c.caught_at));
      if (c.species_name) {
        setSpecies({
          bcId: c.species_bc_id,
          slug: c.species_id,
          name: c.species_name,
          confidence: c.species_confidence !== null ? Number(c.species_confidence) : null,
        });
      }
      if (c.spot_id) {
        setSpot({
          id: c.spot_id,
          name: c.location_name ?? "Saved spot",
          slug: c.spot_slug,
          lat,
          lng,
          score: c.score !== null ? Math.round(Number(c.score)) : null,
          scoreStatus: c.score_status,
          distanceM: null,
          mgmtArea: c.mgmt_area,
        });
      }
      setSnapshot(storedToCatchSnapshot(c.weather_snapshot));
      setScoreSnapshot({
        score: c.score !== null ? Math.round(Number(c.score)) : null,
        status: c.score_status,
      });
      setStats({
        weightLb: c.weight_kg !== null ? String(round1(kgToLb(Number(c.weight_kg)))) : "",
        lengthIn: c.length_cm !== null ? String(round1(cmToIn(Number(c.length_cm)))) : "",
        lure: c.lure_name ?? "",
        depthFt: c.depth_m !== null ? String(Math.round(mToFt(Number(c.depth_m)))) : "",
        notes: c.notes ?? "",
      });
      if (c.photos?.[0]) {
        getCatchPhotoSignedUrl(c.photos[0]).then((url) => alive && setPhotoUrl(url));
      }
      // Populate the map's candidate pins + match card (display only —
      // pinDirtyRef gates adoption).
      runMatch(lat, lng, 0);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, catchId]);

  // ── Matching / snapshot / score (same behavior as the wizard) ────────

  const runMatch = useCallback((lat: number, lng: number, delay = 400) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const seq = ++matchSeqRef.current;
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const res = await fetchNearestSpots(lat, lng, 400);
      if (seq !== matchSeqRef.current) return;
      setSearching(false);
      if (!res) return;
      setMatch(res.match);
      setCandidates(res.candidates);
      // mgmt_label already carries the regulator ("WDFW 9"). subarea_label is
      // the bare number and is only a fallback for a BlueCaster deploy that
      // predates it; never prefix it here.
      setMgmtAreaLabel(
        res.dfo_area?.mgmt_label ?? res.dfo_area?.subarea_label ?? null,
      );
    }, delay);
  }, []);

  const handlePinMove = useCallback(
    (lat: number, lng: number) => {
      pinDirtyRef.current = true;
      setPin({ lat, lng });
      runMatch(lat, lng);
    },
    [runMatch],
  );

  const refreshSnapshot = useCallback(async (spotId: string, utcIso: string | null) => {
    if (!utcIso) return;
    setSnapshotLoading(true);
    const res = await fetchSpotSnapshot(spotId, utcIso);
    setSnapshot(res?.snapshot ?? null);
    setSnapshotLoading(false);
  }, []);

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

  const adoptSpot = useCallback(
    (hit: NearestSpotHit, mgmt: string | null) => {
      setSpot({
        id: hit.id,
        name: hit.name,
        slug: hit.slug,
        lat: hit.lat,
        lng: hit.lng,
        score: hit.score,
        scoreStatus: hit.score_status,
        distanceM: hit.distance_m,
        mgmtArea: mgmt,
      });
      setOverrides({});
      refreshSnapshot(hit.id, caughtAtUtcIso);
      refreshScore(hit.id, hit.score_status, species?.bcId ?? null, caughtAtUtcIso);
    },
    [caughtAtUtcIso, species, refreshSnapshot, refreshScore],
  );

  // Adopt re-matches only after a user pin move.
  useEffect(() => {
    if (!pinDirtyRef.current || searching) return;
    if (match && match.id !== spot?.id) {
      adoptSpot(match, mgmtAreaLabel);
    } else if (!match && spot) {
      setSpot(null);
      setScoreSnapshot({ score: null, status: "none" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, searching]);

  const handleSpeciesChange = useCallback(
    (choice: SpeciesChoice) => {
      setSpecies(choice);
      if (spot) refreshScore(spot.id, spot.scoreStatus, choice.bcId, caughtAtUtcIso);
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

  const handleCreateSpot = useCallback(
    async (name: string): Promise<string | null> => {
      if (!pin || !session?.access_token) return "You need to be signed in.";
      const res = await createCustomSpot(
        { name, lat: pin.lat, lng: pin.lng },
        session.access_token,
      );
      if (!res.ok) {
        trackEvent("Custom Spot Create Failed", {
          reason: res.error,
          surface: "catch-detail",
        });
        return res.message ?? "Couldn't create the spot. Try again.";
      }
      trackEvent("Custom Spot Created", {
        visibility: "private",
        species_count: 0,
        surface: "catch-detail",
      });
      const hit: NearestSpotHit = {
        id: res.data.spot.id,
        name: res.data.spot.name,
        slug: res.data.spot.slug,
        lat: res.data.spot.lat,
        lng: res.data.spot.lng,
        distance_m: 0,
        status: "approved",
        is_published: false,
        score: null,
        best_species_id: null,
        score_status: "pending",
      };
      pinDirtyRef.current = true;
      setMatch(hit);
      setCandidates((c) => [hit, ...c]);
      adoptSpot(
        hit,
        res.data.mgmt_area?.mgmt_label ??
          res.data.mgmt_area?.subarea_label ??
          mgmtAreaLabel,
      );
      return null;
    },
    [pin, session, adoptSpot, mgmtAreaLabel],
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

  // ── Save (PUT; publishing a draft also pool-commits) ─────────────────

  const handleSave = useCallback(
    async (target: "draft" | "logged") => {
      if (!row || !session?.access_token || !pin || !caughtAtUtcIso || saving) return;
      setSaving(target);
      try {
        const finalSnapshot = applyOverrides(snapshot, overrides);
        const weightLb = parseFloat(stats.weightLb);
        const lengthIn = parseFloat(stats.lengthIn);
        const depthFt = parseFloat(stats.depthFt);

        const res = await fetch("/api/catches", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            id: row.id,
            caught_at: caughtAtUtcIso,
            location_lat: pin.lat,
            location_lng: pin.lng,
            location_name: spot?.name ?? null,
            status: target,
            species_id: species?.slug ?? null,
            species_name: species?.name ?? null,
            species_bc_id: species?.bcId ?? null,
            species_confidence: species?.confidence ?? null,
            weight_kg: Number.isFinite(weightLb)
              ? Math.round(lbToKg(weightLb) * 100) / 100
              : null,
            length_cm: Number.isFinite(lengthIn)
              ? Math.round(inToCm(lengthIn) * 10) / 10
              : null,
            depth_m: Number.isFinite(depthFt)
              ? Math.round(ftToM(depthFt) * 10) / 10
              : null,
            lure_name: stats.lure.trim() || null,
            notes: stats.notes.trim() || null,
            weather_snapshot: finalSnapshot ? catchSnapshotToV2(finalSnapshot) : null,
            moon_phase: finalSnapshot?.moon_phase ?? null,
            spot_id: spot?.id ?? null,
            spot_slug: spot?.slug ?? null,
            mgmt_area: spot?.mgmtArea ?? mgmtAreaLabel,
            score: scoreSnapshot.status === "scored" ? scoreSnapshot.score : null,
            score_status: scoreSnapshot.status,
          }),
        });
        if (!res.ok) throw new Error(`save failed (${res.status})`);

        // Publishing a draft feeds the intelligence pool (photo omitted —
        // it's already in storage; the pool takes payload-only commits).
        if (
          target === "logged" &&
          row.status === "draft" &&
          !row.pool_observation_id &&
          spot &&
          species?.bcId
        ) {
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
            null,
            row.id,
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
                    id: row.id,
                    pool_observation_id: pool.observation_id,
                  }),
                }).catch(() => undefined);
              }
            })
            .catch(() => undefined);
        }

        trackEvent("Catch Edited", { catch_id: catchId, species: species?.slug });
        setSaved(true);
        setTimeout(() => router.push("/catches"), 800);
      } catch {
        setLoadError("Couldn't save your changes. Try again.");
        setSaving(null);
      }
    },
    [
      row,
      session,
      pin,
      caughtAtUtcIso,
      saving,
      snapshot,
      overrides,
      stats,
      species,
      spot,
      mgmtAreaLabel,
      scoreSnapshot,
      router,
      catchId,
    ],
  );

  // ── Render ───────────────────────────────────────────────────────────

  const isDraft = row?.status === "draft";

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className={`${PAGE_MEASURE} py-8`}>
          <div className={READING_MEASURE}>
            <Link
              href="/catches"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-rc-ink-soft hover:text-rc-ink transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Catch log
            </Link>
            {isDraft && (
              <span className="ml-3 rounded-sm bg-rc-ink-mute px-1.5 py-0.5 rc-label text-[8px] text-white align-middle">
                DRAFT
              </span>
            )}

            <div className="mt-4">
              {!loading && !user ? (
                <SignedOut catchId={catchId} />
              ) : saved ? (
                <SavedState />
              ) : loadError ? (
                <ErrorState message={loadError} />
              ) : !row || !pin ? (
                <div className="flex items-center justify-center py-24 text-rc-ink-mute">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                <ReviewStep
                  photoUrl={photoUrl}
                  fishDetected
                  species={species}
                  speciesAtSpot={[]}
                  caughtAtNaive={caughtAtNaive}
                  pin={pin}
                  spot={spot}
                  match={match}
                  candidates={candidates}
                  mgmtArea={mgmtAreaLabel}
                  searching={searching}
                  snapshot={snapshot}
                  snapshotLoading={snapshotLoading}
                  overrides={overrides}
                  scoreSnapshot={scoreSnapshot}
                  stats={stats}
                  saving={saving}
                  draftButton={isDraft}
                  saveLabel={isDraft ? "Save catch ✓" : "Save changes"}
                  onSpeciesChange={handleSpeciesChange}
                  onTimeChange={handleTimeChange}
                  onPinMove={handlePinMove}
                  onCreateSpot={handleCreateSpot}
                  onOverride={handleOverride}
                  onStatsChange={(patch) => setStats((s) => ({ ...s, ...patch }))}
                  onSave={handleSave}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function SavedState() {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-10 text-center">
      <div className="mx-auto flex w-12 h-12 items-center justify-center rounded-full bg-rc-good">
        <Check className="w-6 h-6 text-white" strokeWidth={3} />
      </div>
      <div className="mt-4 text-xl font-bold text-rc-ink">Saved</div>
      <p className="mt-1 text-sm text-rc-ink-soft">Back to your catches…</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-8 text-center">
      <div className="text-lg font-bold text-rc-ink">{message}</div>
      <Link
        href="/catches"
        className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
      >
        Back to catch log
      </Link>
    </div>
  );
}

function SignedOut({ catchId }: { catchId: string }) {
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-8 text-center">
      <h1 className="text-2xl font-bold text-rc-ink">Catch details</h1>
      <p className="mt-2 text-sm text-rc-ink-soft">Sign in to view this catch.</p>
      <Link
        href={`/login?next=/catches/${catchId}`}
        className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-rc-brand hover:bg-rc-brand-hover text-white font-semibold transition-colors"
      >
        Sign in
      </Link>
    </div>
  );
}

function utcToNaiveLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  );
}
