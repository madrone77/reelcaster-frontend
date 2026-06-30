"use client";

import type { LiveSpot, SeasonState } from "@/lib/bluecaster/live-spot-types";

const SEASON_LABEL: Record<SeasonState, string> = {
  peak: "Peak now",
  shoulder: "Shoulder",
  off: "Off season",
  closed: "Closed",
  nodata: "—",
};

function titleCase(v: string | null): string | null {
  if (!v) return null;
  return v
    .split(/[_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function ProfileCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div className="rounded-lg border border-rc-rule bg-rc-surface p-3">
      <div className="rc-label text-[9px]">{label}</div>
      <div className="text-sm font-bold text-rc-ink mt-1">{value}</div>
      {sub && (
        <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5">
          {sub}
        </div>
      )}
    </div>
  );
}

/** Static spot profile panel — depth, structure, peak season, DFO area. */
export default function SpotProfile({
  spot,
  seasonState,
}: {
  spot: LiveSpot;
  seasonState: SeasonState | null;
}) {
  const depth =
    spot.depthMinM != null && spot.depthMaxM != null
      ? `${Math.round(spot.depthMinM)}–${Math.round(spot.depthMaxM)} m`
      : spot.depthMeanM != null
        ? `~${Math.round(spot.depthMeanM)} m`
        : "—";

  return (
    <div className="rounded-xl border border-rc-rule bg-rc-panel p-4">
      <div className="rc-label text-[9px] mb-3">SPOT PROFILE</div>
      <div className="grid grid-cols-2 gap-3">
        <ProfileCell label="DEPTH" value={depth} sub={titleCase(spot.bottomType)} />
        <ProfileCell
          label="STRUCTURE"
          value={titleCase(spot.spotType) ?? "—"}
          sub={titleCase(spot.exposure)}
        />
        <ProfileCell
          label="PEAK"
          value={seasonState ? SEASON_LABEL[seasonState] : "—"}
        />
        {spot.dfoSubarea && (
          <ProfileCell label="DFO AREA" value={spot.dfoSubarea} />
        )}
      </div>
    </div>
  );
}
