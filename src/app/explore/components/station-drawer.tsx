"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import type { StationPick } from "./explore-map";
import {
  fetchBuoyConditions,
  fetchStationConditions,
  type BuoyConditions,
  type StationConditions,
} from "@/lib/bluecaster-client";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertHeight,
  convertPressure,
  convertTemp,
  convertWind,
  formatHeight,
  formatPressure,
  formatTemp,
  formatWind,
} from "@/app/utils/unit-conversions";

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function fmtLocalTime(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
  });
}

function fmtAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

/** SVG tide curve: hourly series polyline + extreme dots + a "now" tick. */
function TideCurve({
  series,
  extremes,
  tz,
}: {
  series: StationConditions["series"];
  extremes: StationConditions["extremes"];
  tz: string;
}) {
  const { tideUnit } = useUnitPreferences();
  const model = useMemo(() => {
    if (series.length < 2) return null;
    const W = 336;
    const H = 110;
    const PAD_X = 6;
    const PAD_Y = 18;
    const t0 = Date.parse(series[0].time_utc);
    const t1 = Date.parse(series[series.length - 1].time_utc);
    const hs = series.map((p) => p.height_m);
    const hMin = Math.min(...hs);
    const hMax = Math.max(...hs);
    const span = Math.max(0.5, hMax - hMin);
    const x = (iso: string) =>
      PAD_X + ((Date.parse(iso) - t0) / (t1 - t0)) * (W - 2 * PAD_X);
    const y = (h: number) =>
      H - PAD_Y - ((h - hMin) / span) * (H - 2 * PAD_Y);
    const path = series
      .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.time_utc).toFixed(1)},${y(p.height_m).toFixed(1)}`)
      .join(" ");
    // Clamp label anchors inside the viewBox and stagger labels on the same
    // side (above highs / below lows) when neighbouring extremes crowd.
    const lastLabelX: Record<string, number> = {};
    const dots = extremes
      .filter((e) => {
        const t = Date.parse(e.time_utc);
        return t >= t0 && t <= t1;
      })
      .map((e) => {
        const cx = x(e.time_utc);
        const labelX = Math.min(W - 40, Math.max(40, cx));
        const crowded = labelX - (lastLabelX[e.kind] ?? -Infinity) < 78;
        lastLabelX[e.kind] = labelX;
        return {
          cx,
          cy: y(e.height_m),
          labelX,
          crowded,
          kind: e.kind,
          label: `${convertHeight(e.height_m, "m", tideUnit).toFixed(1)}${tideUnit}`,
          time: fmtLocalTime(e.time_utc, tz),
        };
      });
    const nowMs = Date.now();
    const nowX = nowMs >= t0 && nowMs <= t1 ? PAD_X + ((nowMs - t0) / (t1 - t0)) * (W - 2 * PAD_X) : null;
    return { W, H, path, dots, nowX };
  }, [series, extremes, tz, tideUnit]);

  if (!model) return null;
  return (
    <svg
      viewBox={`0 0 ${model.W} ${model.H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Tide height over the next 30 hours"
    >
      {model.nowX !== null && (
        <line
          x1={model.nowX}
          x2={model.nowX}
          y1={4}
          y2={model.H - 4}
          stroke="#94a3b8"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}
      <path d={model.path} fill="none" stroke="#0b6e9c" strokeWidth={2} strokeLinejoin="round" />
      {model.dots.map((d, i) => (
        <g key={i}>
          <circle cx={d.cx} cy={d.cy} r={3} fill="#0b6e9c" />
          <text
            x={d.labelX}
            y={
              d.kind === "high"
                ? d.cy - (d.crowded ? 18 : 8)
                : d.cy + (d.crowded ? 24 : 14)
            }
            textAnchor="middle"
            className="fill-rc-ink-soft"
            fontSize={9}
            fontFamily="var(--font-rc-mono, monospace)"
          >
            {d.label} · {d.time}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * Rail drawer for a clicked tide station or weather buoy — the station
 * counterpart to SpotDrawer. Renders the header instantly from the map
 * feature, then fills with live data (tide curve for stations, latest
 * NDBC observations for buoys).
 */
export default function StationDrawer({
  pick,
  tz,
  onBack,
}: {
  pick: StationPick;
  tz: string;
  onBack: () => void;
}) {
  const { windUnit, tempUnit, tideUnit, waveUnit, pressureUnit } = useUnitPreferences();
  const [tide, setTide] = useState<StationConditions | null>(null);
  const [buoy, setBuoy] = useState<BuoyConditions | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setTide(null);
    setBuoy(null);
    const req =
      pick.kind === "tide"
        ? fetchStationConditions(pick.source as "chs" | "noaa", pick.sid).then((d) => {
            if (!cancelled) setTide(d);
            return d;
          })
        : fetchBuoyConditions(pick.sid).then((d) => {
            if (!cancelled) setBuoy(d);
            return d;
          });
    req
      .then((d) => {
        if (!cancelled && !d) setFailed(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pick.kind, pick.source, pick.sid]);

  const isTide = pick.kind === "tide";
  const operatorLabel = isTide
    ? pick.source === "chs"
      ? "CHS · DFO"
      : "NOAA"
    : buoy?.station.operator === "ECCC"
      ? "ECCC · DFO"
      : (buoy?.station.operator ?? "NDBC");
  const kindLabel = isTide
    ? "TIDE STATION"
    : buoy?.station.station_type === "cman"
      ? "WEATHER STATION"
      : "WEATHER BUOY";

  const name = tide?.station.name ?? buoy?.station.name ?? pick.name;

  // Next tide turns (soonest 4 upcoming extremes).
  const upcoming = useMemo(() => {
    if (!tide) return [];
    const now = Date.now();
    return tide.extremes.filter((e) => Date.parse(e.time_utc) > now).slice(0, 4);
  }, [tide]);

  const trend = useMemo(() => {
    if (!tide?.now) return null;
    const next = upcoming[0];
    const dir = tide.now.phase.startsWith("flood")
      ? "Rising"
      : tide.now.phase.startsWith("ebb")
        ? "Falling"
        : tide.now.phase === "slack_high"
          ? "High slack"
          : "Low slack";
    if (!next) return dir;
    return `${dir} · ${next.kind} ${formatHeight(convertHeight(next.height_m, "m", tideUnit), tideUnit)} at ${fmtLocalTime(next.time_utc, tz)}`;
  }, [tide, upcoming, tz, tideUnit]);

  const obs = buoy?.latest ?? null;
  const buoyCells: Array<{ label: string; value: string; sub: string | null }> = obs
    ? [
        {
          label: "WIND",
          value:
            obs.wind_speed_kn != null
              ? `${formatWind(convertWind(obs.wind_speed_kn, "knots", windUnit), windUnit)}${obs.wind_dir_deg != null ? ` ${degToCompass(obs.wind_dir_deg)}` : ""}`
              : "—",
          sub: null,
        },
        {
          label: "GUST",
          value: obs.gust_kn != null ? formatWind(convertWind(obs.gust_kn, "knots", windUnit), windUnit) : "—",
          sub: null,
        },
        {
          label: "WAVES",
          value: obs.wave_height_m != null ? formatHeight(convertHeight(obs.wave_height_m, "m", waveUnit), waveUnit) : "—",
          sub:
            obs.dominant_period_s != null
              ? `${Math.round(obs.dominant_period_s)}s period`
              : obs.wave_height_m == null
                ? "not measured"
                : null,
        },
        {
          label: "WATER",
          value: obs.water_temp_c != null ? formatTemp(convertTemp(obs.water_temp_c, "C", tempUnit), tempUnit, 1) : "—",
          sub: obs.water_temp_c == null ? "not measured" : null,
        },
        {
          label: "AIR",
          value: obs.air_temp_c != null ? formatTemp(convertTemp(obs.air_temp_c, "C", tempUnit), tempUnit, 1) : "—",
          sub: null,
        },
        {
          label: "PRESSURE",
          value:
            obs.pressure_hpa != null
              ? pressureUnit === "mb"
                ? `${obs.pressure_hpa.toFixed(1)} hPa`
                : formatPressure(convertPressure(obs.pressure_hpa, "mb", pressureUnit), pressureUnit)
              : "—",
          sub: null,
        },
      ]
    : [];

  // Content-sized like the spot drawer — the rail caps it with max-height.
  return (
    <div className="flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="p-1 -ml-1 rounded-md text-rc-brand hover:bg-rc-surface transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="rc-label text-[9px]">
          {kindLabel} · {operatorLabel}
        </span>
        <button
          type="button"
          onClick={onBack}
          aria-label="Close"
          className="ml-auto p-1 rounded-md text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="min-h-0 overflow-y-auto px-4 pb-4">
        <h2 className="rc-title-lg truncate mt-2">{name}</h2>
        <p className="font-rc-mono text-xs text-rc-ink-soft mt-1">
          {isTide
            ? "Tide predictions"
            : buoy?.station.desc ?? "Live observations"}
          {!isTide && obs ? ` · updated ${fmtAgo(obs.time_utc)}` : ""}
        </p>

        {loading && (
          <div className="mt-8 space-y-3 animate-pulse">
            <div className="h-10 w-32 bg-rc-surface rounded" />
            <div className="h-24 w-full bg-rc-surface rounded" />
          </div>
        )}

        {failed && !loading && (
          <p className="text-xs text-rc-ink-mute mt-8">
            Live data for this station is unavailable right now. Try again in
            a few minutes.
          </p>
        )}

        {/* ── Tide station ── */}
        {tide && (
          <>
            <div className="flex items-baseline gap-3 mt-6 pb-4 border-b border-rc-rule-soft">
              <span className="text-[44px] leading-none font-bold tracking-[-0.04em] text-rc-ink">
                {tide.now ? formatHeight(convertHeight(tide.now.height_m, "m", tideUnit), tideUnit) : "—"}
              </span>
              {tide.now && (
                <span className="font-rc-mono text-xs text-rc-ink-soft">
                  {formatHeight(
                    convertHeight(tide.now.height_m, "m", tideUnit === "m" ? "ft" : "m"),
                    tideUnit === "m" ? "ft" : "m",
                  )}
                </span>
              )}
            </div>
            {trend && (
              <p className="font-rc-mono text-xs text-rc-ink-soft mt-3">{trend}</p>
            )}

            <div className="mt-4">
              <div className="rc-label text-[9px] mb-1">NEXT 30 HOURS</div>
              <TideCurve series={tide.series} extremes={tide.extremes} tz={tz} />
            </div>

            {upcoming.length > 0 && (
              <div className="mt-4">
                <div className="rc-label text-[9px] mb-2">UPCOMING TIDES</div>
                <div className="space-y-1.5">
                  {upcoming.map((e) => (
                    <div
                      key={e.time_utc}
                      className="flex items-center justify-between font-rc-mono text-sm"
                    >
                      <span
                        className={
                          e.kind === "high" ? "text-rc-ink font-medium" : "text-rc-ink-soft"
                        }
                      >
                        {e.kind === "high" ? "High" : "Low"}
                      </span>
                      <span className="text-rc-ink-soft">
                        {formatHeight(convertHeight(e.height_m, "m", tideUnit), tideUnit)}
                      </span>
                      <span className="text-rc-ink">
                        {fmtLocalTime(e.time_utc, tz)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Weather buoy / C-MAN station ── */}
        {buoy && (
          <>
            {obs ? (
              <div className="grid grid-cols-3 gap-y-4 mt-6 pb-5 border-b border-rc-rule-soft">
                {buoyCells.map((cell) => (
                  <div key={cell.label}>
                    <div className="rc-label text-[9px]">{cell.label}</div>
                    <div className="font-rc-mono text-sm font-medium text-rc-ink mt-1">
                      {cell.value}
                    </div>
                    {cell.sub && (
                      <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5 italic">
                        {cell.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              !loading && (
                <p className="text-xs text-rc-ink-mute mt-8">
                  No recent observations from this station.
                </p>
              )
            )}
            <p className="font-rc-mono text-[10px] text-rc-ink-mute mt-4">
              Source:{" "}
              {buoy.station.operator === "ECCC"
                ? "Environment & Climate Change Canada via NOAA NDBC"
                : buoy.station.operator === "NOAA"
                  ? "NOAA NDBC"
                  : `${buoy.station.operator} via NOAA NDBC`}{" "}
              · station {buoy.station.sid}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
