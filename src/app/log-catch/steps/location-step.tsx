"use client";

import { useState } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import PinPickerMap from "@/app/components/location/pin-picker-map";
import type { NearestSpotHit } from "@/lib/bluecaster/catch-ingest-types";
import { SpotMatchCard, NoSpotCard } from "../wizard/spot-match-card";
import CreateSpotModal from "../wizard/create-spot-modal";
import type { PinSource } from "@/lib/geo-fallback";

const SOURCE_LABEL: Record<PinSource, string> = {
  exif: "EXIF GPS · drag to adjust",
  geolocation: "Your location · drag to adjust",
  ip: "Approximate (IP) · drag to adjust",
  city: "Last viewed area · drag to adjust",
  default: "Drag the pin to your spot",
};

/**
 * Step 3 — map location picker. Pin starts at EXIF GPS (or the geo fallback
 * chain); every move re-queries the nearest saved spot within 400 m. Match →
 * blue card + Continue; open water → amber create-a-spot card.
 */
export default function LocationStep({
  pin,
  pinSource,
  resolving,
  searching,
  match,
  candidates,
  mgmtArea,
  onPinMove,
  onUseMyLocation,
  onUseSpot,
  onCreateSpot,
}: {
  pin: { lat: number; lng: number } | null;
  pinSource: PinSource;
  resolving: boolean;
  searching: boolean;
  match: NearestSpotHit | null;
  candidates: NearestSpotHit[];
  mgmtArea: string | null;
  onPinMove: (lat: number, lng: number) => void;
  /** Explicit opt-in for precise location (may trigger the browser prompt). */
  onUseMyLocation: () => Promise<string | null>;
  onUseSpot: (spot: NearestSpotHit) => void;
  onCreateSpot: (name: string) => Promise<string | null>;
}) {
  const [createOpen, setCreateOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // The pin is only approximate for these sources — offer precise location.
  const showLocateButton =
    pinSource === "ip" || pinSource === "city" || pinSource === "default";

  if (resolving || !pin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-rc-ink-mute">
        <Loader2 className="w-6 h-6 animate-spin" />
        <div className="mt-3 text-sm">Finding your location…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="rc-label text-[10px] text-rc-ink-mute">
          {SOURCE_LABEL[pinSource].toUpperCase()}
        </div>
        {showLocateButton && (
          <button
            type="button"
            disabled={locating}
            onClick={async () => {
              setLocating(true);
              setLocateError(null);
              const err = await onUseMyLocation();
              setLocating(false);
              if (err) setLocateError(err);
            }}
            className="flex items-center gap-1.5 rounded-lg border border-rc-rule bg-rc-panel px-2.5 py-1.5 text-[12px] font-semibold text-rc-brand hover:bg-rc-surface disabled:opacity-50 transition-colors"
          >
            {locating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <LocateFixed className="w-3.5 h-3.5" />
            )}
            Use my precise location
          </button>
        )}
      </div>
      {locateError && (
        <div className="mb-2 font-rc-mono text-[11px] text-rc-poor-ink">
          {locateError}
        </div>
      )}

      <PinPickerMap
        lat={pin.lat}
        lng={pin.lng}
        onMove={onPinMove}
        candidates={candidates}
        matchedSpotId={match?.id ?? null}
        className="h-[62dvh] min-h-[440px]"
      />

      <div className="mt-4 space-y-3">
        {match ? (
          <>
            <SpotMatchCard match={match} searching={searching} />
            <button
              type="button"
              onClick={() => onUseSpot(match)}
              disabled={searching}
              className="w-full rounded-xl bg-rc-brand hover:bg-rc-brand-hover disabled:opacity-50 px-4 py-3 font-semibold text-white transition-colors"
            >
              Use {match.name}
            </button>
          </>
        ) : (
          <NoSpotCard onCreate={() => setCreateOpen(true)} searching={searching} />
        )}
      </div>

      {createOpen && (
        <CreateSpotModal
          lat={pin.lat}
          lng={pin.lng}
          mgmtArea={mgmtArea}
          onClose={() => setCreateOpen(false)}
          onCreate={async (name) => {
            const err = await onCreateSpot(name);
            if (!err) setCreateOpen(false);
            return err;
          }}
        />
      )}
    </div>
  );
}
