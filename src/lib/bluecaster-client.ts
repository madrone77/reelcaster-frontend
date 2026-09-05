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
  ScorableSpeciesResponse,
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
/** The species the create-spot picker should offer for this pin.
 *
 *  Scoped to the city the spot will file under, not to what happens to be in
 *  the map viewport. Returns null on any failure so the caller can fall back
 *  rather than block the create. */
export async function fetchScorableSpecies(
  lat: number,
  lng: number,
): Promise<ScorableSpeciesResponse | null> {
  try {
    const res = await fetch(
      `/api/bluecaster/species/scorable?lat=${lat}&lng=${lng}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as ScorableSpeciesResponse;
  } catch {
    return null;
  }
}

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
    // The rail and the pins can fill in a moment late; the forecast strip
    // cannot, and this is the request it would otherwise be stuck behind.
    { priority: "low" },
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MapSpotsPayload | null;
}

/**
 * map/spots for a KNOWN set of spot ids — the read for a surface that already
 * has its list, rather than a viewport it is panning.
 *
 * The dashboard is the case this exists for. It used to scope by the whole
 * covered extent, because asking by id was not something the API could do:
 * 152 spots and 142 KB gzipped to render an angler's ~6 saved ones, and a
 * second identical fetch on the personalized path on top. Scoped by id the
 * same six are 9 KB, and the one request covers both — a signed-in caller's
 * own custom spots ride along, narrowed upstream to the ids asked for.
 *
 * Sends the access token when there is one, so owned custom spots (which are
 * not published, and so invisible to an anonymous read) come back. That makes
 * the response `private, no-store`, which is fine at this size: the id list is
 * per-angler anyway, so a shared cache entry was never going to be hit.
 */
export async function fetchMapSpotsForIds(
  spotIds: string[],
  date: string,
): Promise<MapSpotsPayload | null> {
  if (spotIds.length === 0) return null;
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const qs = new URLSearchParams({ spots: spotIds.join(","), date });
  const res = await fetch(`/api/bluecaster/map/spots?${qs}`, {
    ...(token ? { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" as const } : {}),
    priority: "low",
  });
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
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      priority: "low",
    },
  );
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MapSpotsPayload | null;
}

/**
 * Shared read of the scraped catch reports, deduped per (spot, token) window.
 *
 * Every page that shows the reports badge fires this from an effect keyed on
 * the viewer's identity, because the first pass usually runs before Supabase
 * has rehydrated and a Pro angler would otherwise hold the locked payload for
 * the rest of the visit. That key changes from "no session" to "session" on
 * essentially every signed-in load, so the effect ran twice and sent two
 * identical requests about 2 ms apart. Measured on the dashboard, and the same
 * on Explore and the city pages, which key on `userId`.
 *
 * Re-running the effect is correct. Sending the request twice is not, so the
 * dedup lives here rather than in each caller, the same way `alerts-client`
 * solved this for `/api/alerts`. A short TTL rather than a bare in-flight
 * promise because the two passes can land either side of the response.
 *
 * Keyed on the RESOLVED token, so the anonymous-then-authenticated transition
 * that the effects exist to catch still refetches: different token, different
 * key. That is the whole point of the re-run and it must survive the dedup.
 */
const FRESH_CATCHES_TTL_MS = 30_000;

const freshCatchesCache = new Map<
  string,
  { at: number; promise: Promise<FreshCatchesResponse | null> }
>();

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

  const now = Date.now();
  const key = `${spotId ?? ""}|${token ?? ""}`;
  const hit = freshCatchesCache.get(key);
  if (hit && now - hit.at < FRESH_CATCHES_TTL_MS) return hit.promise;

  // Drop expired keys on the way past. The spot page passes a spot id, so
  // without this the map would grow by one entry per spot visited.
  for (const [k, v] of freshCatchesCache) {
    if (now - v.at >= FRESH_CATCHES_TTL_MS) freshCatchesCache.delete(k);
  }

  const qs = spotId ? `?spot=${encodeURIComponent(spotId)}` : "";
  const promise = fetch(`/api/bluecaster/map/fresh-catches${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  })
    .then(async (res) => {
      // A failure must not hold the window, or one dropped request costs the
      // badge everywhere for 30 s. A free caller's `{locked: true}` is a 200
      // and a perfectly good answer, so only real failures evict.
      if (!res.ok) {
        freshCatchesCache.delete(key);
        return null;
      }
      return (await res.json().catch(() => null)) as FreshCatchesResponse | null;
    })
    .catch((e) => {
      freshCatchesCache.delete(key);
      throw e;
    });

  freshCatchesCache.set(key, { at: now, promise });
  return promise;
}

/** The written report for one spot, for a paying angler.
 *
 *  Forwards the Supabase token for the same reason `fetchFreshCatches` does:
 *  the route reads `Authorization: Bearer`, not cookies, so a bare fetch
 *  authenticates as nobody and hands a Pro angler the locked teaser. That is
 *  exactly what shipped first time round.
 *
 *  Resolves to {locked} so the caller can tell "not allowed" apart from "not
 *  answered yet". Failures resolve locked, which leaves the teaser and upsell
 *  in place rather than blanking the block. */
export async function fetchSpotRecentReports(
  slug: string,
): Promise<{ locked: boolean; reports: unknown | null; creel: unknown | null }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(
    `/api/bluecaster/spots/${encodeURIComponent(slug)}/recent-reports`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
    },
  );
  // The locked flag is returned, not swallowed. The block needs to distinguish
  // "still asking" from "asked, and you may not have it": collapsing both to
  // null is what let the upsell paint while a Pro angler's report was still in
  // flight.
  if (!res.ok) return { locked: true, reports: null, creel: null };
  const body = (await res.json().catch(() => null)) as
    | { locked?: boolean; reports?: unknown; creel?: unknown }
    | null;
  if (!body) return { locked: true, reports: null, creel: null };
  return { locked: !!body.locked, reports: body.reports ?? null, creel: body.creel ?? null };
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
  scope: { spotIds?: string[]; citySlug?: string; speciesId?: string },
): Promise<SpotsOutlook14dPayload | null> {
  const qs = new URLSearchParams();
  if (scope.spotIds?.length) qs.set("spots", scope.spotIds.join(","));
  if (scope.citySlug) qs.set("city", scope.citySlug);
  // A scope is still required — a species alone is not one.
  if ([...qs.keys()].length === 0) return null;
  if (scope.speciesId) qs.set("species", scope.speciesId);

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

/**
 * 14-day forecast — per-day best across a set of spots.
 *
 * Scoped by `bbox` (the Explore viewport, which re-fetches as the map moves)
 * or by `city` (a city page, whose roster includes shared marks no rectangle
 * around the city centre would catch). A bare string stays a bbox so the
 * Explore call sites are unchanged.
 */
export async function fetchMapForecast14d(
  scope: string | { bbox?: string; city?: string }
): Promise<MapForecast14dPayload> {
  // The proxy gates days past the caller's horizon server-side (anon 2,
  // free 7, Pro 14) — attach the session token so signed-in callers get
  // their full horizon.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const qs = new URLSearchParams();
  if (typeof scope === "string") qs.set("bbox", scope);
  else {
    if (scope.city) qs.set("city", scope.city);
    if (scope.bbox) qs.set("bbox", scope.bbox);
  }
  const res = await fetch(
    `/api/bluecaster/map/forecast-14d?${qs}`,
    {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      // 4.7 KB that the strip is blocked on, fired in the same commit as a
      // spot payload an order of magnitude larger. At equal priority the
      // strip's request shares the pipe with it and lands late for no reason
      // — the numbers a Pro viewer is waiting on queue behind pin colours.
      priority: "high",
    }
  );
  if (!res.ok) {
    throw new Error(`map/forecast-14d API returned ${res.status}`);
  }
  return (await res.json()) as MapForecast14dPayload;
}

// ── The angler's home city ─────────────────────────────────────────────────
//
// Scoped by city slug and carrying no identity, which is the point of doing it
// this way: a city's published water is the same for everyone, so the proxy can
// mark the response shared-cacheable and the edge can serve it. Sending an
// Authorization header would make it per-reader and uncacheable for no gain,
// since it shows nothing a signed-out visitor cannot see.

/**
 * The city's spots and today's scores.
 *
 * Deliberately anonymous, unlike `fetchMapSpotsForIds`: that one sends a token
 * so an angler's own unpublished custom spots come back. Here we are ranking a
 * city's water for a dashboard band, and a private mark nobody else can see is
 * not part of "the best of this city today".
 */
export async function fetchCitySpots(
  citySlug: string,
  date: string,
): Promise<MapSpotsPayload | null> {
  const qs = new URLSearchParams({ city: citySlug, date });
  const res = await fetch(`/api/bluecaster/map/spots?${qs}`, {
    // The band sits below the fold on a phone. It must not compete with the
    // hero's own reads.
    priority: "low",
  });
  if (!res.ok) return null;
  return (await res.json().catch(() => null)) as MapSpotsPayload | null;
}

