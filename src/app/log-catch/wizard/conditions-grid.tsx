"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { CatchSnapshot } from "@/lib/bluecaster/catch-ingest-types";
import type { SnapshotOverrides } from "./types";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertHeight,
  convertPressure,
  convertTemp,
  convertWind,
  formatHeight,
  formatPressure,
  formatWind,
  WIND_LABELS,
} from "@/app/utils/unit-conversions";

type CellKey = keyof SnapshotOverrides;

/**
 * CONDITIONS AT CATCH TIME — six auto-filled cells (mock parity: TIDE,
 * CURRENT, WIND, PRESSURE, WATER TEMP, SKY). Each primary value is
 * click-to-edit (numeric); edited cells flip their badge from AUTO to
 * EDITED and the override merges into the saved snapshot. Sub-lines stay
 * derived from the auto data.
 */
export default function ConditionsGrid({
  snapshot,
  overrides,
  onOverride,
  speciesName,
  loading,
}: {
  snapshot: CatchSnapshot | null;
  overrides: SnapshotOverrides;
  onOverride: (key: CellKey, value: number | undefined) => void;
  speciesName: string | null;
  loading: boolean;
}) {
  const { windUnit, tempUnit, heightUnit, pressureUnit } = useUnitPreferences();

  if (!snapshot && !loading) {
    return (
      <div className="rounded-xl border border-rc-rule bg-rc-surface px-4 py-6 text-center text-[13px] text-rc-ink-mute">
        Conditions unavailable for this time and spot.
      </div>
    );
  }
  if (!snapshot) {
    return (
      <div className="rounded-xl border border-rc-rule bg-rc-surface px-4 py-6 flex items-center justify-center gap-2 text-[13px] text-rc-ink-mute">
        <Loader2 className="w-4 h-4 animate-spin" /> Pulling conditions…
      </div>
    );
  }

  const s = snapshot;
  const rising = (s.tide_phase ?? "").startsWith("flood") || s.tide_phase === "slack_low";
  const tideWord = (s.tide_phase ?? "").startsWith("flood")
    ? "flood"
    : (s.tide_phase ?? "").startsWith("ebb")
      ? "ebb"
      : s.tide_phase?.startsWith("slack")
        ? "slack"
        : null;

  const currentTrend =
    s.current_rate_of_change_kt_per_hr === null
      ? null
      : s.current_rate_of_change_kt_per_hr > 0.1
        ? "building"
        : s.current_rate_of_change_kt_per_hr < -0.1
          ? "dying"
          : "steady";

  const pressureRising = (s.pressure_trend_3h ?? 0) >= 0;

  const skyLabel =
    s.cloud_cover_pct === null
      ? "—"
      : (s.precipitation_mm ?? 0) > 0.2
        ? "Rain"
        : s.cloud_cover_pct < 10
          ? "Clear"
          : s.cloud_cover_pct < 40
            ? "Mostly clear"
            : s.cloud_cover_pct < 75
              ? "Partly cloudy"
              : "Overcast";

  const tempNote = waterTempNote(s.water_temp_c, speciesName);

  const speedLabel = WIND_LABELS[windUnit];

  const cells: Array<{
    key: CellKey;
    label: string;
    value: number | null;
    display: string;
    unit: string;
    sub: string;
    step: number;
  }> = [
    {
      key: "tide_height_m",
      label: "TIDE",
      value: s.tide_height_m,
      display:
        s.tide_height_m !== null
          ? `${s.tide_height_m >= 0 ? "+" : ""}${formatHeight(convertHeight(s.tide_height_m, "m", heightUnit), heightUnit)} ${rising ? "↑" : "↓"}`
          : "—",
      unit: heightUnit,
      sub: tideWord ? `${rising ? "Rising" : "Falling"} · ${tideWord}` : "—",
      step: 0.1,
    },
    {
      key: "current_speed_kt",
      label: "CURRENT",
      value: s.current_speed_kt,
      display:
        s.current_speed_kt !== null && s.current_dir
          ? `${tideWord === "ebb" ? "Ebb" : "Flood"} ${s.current_dir}`
          : "—",
      unit: speedLabel,
      sub:
        s.current_speed_kt !== null
          ? `${formatWind(convertWind(s.current_speed_kt, "knots", windUnit), windUnit, 1)}${currentTrend ? ` · ${currentTrend}` : ""}`
          : "No current data here",
      step: 0.1,
    },
    {
      key: "wind_kn",
      label: "WIND",
      value: s.wind_kn,
      display:
        s.wind_kn !== null
          ? `${formatWind(convertWind(s.wind_kn, "knots", windUnit), windUnit)} ${s.wind_dir ?? ""}`
          : "—",
      unit: speedLabel,
      sub:
        s.wind_gust_kt !== null
          ? `Steady · gusts ${Math.round(convertWind(s.wind_gust_kt, "knots", windUnit))}`
          : "—",
      step: 1,
    },
    {
      key: "barometric_pressure_hpa",
      label: "PRESSURE",
      value: s.barometric_pressure_hpa,
      display:
        s.barometric_pressure_hpa !== null
          ? `${formatPressure(convertPressure(s.barometric_pressure_hpa, "mb", pressureUnit), pressureUnit)} ${pressureRising ? "▲" : "▼"}`
          : "—",
      unit: pressureUnit,
      sub:
        s.pressure_trend_3h !== null
          ? `${pressureRising ? "Rising" : "Falling"} ${s.pressure_trend_3h >= 0 ? "+" : ""}${convertPressure(s.pressure_trend_3h, "mb", pressureUnit).toFixed(pressureUnit === "inHg" ? 2 : 1)}/3hr`
          : "—",
      step: 1,
    },
    {
      key: "water_temp_c",
      label: "WATER TEMP",
      value: s.water_temp_c,
      display:
        s.water_temp_c !== null
          ? `${convertTemp(s.water_temp_c, "C", tempUnit).toFixed(1)} °${tempUnit}`
          : "—",
      unit: `°${tempUnit}`,
      sub: tempNote,
      step: 0.1,
    },
    {
      key: "cloud_cover_pct",
      label: "SKY",
      value: s.cloud_cover_pct,
      display: skyLabel,
      unit: "% cloud",
      sub: s.visibility_km !== null ? `Vis ${Math.round(s.visibility_km)} km` : "—",
      step: 5,
    },
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${loading ? "opacity-60" : ""}`}>
      {cells.map((c) => (
        <Cell
          key={c.key}
          cellKey={c.key}
          label={c.label}
          display={c.display}
          sub={c.sub}
          unit={c.unit}
          value={c.value}
          step={c.step}
          edited={overrides[c.key] !== undefined}
          onOverride={onOverride}
        />
      ))}
    </div>
  );
}

function Cell({
  cellKey,
  label,
  display,
  sub,
  unit,
  value,
  step,
  edited,
  onOverride,
}: {
  cellKey: CellKey;
  label: string;
  display: string;
  sub: string;
  unit: string;
  value: number | null;
  step: number;
  edited: boolean;
  onOverride: (key: CellKey, value: number | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    setEditing(false);
    if (draft.trim() === "") return;
    const n = Number(draft);
    if (Number.isFinite(n)) onOverride(cellKey, n);
  };

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        edited
          ? "border-rc-brand/40 bg-rc-brand-soft/30"
          : "border-rc-good-ink/25 bg-rc-good-bg/60"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="rc-label text-[9px] text-rc-ink-soft">{label}</span>
        <span
          className={`flex items-center gap-1 rc-label text-[8px] ${edited ? "text-rc-brand" : "text-rc-good-ink"}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${edited ? "bg-rc-brand" : "bg-rc-good-ink"}`}
          />
          {edited ? "EDITED" : "AUTO"}
        </span>
      </div>
      {editing ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            autoFocus
            type="number"
            step={step}
            defaultValue={value ?? undefined}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-24 rounded-md border border-rc-brand bg-rc-panel px-2 py-1 text-lg font-bold text-rc-ink focus:outline-none"
          />
          <span className="text-[11px] text-rc-ink-mute">{unit}</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          title="Edit value"
          className="mt-1 block text-left text-xl font-bold text-rc-ink hover:text-rc-brand transition-colors"
        >
          {display}
        </button>
      )}
      <div className="mt-0.5 font-rc-mono text-[11px] text-rc-ink-soft">{sub}</div>
      {edited && (
        <button
          type="button"
          onClick={() => onOverride(cellKey, undefined)}
          className="mt-1 rc-label text-[8px] text-rc-ink-mute hover:text-rc-ink transition-colors"
        >
          RESET TO AUTO
        </button>
      )}
    </div>
  );
}

function waterTempNote(tempC: number | null, speciesName: string | null): string {
  if (tempC === null) return "—";
  const isSalmon = (speciesName ?? "").toLowerCase().includes("salmon");
  if (isSalmon) {
    if (tempC >= 9 && tempC <= 14)
      return `Optimal for ${speciesName?.split(" ")[0] ?? "salmon"}`;
    return tempC < 9 ? "Cold" : "Warm for salmon";
  }
  if (tempC < 8) return "Cold";
  if (tempC <= 16) return "Moderate";
  return "Warm";
}
