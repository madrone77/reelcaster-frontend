// Human-language formatter for fishing-score factors. Used by the breakdown
// panel and (later) by alert email bodies.
//
// BlueCaster stores factor_contributions as a JSONB blob keyed by factor name
// (snake_case). The shape varies by scoring algorithm version, so this module
// is defensive: it humanises known keys with rich descriptions and falls back
// to a generic label-and-value renderer for anything else.

const UNIT_SUFFIX: Record<string, string> = {
  c: "°C",
  f: "°F",
  kt: "kn",
  kts: "kn",
  m: "m",
  ft: "ft",
  deg: "°",
  hpa: "hPa",
  mb: "mb",
  pct: "%",
  mm: "mm",
  s: "s",
};

/** "tide_phase" → "Tide phase"; "wind_speed_kt" → "Wind speed (kn)" */
export function formatFactorLabel(key: string): string {
  const parts = key.split("_");
  const last = parts[parts.length - 1]?.toLowerCase() ?? "";
  let unit: string | null = null;
  let nameParts = parts;
  if (last in UNIT_SUFFIX) {
    unit = UNIT_SUFFIX[last]!;
    nameParts = parts.slice(0, -1);
  }
  const name = nameParts
    .map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ");
  return unit ? `${name} (${unit})` : name;
}

// ── Known factor-state lookups (spec §5) ────────────────────────────

/** Tide phase — 9 states. */
export function tidePhaseLabel(value: number | string): string {
  if (typeof value === "string") return value;
  // Convention: 0..1 progression through a tide cycle.
  if (value < 0.05) return "Slack low";
  if (value < 0.2) return "Early flood";
  if (value < 0.4) return "Mid flood";
  if (value < 0.5) return "Late flood";
  if (value < 0.55) return "Slack high";
  if (value < 0.7) return "Early ebb";
  if (value < 0.85) return "Mid ebb";
  if (value < 0.95) return "Late ebb";
  return "Slack low";
}

/** Pressure trend — 5 states. */
export function pressureTrendLabel(deltaMb: number): string {
  if (deltaMb <= -3) return "Falling fast";
  if (deltaMb < -0.5) return "Falling";
  if (deltaMb <= 0.5) return "Steady";
  if (deltaMb < 3) return "Rising";
  return "Rising fast";
}

/** Moon phase — 8 states. Expects 0..1 phase progression. */
export function moonPhaseLabel(phase: number): string {
  if (phase < 0.0625) return "New moon";
  if (phase < 0.1875) return "Waxing crescent";
  if (phase < 0.3125) return "First quarter";
  if (phase < 0.4375) return "Waxing gibbous";
  if (phase < 0.5625) return "Full moon";
  if (phase < 0.6875) return "Waning gibbous";
  if (phase < 0.8125) return "Last quarter";
  if (phase < 0.9375) return "Waning crescent";
  return "New moon";
}

/** Season strength — 4 quarter buckets. */
export function seasonLabel(strength: number): string {
  if (strength >= 0.85) return "Peak season";
  if (strength >= 0.6) return "In season";
  if (strength >= 0.3) return "Shoulder";
  return "Off season";
}

// ── Generic render path ─────────────────────────────────────────────

export interface FactorRow {
  key: string;
  label: string;
  /** Human-language state, or null if numeric-only. */
  state: string | null;
  /** Normalised contribution -1..1 if available. */
  contribution: number | null;
  /** Raw value, for tooltip / debug. */
  raw: unknown;
}

/**
 * Best-effort breakdown of a factor_contributions blob into rows the panel
 * can render. We accept either:
 *   - { tide: 0.6, pressure: -0.2 }                  // simple weights
 *   - { tide_phase: 0.45, pressure_trend_mb: -2.1 }  // typed values
 *   - { tide: { value: 0.6, state: "Early ebb" } }   // pre-formatted
 */
export function breakdownRows(blob: unknown): FactorRow[] {
  if (!blob || typeof blob !== "object") return [];
  const rows: FactorRow[] = [];

  for (const [key, raw] of Object.entries(blob as Record<string, unknown>)) {
    const label = formatFactorLabel(key);
    let state: string | null = null;
    let contribution: number | null = null;

    if (typeof raw === "number") {
      contribution = clamp(raw, -1, 1);
      state = stateFor(key, raw);
    } else if (raw && typeof raw === "object") {
      const obj = raw as Record<string, unknown>;
      if (typeof obj.value === "number") {
        contribution = clamp(obj.value, -1, 1);
      } else if (typeof obj.contribution === "number") {
        contribution = clamp(obj.contribution, -1, 1);
      }
      if (typeof obj.state === "string") {
        state = obj.state;
      } else if (typeof obj.label === "string") {
        state = obj.label;
      } else if (typeof obj.value === "number") {
        state = stateFor(key, obj.value);
      }
    } else if (typeof raw === "string") {
      state = raw;
    }

    rows.push({ key, label, state, contribution, raw });
  }

  return rows;
}

function stateFor(key: string, value: number): string | null {
  const k = key.toLowerCase();
  if (k.includes("tide_phase") || k === "tide") return tidePhaseLabel(value);
  if (k.includes("moon")) return moonPhaseLabel(value);
  if (k.includes("season")) return seasonLabel(value);
  if (k.includes("pressure_trend") || k.includes("pressure_delta"))
    return pressureTrendLabel(value);
  return null;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
