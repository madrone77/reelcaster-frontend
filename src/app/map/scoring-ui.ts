// Client-side types + presentation helpers for the consumer map.
// Mirrors the /api/v1/map/spots response shape. No server imports — safe in the
// client bundle. Ported from bluecaster's app/map/scoring-ui.ts.

export interface HourScore {
  s: number; // 0..1
  r: 0; // always 0 — release_only species are filtered server-side
}

export interface SpeciesStrip {
  peak: number;
  peak_hour: number;
  hours: (HourScore | null)[]; // length 24, index = local hour
  season: "peak" | "mid" | "off";
}

export interface CondCell {
  wkt: number | null; // wind speed (kt)
  wdir: number | null; // wind direction (deg, FROM)
  wav: number | null; // sea/wave height (m)
  tide: number | null; // tide height (m)
  tph: string | null; // tide phase
}

export interface MapSpot {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  city_slug: string | null;
  best_species_id: string | null;
  scores: Record<string, SpeciesStrip>;
  conditions?: (CondCell | null)[] | null; // length 24, index = local hour
}

export interface SpeciesMeta {
  id: string;
  slug: string;
  name: string;
}

export interface SpotsScores {
  date: string;
  tz: string;
  forecast_version: number;
  hours_utc: string[];
  species: Record<string, SpeciesMeta>;
  spots: MapSpot[];
  meta?: { spots: number; species: number; city: string | null; date: string };
}

export interface DailyDay {
  iso: string; // YYYY-MM-DD
  dow: string; // "Mon"
  date: string; // "Jun 1"
  glyph?: string;
  score: number; // 0..100
  high?: number;
  low?: number;
}

export interface CondGridCell {
  windKt: number | null;
  windGustKt: number | null;
  windDir: string | null;
  swellM: number | null;
  waveM: number | null;
  tideM: number | null;
  tideTrend: string | null; // "rising" | "falling" | null
  seaTempC: number | null;
  airTempC: number | null;
  cloudPct: number | null;
  precipMm: number | null;
}

export interface Forecast14d {
  daily14: DailyDay[];
  // species_id -> 14 days -> 24 hourly scores (0..100, null = unavailable)
  hourlyScoreGrid?: Record<string, (number | null)[][]>;
  // 14 days -> 24 hourly condition snapshots
  hourlyConditionsGrid?: (CondGridCell | null)[][];
}

/** Best contiguous window (hours) around the day's peak in a 0..1 strip. */
export function bestWindow(strip: (HourScore | null)[]): { start: number; end: number } | null {
  let peak = 0;
  let peakHour = -1;
  for (let h = 0; h < strip.length; h++) {
    const s = strip[h]?.s ?? 0;
    if (s > peak) {
      peak = s;
      peakHour = h;
    }
  }
  if (peakHour < 0) return null;
  const thresh = peak * 0.85;
  let start = peakHour;
  let end = peakHour;
  while (start > 0 && (strip[start - 1]?.s ?? 0) >= thresh) start--;
  while (end < strip.length - 1 && (strip[end + 1]?.s ?? 0) >= thresh) end++;
  return { start, end };
}

export interface StripDay {
  iso: string;
  dow: string;
  date: string;
  score: number; // 0..100 (species-pinned daily peak)
  peakHour: number | null; // local hour of the peak, null if unknown
}

/** Daily-score (0..100) tone for the forecast strip — green / amber / red.
 *  Per Figma, the time pill uses the same hue as the score (text == pill text). */
export function dailyTone(score: number): { text: string; pillBg: string; pillText: string } {
  if (score >= 73) return { text: "#16a34a", pillBg: "#dcfce7", pillText: "#16a34a" }; // green
  if (score >= 50) return { text: "#ca8a04", pillBg: "#fef3c7", pillText: "#ca8a04" }; // amber
  return { text: "#dc2626", pillBg: "#fee2e2", pillText: "#dc2626" }; // red
}

/** "18:00" from an hour 0..23. */
export function hourClock(h: number | null): string {
  if (h == null) return "";
  return `${String(h).padStart(2, "0")}:00`;
}

export interface CursorValue {
  score: number | null; // best available score at the cursor hour, null = nothing biting
  speciesId: string | null;
}

/**
 * Best available score at a spot for the cursor hour, honouring the species
 * filter. With no filter, picks the best species AT THIS HOUR.
 */
export function cursorValue(spot: MapSpot, filter: string | null, hour: number): CursorValue {
  if (filter) {
    const cell = spot.scores[filter]?.hours[hour] ?? null;
    return cell ? { score: cell.s, speciesId: filter } : { score: null, speciesId: filter };
  }
  let best: CursorValue = { score: null, speciesId: null };
  for (const [sid, strip] of Object.entries(spot.scores)) {
    const cell = strip.hours[hour];
    if (cell && (best.score === null || cell.s > best.score)) {
      best = { score: cell.s, speciesId: sid };
    }
  }
  return best;
}

/** Day-peak value for a spot honouring the filter (sidebar "best of day"). */
export function dayPeak(
  spot: MapSpot,
  filter: string | null,
): { score: number; speciesId: string | null; hour: number } {
  if (filter) {
    const strip = spot.scores[filter];
    return strip ? { score: strip.peak, speciesId: filter, hour: strip.peak_hour } : { score: 0, speciesId: filter, hour: 0 };
  }
  let best = { score: 0, speciesId: null as string | null, hour: 0 };
  for (const [sid, strip] of Object.entries(spot.scores)) {
    if (strip.peak > best.score) best = { score: strip.peak, speciesId: sid, hour: strip.peak_hour };
  }
  return best;
}

// Score → colour. Verdict palette (emerald → lime → amber → orange → rose),
// grey when nothing is available that hour.
const SCALE: Array<[number, string]> = [
  [0.78, "#059669"], // emerald-600 — Prime
  [0.62, "#65a30d"], // lime-600 — Good
  [0.46, "#ca8a04"], // amber-600 — Fair
  [0.3, "#ea580c"], // orange-600 — Slow
  [0, "#e11d48"], // rose-600 — Poor
];
export const NO_DATA_COLOR = "#94a3b8"; // slate-400

export function scoreColor(score: number | null): string {
  if (score === null) return NO_DATA_COLOR;
  for (const [t, c] of SCALE) if (score >= t) return c;
  return SCALE[SCALE.length - 1][1];
}

export function scoreVerdict(score: number | null): string {
  if (score === null) return "Nothing biting";
  if (score >= 0.78) return "Prime";
  if (score >= 0.62) return "Good";
  if (score >= 0.46) return "Fair";
  if (score >= 0.3) return "Slow";
  return "Poor";
}

/** Short pill label (matches the Figma "GOOD" / "FAIR" chips). */
export function scorePill(score: number | null): { label: string; tone: "good" | "fair" | "poor" | "none" } {
  if (score === null) return { label: "—", tone: "none" };
  if (score >= 0.62) return { label: "GOOD", tone: "good" };
  if (score >= 0.46) return { label: "FAIR", tone: "fair" };
  return { label: "SLOW", tone: "poor" };
}

export function hourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

/** 8-point compass from a bearing in degrees. */
export function compass(deg: number | null | undefined): string {
  if (deg == null) return "—";
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Qualitative sea state from wave height (m), matching the Figma card vocabulary. */
export function seaState(waveM: number | null | undefined): string {
  if (waveM == null) return "—";
  if (waveM < 0.3) return "Calm";
  if (waveM < 0.6) return "Light";
  if (waveM < 1.0) return "Light Chop";
  if (waveM < 1.5) return "Moderate";
  if (waveM < 2.5) return "Rough";
  return "Heavy";
}

/** "12 kn SW" wind label from a conditions cell. */
export function windLabel(cell: CondCell | null | undefined): string {
  if (!cell || cell.wkt == null) return "—";
  return `${Math.round(cell.wkt)} kn ${compass(cell.wdir)}`;
}

/** "+2.4m ▲" tide label (metres, with a flood/ebb arrow from the phase). */
export function tideLabel(cell: CondCell | null | undefined): string {
  if (!cell || cell.tide == null) return "—";
  const ht = `${cell.tide >= 0 ? "+" : ""}${cell.tide.toFixed(1)}m`;
  const p = cell.tph ?? "";
  const arrow = p.startsWith("flood") ? " ▲" : p.startsWith("ebb") ? " ▼" : "";
  return ht + arrow;
}

/** Conditions cell at a given hour for a spot (null-safe). */
export function condAt(spot: MapSpot, hour: number): CondCell | null {
  return spot.conditions?.[hour] ?? null;
}

/** "May 21" style short date from YYYY-MM-DD. */
export function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, day)),
  );
}

/** Add N days to a YYYY-MM-DD string (UTC-noon safe). */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Current local hour 0..23 in a tz, defaulting to 7 on failure. */
export function currentLocalHour(tz: string): number {
  const h = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date());
  const n = parseInt(h, 10);
  return Number.isFinite(n) ? n % 24 : 7;
}
