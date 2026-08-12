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

import { supabase } from "./supabase";
import type { FreshCatchesResponse } from "@/app/explore/lib/fresh-catch-types";
import type {
  StationConditions,
  BuoyConditions,
} from "./bluecaster/station-types";
import type {
  MapForecast14dPayload,
  MapSpotsPayload,
  OwnedCustomSpot,
  SpotCoord,
  SpotsOutlook14dPayload,
} from "./bluecaster";
export type { SpotsOutlook14dPayload } from "./bluecaster";
export type { SpotCoord } from "./bluecaster";
export type {
  StationConditions,
  BuoyConditions,
  BuoyObservation,
} from "./bluecaster/station-types";
import type {
  Forecast14dPayload,
  SpotPageInitial,
  SpotScorePayload,
  PointConditions,
} from "./bluecaster/live-spot-types";
import type { IntelEvidence, PoolIntelligence } from "./bluecaster/intel-types";
import type {
  CatchPreviewResponse,
  CatchPreviewExtras,
  NearestSpotsResponse,
  SpotSnapshotResponse,
  BlueCasterSpeciesItem,
  CreateCustomSpotResponse,
  PoolCommitPayload,
  PoolCommitResponse,
  SpotScoreHourResponse,
} from "./bluecaster/catch-ingest-types";

export type { CatchPreviewResponse } from "./bluecaster/catch-ingest-types";

export async function fetchForecast14d(
  spotSlug: string
): Promise<Forecast14dPayload> {
  // The proxy gates days past the caller's horizon server-side (anon 2,
  // free 7, Pro 14) — attach the session token so signed-in callers get
  // their full horizon.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(
    `/api/bluecaster/spots/${encodeURIComponent(spotSlug)}/forecast-14d`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
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

/** One sample of the predicted tidal-current series at a point. */
export type CurrentSample = {
  t: string; // ISO UTC
  speed_kn: number;
  dir_deg: number; // direction the current flows toward (0 = N)
  u: number; // eastward (kt)
  v: number; // northward (kt)
};

export type CurrentsPointPayload = {
  region: string;
  tier: string;
  source: string;
  count: number;
  series: CurrentSample[];
};

/** Predicted tidal-current series at a point over [from, to] (hourly steps). */
export async function fetchCurrentsPoint(
  lat: number,
  lng: number,
  fromIso: string,
  toIso: string,
): Promise<CurrentsPointPayload | null> {
  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    from: fromIso,
    to: toIso,
    step_min: "60",
  });
  const res = await fetch(`/api/bluecaster/currents/point?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as CurrentsPointPayload;
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
  extras?: CatchPreviewExtras,
): Promise<CatchPreviewResponse | null> {
  const form = new FormData();
  form.append("photo", file);
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value !== undefined && value !== null && value !== "") {
        form.append(key, String(value));
      }
    }
  }
  const res = await fetch("/api/bluecaster/ingest/catch/preview", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as CatchPreviewResponse;
}

// ── Catch wizard (2026-07) ──────────────────────────────────────────────

/** Nearest saved spot within radius_m of a pin + candidates + DFO area. */
export async function fetchNearestSpots(
  lat: number,
  lng: number,
  radiusM = 400,
): Promise<NearestSpotsResponse | null> {
  const qs = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius_m: String(radiusM),
  });
  const res = await fetch(`/api/bluecaster/spots/by-coordinates?${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as NearestSpotsResponse;
}

/** Historical-capable conditions snapshot for a spot at a UTC instant. */
export async function fetchSpotSnapshot(
  spotId: string,
  datetimeUtcIso: string,
): Promise<SpotSnapshotResponse | null> {
  const qs = new URLSearchParams({ datetime: datetimeUtcIso });
  const res = await fetch(
    `/api/bluecaster/fishing-spots/${encodeURIComponent(spotId)}/snapshot?${qs}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as SpotSnapshotResponse;
}

/** Full BlueCaster species list (species-picker fallback). Cached 1h. */
export async function fetchSpeciesList(): Promise<BlueCasterSpeciesItem[] | null> {
  const res = await fetch("/api/bluecaster/species");
  if (!res.ok) return null;
  const data = (await res.json()) as { species: BlueCasterSpeciesItem[] };
  return data.species ?? null;
}

/** Single-hour score at the catch time. Empty stocks → "—". */
export async function fetchSpotScoreHour(
  spotId: string,
  speciesId: string,
  datetimeUtcIso: string,
): Promise<SpotScoreHourResponse | null> {
  const qs = new URLSearchParams({ species: speciesId, datetime: datetimeUtcIso });
  const res = await fetch(
    `/api/bluecaster/fishing-spots/${encodeURIComponent(spotId)}/score-hour?${qs}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json()) as SpotScoreHourResponse;
}

export type CreateCustomSpotClientResult =
  | { ok: true; data: CreateCustomSpotResponse }
  | { ok: false; error: string; message?: string };

/** Create a custom spot (requires a signed-in session; Pro-only — free
 *  accounts get `pro_required`, coordinates outside covered waters get
 *  `outside_coverage`, both with a user-facing `message`). */
export async function createCustomSpot(
  input: {
    name: string;
    lat: number;
    lng: number;
    visibility?: "private" | "public";
    species_ids?: string[];
  },
  accessToken: string,
): Promise<CreateCustomSpotClientResult> {
  const res = await fetch("/api/bluecaster/fishing-spots/custom", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    return {
      ok: false,
      error: body?.error ?? "create_failed",
      message: body?.message,
    };
  }
  return { ok: true, data: (await res.json()) as CreateCustomSpotResponse };
}

export type { OwnedCustomSpot } from "./bluecaster";

/**
 * map/spots for the SIGNED-IN viewer — same payload as the anonymous server
 * render plus this angler's own custom spots, so they can be ranked in the rail
 * rather than floating on the map. Returns null signed out or on any error
 * (callers fall back to the anonymous set).
 */
/**
 * Coordinates for a list of saved slugs — the dashboard's first-paint read.
 *
 * Favourites are slugs in localStorage, available before anything has loaded;
 * this turns them into pins without waiting on the bulk map payload (~700 KB,
 * and on the personalized path several seconds). Scores still arrive from
 * map/spots and fill in behind it. Cacheable, no identity: safe to fire before
 * auth resolves.
 */
export async function fetchSpotCoords(
  slugs: string[],
): Promise<SpotCoord[]> {
  if (slugs.length === 0) return [];
  const res = await fetch(
    `/api/bluecaster/map/spot-coords?slugs=${encodeURIComponent(slugs.join(","))}`,
  );
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as { spots?: SpotCoord[] } | null;
  return body?.spots ?? [];
}

/**
 * map/spots for NO viewer — the anonymous, CDN-cacheable read.
 *
 * Identical payload and engine to the viewer variant minus the caller's own
 * custom spots, but because it carries no identity the proxy marks it
 * `public, max-age=300` and the edge can serve it: ~140ms on a hit against
 * ~3s for the personalized read, which is `private, no-store` and therefore
 * BYPASSes the cache on every load. Deliberately sends no Authorization
 * header — one would make the response per-user and uncacheable.
 */
export async function fetchMapSpotsCached(
  bbox: string,
  date: string,
): Promise<MapSpotsPayload | null> {
  const res = await fetch(
    `/api/bluecaster/map/spots?bbox=${encodeURIComponent(bbox)}&date=${encodeURIComponent(date)}`,
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MapSpotsPayload | null;
}

export async function fetchMapSpotsAsViewer(
  bbox: string,
  date: string,
): Promise<MapSpotsPayload | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return null;
  const res = await fetch(
    `/api/bluecaster/map/spots?bbox=${encodeURIComponent(bbox)}&date=${encodeURIComponent(date)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MapSpotsPayload | null;
}

/** Aggregate catch reports per spot, Pro-gated at the route.
 *
 *  Forwards the Supabase access token when there is one. `getUserIdFromRequest`
 *  reads `Authorization: Bearer`, NOT cookies, so a plain same-origin fetch
 *  authenticates as nobody — which silently served every Pro user the locked
 *  payload. Signed-out callers still fetch (they get the locked shape by
 *  design); the header is simply absent.
 *
 *  `spot` narrows the response to one spot id, for the spot page. */
export async function fetchFreshCatches(
  spotId?: string,
): Promise<FreshCatchesResponse | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const qs = spotId ? `?spot=${encodeURIComponent(spotId)}` : "";
  const res = await fetch(`/api/bluecaster/map/fresh-catches${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as FreshCatchesResponse | null;
}

/** The written report for one spot, for a paying angler.
 *
 *  Forwards the Supabase token for the same reason `fetchFreshCatches` does:
 *  the route reads `Authorization: Bearer`, not cookies, so a bare fetch
 *  authenticates as nobody and hands a Pro angler the locked teaser. That is
 *  exactly what shipped first time round.
 *
 *  Returns null when locked or on any failure, which leaves the teaser in
 *  place rather than blanking the block. */
export async function fetchSpotRecentReports(slug: string): Promise<unknown | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(
    `/api/bluecaster/spots/${encodeURIComponent(slug)}/recent-reports`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    },
  );
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as
    | { locked?: boolean; reports?: unknown }
    | null;
  if (!body || body.locked) return null;
  return body.reports ?? null;
}

/** Per-spot 14-day outlook for a whole list of cards in one request.
 *
 *  Scope it by explicit spot ids (the dashboard knows exactly which spots it
 *  is drawing) or by city slug. Days past the caller's plan come back null —
 *  the route does that gating, so the strip only ever draws what it may show.
 *
 *  Forwards the Supabase token for the same reason `fetchFreshCatches` does:
 *  the route reads `Authorization: Bearer`, not cookies, so a bare fetch would
 *  authenticate as nobody and quietly hand a Pro angler the 2-day payload. */
export async function fetchSpotsOutlook14d(
  scope: { spotIds?: string[]; citySlug?: string },
): Promise<SpotsOutlook14dPayload | null> {
  const qs = new URLSearchParams();
  if (scope.spotIds?.length) qs.set("spots", scope.spotIds.join(","));
  if (scope.citySlug) qs.set("city", scope.citySlug);
  if ([...qs.keys()].length === 0) return null;

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/bluecaster/map/spot-forecast-14d?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as SpotsOutlook14dPayload | null;
}

/** The signed-in user's own custom spots (private + public), for the "your
 *  spots" pins on the map. Owner-scoped — forwards the Supabase token. Returns
 *  [] when signed out or on any error. */
export async function fetchMyCustomSpots(): Promise<OwnedCustomSpot[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const userId = data.session?.user?.id;
  if (!token || !userId) return [];
  const res = await fetch(
    `/api/bluecaster/anglers/${encodeURIComponent(userId)}/spots`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) return [];
  const body = (await res.json().catch(() => null)) as
    | { spots?: OwnedCustomSpot[] }
    | null;
  return body?.spots ?? [];
}

/**
 * Fire-and-forget commit of a saved catch into BlueCaster's intelligence
 * pool. `idempotencyKey` = the catch row id (retries replay, not duplicate).
 */
export async function commitCatchToPool(
  payload: Omit<PoolCommitPayload, "angler_user_id">,
  photo: File | null,
  idempotencyKey: string,
  accessToken: string,
): Promise<PoolCommitResponse | null> {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  if (photo) form.append("photo", photo);
  const res = await fetch("/api/bluecaster/ingest/catch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "idempotency-key": idempotencyKey,
    },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as PoolCommitResponse;
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

// ── Map station/buoy click panels ───────────────────────────────────


/** Tide curve + next high/low for a clicked tide-station marker. */
export async function fetchStationConditions(
  source: "chs" | "noaa",
  sid: string,
): Promise<StationConditions | null> {
  const qs = new URLSearchParams({ source, sid });
  const res = await fetch(`/api/bluecaster/map/station-conditions?${qs}`);
  if (!res.ok) return null;
  return (await res.json()) as StationConditions;
}

/** Live NDBC observations for a clicked weather-buoy marker. */
export async function fetchBuoyConditions(
  sid: string,
): Promise<BuoyConditions | null> {
  const qs = new URLSearchParams({ sid });
  const res = await fetch(`/api/bluecaster/map/buoy-conditions?${qs}`);
  if (!res.ok) return null;
  return (await res.json()) as BuoyConditions;
}

/** Viewport 14-day forecast — per-day best across the spots in a bbox. */
export async function fetchMapForecast14d(
  bbox: string
): Promise<MapForecast14dPayload> {
  // The proxy gates days past the caller's horizon server-side (anon 2,
  // free 7, Pro 14) — attach the session token so signed-in callers get
  // their full horizon.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(
    `/api/bluecaster/map/forecast-14d?bbox=${encodeURIComponent(bbox)}`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }
  );
  if (!res.ok) {
    throw new Error(`map/forecast-14d API returned ${res.status}`);
  }
  return (await res.json()) as MapForecast14dPayload;
}
