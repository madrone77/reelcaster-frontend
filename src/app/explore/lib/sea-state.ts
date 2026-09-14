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

// ── Backend sea state (bluecaster sea-feel model, 2026-09-13) ───────────────
//
// The height-only reading above cannot tell a 6 ft swell at 14 s (an ordinary
// outer-coast day) from 6 ft at 8 s (a small craft advisory), so on the
// California coast the old row sat in its worst colour all day. BlueCaster now
// sends a `sea` object per hour: swell and chop split out, a 0 to 1 severity,
// and a label from a fixed vocabulary, the same judgement the scorer uses.
// Everything below reads that object, and falls back to the height reading
// when a payload predates it, so the front end can ship first.

export type SeaLabel = "Flat" | "Easy" | "Lumpy" | "Choppy" | "Rough" | "Dangerous";

/** One wave train. h metres, p mean period seconds, dir degrees FROM. */
export type SeaTrain = { h: number; p: number | null; dir: number | null };

/** The per-hour `sea` object on hourlyConditionsGrid / rightNow. */
export type SeaHour = {
  swell: SeaTrain | null;
  swell2?: SeaTrain | null;
  chop: SeaTrain | null;
  chop_estimated?: boolean;
  combined_h: number | null;
  felt_swell_h?: number | null;
  severity: number;
  label: SeaLabel;
  reason: string;
};

export const SEA_LABELS: readonly SeaLabel[] = ["Flat", "Easy", "Lumpy", "Choppy", "Rough", "Dangerous"];

export function isSeaLabel(v: unknown): v is SeaLabel {
  return typeof v === "string" && (SEA_LABELS as readonly string[]).includes(v);
}

/** 0 Flat, 1 Easy, 2 Lumpy or Choppy, 3 Rough, 4 Dangerous. */
export function seaBand(label: SeaLabel): 0 | 1 | 2 | 3 | 4 {
  switch (label) {
    case "Flat":
      return 0;
    case "Easy":
      return 1;
    case "Lumpy":
    case "Choppy":
      return 2;
    case "Rough":
      return 3;
    default:
      return 4;
  }
}

/**
 * Bar colour per band. Calm water stays quiet (two greys), so colour only
 * appears when the sea is worth a second look: amber for Lumpy or Choppy,
 * orange for Rough, red for Dangerous. The same amber, orange and red the
 * chart's other rows use.
 */
export const SEA_BAND_COLOR: readonly [string, string, string, string, string] = [
  "#CBD5E1",
  "#94A3B8",
  "#CA8A04",
  "#EA580C",
  "#E11D48",
];

export function seaColor(label: SeaLabel | null | undefined): string {
  return label ? SEA_BAND_COLOR[seaBand(label)] : SEA_BAND_COLOR[0];
}

/**
 * Label for a payload with no `sea` object: combined height alone, in the new
 * words. Deliberately lenient past 1 m, because without a period it cannot
 * tell groundswell from a steep sea, and calling every outer-coast hour Rough
 * was the bug.
 */
export function legacySeaLabel(m: number | null | undefined): SeaLabel | null {
  if (typeof m !== "number" || !Number.isFinite(m)) return null;
  if (m < 0.25) return "Flat";
  if (m < 0.6) return "Easy";
  if (m < 1.5) return "Lumpy";
  if (m < 2.5) return "Rough";
  return "Dangerous";
}

export type SeaRead = {
  label: SeaLabel;
  severity: number | null;
  swell: SeaTrain | null;
  chop: SeaTrain | null;
  /** Combined height, metres; the old `waveM`, or the wind estimate. */
  heightM: number | null;
  /** True when there is no wave model reading and the label is inferred from wind. */
  estimated: boolean;
  reason: string | null;
  /** True when the reading came from the backend model rather than the height fallback. */
  modelled: boolean;
};

/**
 * One hour's sea state from whatever the payload carries: the backend `sea`
 * object when present, otherwise the old combined height (with the wind
 * estimate for dry wave cells).
 */
export function readSea(
  hour:
    | {
        sea?: SeaHour | null;
        waveM?: number | null;
        windKt?: number | null;
        windGustKt?: number | null;
      }
    | null
    | undefined,
): SeaRead | null {
  if (!hour) return null;
  const s = hour.sea;
  if (s && isSeaLabel(s.label)) {
    const estimated = s.swell == null && s.combined_h == null;
    return {
      label: s.label,
      severity: typeof s.severity === "number" ? s.severity : null,
      swell: s.swell ?? null,
      chop: s.chop ?? null,
      heightM: s.combined_h ?? (estimated ? s.chop?.h ?? null : null),
      estimated,
      reason: s.reason ?? null,
      modelled: true,
    };
  }
  const r = resolveSea(hour.waveM, hour.windKt, hour.windGustKt);
  const label = legacySeaLabel(r?.m);
  if (!r || !label) return null;
  return {
    label,
    severity: null,
    swell: null,
    chop: null,
    heightM: r.m,
    estimated: r.estimated,
    reason: null,
    modelled: false,
  };
}

const COMPASS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

/** Compass point a train comes FROM. */
export function fromCardinal(deg: number | null | undefined): string | null {
  if (typeof deg !== "number" || !Number.isFinite(deg)) return null;
  return COMPASS_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * "4 ft @ 13 s W": height in the angler's wave unit, the model's period, and
 * the compass point the swell comes from. Feet round to whole numbers above
 * 3 ft and to halves below; metres keep one decimal.
 */
export function formatTrain(t: SeaTrain | null | undefined, unit: "m" | "ft"): string | null {
  if (!t || typeof t.h !== "number" || !Number.isFinite(t.h)) return null;
  const h = unit === "ft" ? t.h * 3.28084 : t.h;
  const hTxt =
    unit === "ft"
      ? h >= 3
        ? String(Math.round(h))
        : String(Math.round(h * 2) / 2)
      : h.toFixed(1);
  const parts = [`${hTxt} ${unit}`];
  if (typeof t.p === "number" && Number.isFinite(t.p) && t.p > 0) parts.push(`@ ${Math.round(t.p)} s`);
  const dir = fromCardinal(t.dir);
  if (dir) parts.push(dir);
  return parts.join(" ");
}

/**
 * The one-line detail under a sea-state word: the swell as a buoy reads it
 * when there is a swell worth naming (1 ft and up), otherwise the wind chop,
 * otherwise the combined height. Null for a wind estimate, which is not a
 * wave measurement and never gets a number.
 */
export function seaDetailLine(read: SeaRead | null | undefined, unit: "m" | "ft"): string | null {
  if (!read || read.estimated) return null;
  if (read.swell && read.swell.h >= 0.3) return formatTrain(read.swell, unit);
  if (read.chop && read.chop.h > 0) {
    const h = formatTrain({ h: read.chop.h, p: null, dir: null }, unit);
    return h ? `${h} chop` : null;
  }
  if (read.heightM != null) return formatTrain({ h: read.heightM, p: null, dir: null }, unit);
  return null;
}

/** The map rail's compact cell fields (optional: older payloads lack them). */
export type RailSeaCell = {
  wav: number | null;
  wkt: number | null;
  sea?: string | null;
  sev?: number | null;
  swh?: number | null;
  swp?: number | null;
  swd?: number | null;
  sest?: boolean;
};

/** Sea state for an Explore rail cell: backend label when sent, height fallback otherwise. */
export function readRailSea(cell: RailSeaCell | null | undefined): SeaRead | null {
  if (!cell) return null;
  if (isSeaLabel(cell.sea)) {
    const swell = typeof cell.swh === "number" ? { h: cell.swh, p: cell.swp ?? null, dir: cell.swd ?? null } : null;
    return {
      label: cell.sea,
      severity: cell.sev ?? null,
      swell,
      chop: null,
      heightM: cell.wav,
      estimated: cell.sest === true,
      reason: null,
      modelled: true,
    };
  }
  return readSea({ waveM: cell.wav, windKt: cell.wkt, windGustKt: null });
}
