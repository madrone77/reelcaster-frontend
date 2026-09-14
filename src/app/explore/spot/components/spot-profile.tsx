"use client";

import type { LiveSpot, SeasonState, SpotLaunch } from "@/lib/bluecaster/live-spot-types";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  convertDepth,
  convertDistance,
  DEPTH_LABELS,
  DISTANCE_LABELS,
} from "@/app/utils/unit-conversions";

/** BlueCaster's search radius for launches (lib/bluecaster/launches/nearest.ts). */
const LAUNCH_RADIUS_KM = 25;

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
    <div className="rounded border border-rc-rule bg-rc-surface p-3">
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

function directionsHref(l: SpotLaunch): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}`;
}

/** Static spot profile panel: depth, launch, peak season, structure. */
export default function SpotProfile({
  spot,
  seasonState,
  launches,
}: {
  spot: LiveSpot;
  seasonState: SeasonState | null;
  /** Undefined when the payload predates launches; empty when none qualify. */
  launches?: SpotLaunch[];
}) {
  const { depthUnit, distanceUnit } = useUnitPreferences();
  const distLbl = DISTANCE_LABELS[distanceUnit];
  const dist = (km: number) => {
    const v = convertDistance(km, "km", distanceUnit);
    return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${distLbl}`;
  };
  const nearest = launches?.[0] ?? null;
  const launchValue = !launches
    ? "Not mapped"
    : nearest
      ? nearest.name
      : `None within ${Math.round(convertDistance(LAUNCH_RADIUS_KM, "km", distanceUnit))} ${distLbl}`;
  const depthLbl = DEPTH_LABELS[depthUnit];
  const depthVal = (m: number) => Math.round(convertDepth(m, "m", depthUnit));
  const depth =
    spot.depthMinM != null && spot.depthMaxM != null
      ? `${depthVal(spot.depthMinM)}-${depthVal(spot.depthMaxM)} ${depthLbl}`
      : spot.depthMeanM != null
        ? `~${depthVal(spot.depthMeanM)} ${depthLbl}`
        : "—";

  return (
    <div>
      <div className="rc-label text-[9px] mb-3">SPOT PROFILE</div>
      <div className="grid grid-cols-2 gap-3">
        <ProfileCell label="DEPTH" value={depth} sub={titleCase(spot.bottomType)} />
        <ProfileCell
          label="LAUNCH"
          value={launchValue}
          sub={nearest ? `${dist(nearest.distanceKm)} away` : null}
        />
        <ProfileCell
          label="PEAK"
          value={seasonState ? SEASON_LABEL[seasonState] : "—"}
        />
        <ProfileCell
          label="STRUCTURE"
          value={titleCase(spot.spotType) ?? "—"}
          sub={titleCase(spot.exposure)}
        />
      </div>

      {launches && launches.length > 0 && (
        <div className="mt-5">
          <div className="rc-label text-[9px]">BOAT LAUNCHES NEARBY</div>
          <ul className="mt-2 divide-y divide-rc-rule border-y border-rc-rule">
            {launches.map((l) => (
              <li key={l.id} className="flex items-baseline justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-rc-ink">{l.name}</div>
                  <div className="font-rc-mono text-[10px] text-rc-ink-mute mt-0.5">
                    {dist(l.distanceKm)}
                    {l.fee === "free" ? " · Free" : l.fee === "fee" ? " · Fee" : ""}
                  </div>
                </div>
                <a
                  href={directionsHref(l)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-rc-brand hover:underline"
                >
                  Directions
                </a>
              </li>
            ))}
          </ul>
          <p className="font-rc-mono text-[10px] text-rc-ink-mute mt-2">
            Distances are in a straight line, not by water.
          </p>
        </div>
      )}
    </div>
  );
}
