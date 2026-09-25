"use client";

import type { LiveSpot } from "@/lib/bluecaster/live-spot-types";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import { convertDepth, DEPTH_LABELS } from "@/app/utils/unit-conversions";
import { shoreTypeLabel, spotAccessOf } from "@/lib/spot-access";

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

/**
 * A shore angler's profile: what they stand on, how to get there, and how
 * people fish it. Depth and seabed describe a boat mark and are unknown here.
 */
function ShoreProfile({ spot }: { spot: LiveSpot }) {
  const kind = shoreTypeLabel(spot.spotType) ?? "Shore";
  return (
    <div>
      <div className="rc-label text-[9px] mb-3">SHORE PROFILE</div>
      <div className="grid grid-cols-2 gap-3">
        <ProfileCell label="FISHED FROM" value={kind} />
        <ProfileCell label="ACCESS" value="On foot" sub="No boat needed" />
      </div>
      {(spot.notes || spot.shoreTechnique) && (
        <dl className="mt-3 grid gap-3">
          {spot.notes && (
            <div className="rounded border border-rc-rule bg-rc-surface p-3">
              <dt className="rc-label text-[9px]">GETTING THERE</dt>
              <dd className="text-sm text-rc-ink mt-1 leading-relaxed">{spot.notes}</dd>
            </div>
          )}
          {spot.shoreTechnique && (
            <div className="rounded border border-rc-rule bg-rc-surface p-3">
              <dt className="rc-label text-[9px]">HOW IT&apos;S FISHED</dt>
              <dd className="text-sm text-rc-ink mt-1 leading-relaxed">{spot.shoreTechnique}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}

/** Static spot profile panel: depth and structure, or the shore version. */
export default function SpotProfile({ spot }: { spot: LiveSpot }) {
  if (spotAccessOf(spot.access, spot.spotType) === "shore") return <ShoreProfile spot={spot} />;
  return <BoatProfile spot={spot} />;
}

function BoatProfile({ spot }: { spot: LiveSpot }) {
  const { depthUnit } = useUnitPreferences();
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
          label="STRUCTURE"
          value={titleCase(spot.spotType) ?? "—"}
          sub={titleCase(spot.exposure)}
        />
      </div>
    </div>
  );
}
