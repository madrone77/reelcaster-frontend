// Sea-state reading, with a wind-derived fallback for spots the wave model
// cannot see.
//
// Open-Meteo's wave grid is 1/12 degree, about 9.3 km per cell, and its land
// mask marks whole inland cells dry. South Puget Sound has five consecutive dry
// cells, which is wide enough to swallow eleven of our spots: Point Robinson,
// the Tacoma Narrows, Commencement Bay, Gig Harbor and neighbours all get a null
// wave height for every hour of every day. That left the "Sea state" cell and
// the 24-hour SEA STATE row blank forever. Every other marine model Open-Meteo
// offers is null on the same water, including the ECMWF WAM 0.25 backfill and
// the finer GFS Wave 0.16, so there is no second model to fall back on, and the
// nearest live cell is 35 km off, which is a different basin rather than a
// neighbour. Bluecaster's ingest does search outward for a usable cell first
// (see lib/bluecaster/conditions/marine-coordinate.ts); this is what runs when
// that search comes back empty.
//
// Wind is never missing at those spots, and on sheltered inland water nearly all
// the chop is locally generated wind sea anyway. The swell partition is what
// the coarse grid is really there for, and there is no swell inside Puget Sound
// or the Salish Sea to speak of. So when the wave model has nothing, estimate a
// significant wave height from the wind and label the reading as an estimate.
//
// The estimate is deliberately never dressed up as a measurement: callers get
// `estimated: true` back and show the sea-state word without a height, so a
// reader can always tell a modelled wave from an inferred one.

/** Knots → m/s. */
const KT_TO_MS = 0.514444;

// Fetch-limited wind sea (JONSWAP): Hs = 0.0163 · √F · U, F in km, U in m/s.
// F is the fetch: how far the wind has blown over open water before it reaches
// you. 10 km is a fair nominal for the inland water this fallback exists for
// (Puget Sound's basins, the Strait of Georgia's inshore edges); the open coast
// would want more, but the open coast has real wave data.
const JONSWAP_K = 0.0163;
const NOMINAL_FETCH_KM = 10;

// Fetch-limited seas stop growing; past this the words are all "Rough" anyway,
// and letting the linear formula run would print silly heights in a gale.
const MAX_WIND_SEA_M = 1.5;

/**
 * Gusts roughen the surface even when the sustained wind is milder, so the
 * sea-building wind is the stronger of the two, gusts de-rated to 70%. Matches
 * `effectiveWindKt` in the bluecaster sea-state model.
 */
function effectiveWindKt(
  sustainedKt: number | null | undefined,
  gustKt: number | null | undefined,
): number | null {
  const s = typeof sustainedKt === "number" && Number.isFinite(sustainedKt) ? sustainedKt : null;
  const g = typeof gustKt === "number" && Number.isFinite(gustKt) ? gustKt * 0.7 : null;
  if (s === null && g === null) return null;
  return Math.max(s ?? 0, g ?? 0);
}

/**
 * Estimated significant wave height, metres, from wind alone. Null when there is
 * no wind reading either. Nothing is better than a made-up calm.
 */
export function windSeaHeightM(
  windKt: number | null | undefined,
  gustKt: number | null | undefined,
): number | null {
  const eff = effectiveWindKt(windKt, gustKt);
  if (eff === null) return null;
  const hs = JONSWAP_K * Math.sqrt(NOMINAL_FETCH_KM) * eff * KT_TO_MS;
  return Math.min(hs, MAX_WIND_SEA_M);
}

export type SeaReading = {
  /** Significant wave height in metres. */
  m: number;
  /** True when derived from wind because the wave model had nothing. */
  estimated: boolean;
};

/**
 * The wave height to show for one hour: the model's when it has one, otherwise a
 * wind-derived estimate. Null only when both are missing.
 */
export function resolveSea(
  waveM: number | null | undefined,
  windKt: number | null | undefined,
  gustKt: number | null | undefined,
): SeaReading | null {
  if (typeof waveM === "number" && Number.isFinite(waveM)) {
    return { m: waveM, estimated: false };
  }
  const est = windSeaHeightM(windKt, gustKt);
  return est === null ? null : { m: est, estimated: true };
}

/** Sub-line shown under an estimated reading, in place of a height. */
export const SEA_ESTIMATE_NOTE = "est. from wind";
