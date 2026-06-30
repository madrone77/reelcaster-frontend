// Browser-side lazy fetcher for the live-spot 14-day extended grid.
//
// Runs in `LiveSpotPage` (client component) — triggered on first user
// interaction (scroll / pointer / key / touch) or after `requestIdleCallback`
// (~800 ms). By the time the user clicks a future-day tile in the picker,
// the payload is already in memory.
//
// Goes through a same-origin proxy at /api/bluecaster/spots/[slug]/forecast-14d
// so the BlueCaster API key stays server-only (matches every other BC call
// in this codebase). No `NEXT_PUBLIC_BLUECASTER_*` env var needed.

import type {
  Forecast14dPayload,
  SpotPageInitial,
  SpotScorePayload,
  PointConditions,
} from "./bluecaster/live-spot-types";
import type { IntelEvidence, PoolIntelligence } from "./bluecaster/intel-types";
import type { CatchPreviewResponse } from "./bluecaster/catch-ingest-types";

export type { CatchPreviewResponse } from "./bluecaster/catch-ingest-types";

export async function fetchForecast14d(
  spotSlug: string
): Promise<Forecast14dPayload> {
  const res = await fetch(
    `/api/bluecaster/spots/${encodeURIComponent(spotSlug)}/forecast-14d`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `forecast-14d API returned ${res.status} for ${spotSlug}: ${body}`
    );
  }
  return (await res.json()) as Forecast14dPayload;
}

// ── Explore drawer intel (lazy, client-side; null on any failure) ───────

/** Today-only live spot payload (catch signals, drivers, regs, season). */
export async function fetchSpotLive(
  spotSlug: string
): Promise<SpotPageInitial | null> {
  const res = await fetch(
    `/api/bluecaster/spots/${encodeURIComponent(spotSlug)}/spot-page`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return (await res.json()) as SpotPageInitial;
}

/** Per-hour factor breakdown for a spot×species (Score explained charts). */
export async function fetchSpotScore(
  spotId: string,
  speciesId: string,
  days = 1
): Promise<SpotScorePayload | null> {
  const qs = new URLSearchParams({ species: speciesId, days: String(days) });
  const res = await fetch(
    `/api/bluecaster/fishing-spots/${encodeURIComponent(spotId)}/score?${qs}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  return (await res.json()) as SpotScorePayload;
}

/** Extended now-conditions (pressure, minutes-to-slack, moon) for a point. */
export async function fetchPointConditions(
  lat: number,
  lng: number
): Promise<PointConditions | null> {
  const qs = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const res = await fetch(`/api/bluecaster/point-conditions?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PointConditions;
}

/**
 * Photo-first catch ingest preview — upload a catch photo and get back
 * AI species/lure/size + EXIF time/GPS + nearest-spot match + conditions
 * snapshot to pre-fill the Log-a-catch form. Returns null on any failure
 * (the form then falls back to manual entry).
 */
export async function fetchCatchPreview(
  file: File,
): Promise<CatchPreviewResponse | null> {
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch("/api/bluecaster/ingest/catch/preview", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as CatchPreviewResponse;
}

/** "Why this score" — evidence + confidence behind a spot×species score. */
export async function fetchIntelEvidence(
  spotId: string,
  speciesId: string
): Promise<IntelEvidence | null> {
  const qs = new URLSearchParams({
    fishing_spot_id: spotId,
    species_id: speciesId,
  });
  const res = await fetch(`/api/bluecaster/intel/evidence?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as IntelEvidence;
}

/** Anonymized community catch-rate aggregates for a spot×species. */
export async function fetchPoolIntelligence(
  spotId: string,
  speciesId: string,
  timeWindow: "season" | "month" | "week" = "season"
): Promise<PoolIntelligence | null> {
  const qs = new URLSearchParams({
    spot_id: spotId,
    species_id: speciesId,
    time_window: timeWindow,
  });
  const res = await fetch(`/api/bluecaster/pool/intelligence?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PoolIntelligence;
}
