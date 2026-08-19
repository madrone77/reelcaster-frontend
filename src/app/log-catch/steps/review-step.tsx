"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import PinPickerMap from "@/app/components/location/pin-picker-map";
import type {
  CatchSnapshot,
  NearestSpotHit,
} from "@/lib/bluecaster/catch-ingest-types";
import VisionBadge from "../wizard/vision-badge";
import SpeciesPicker from "../wizard/species-picker";
import StatRow from "../wizard/stat-row";
import ConditionsGrid from "../wizard/conditions-grid";
import CreateSpotModal from "../wizard/create-spot-modal";
import { SpotMatchCard, NoSpotCard } from "../wizard/spot-match-card";
import {
  formatCoords,
  type SelectedSpot,
  type SpeciesChoice,
  type ScoreSnapshot,
  type SnapshotOverrides,
  type StatDraft,
} from "../wizard/types";

/**
 * Step 4 — the review screen (mock parity): photo + vision badge, species +
 * confidence + "Not right?", editable meta line, stat row, AUTO conditions
 * grid, adjustable location map, and the Save-as-draft / Save-catch footer.
 */
export default function ReviewStep({
  photoUrl,
  fishDetected,
  species,
  speciesAtSpot,
  caughtAtNaive,
  pin,
  spot,
  match,
  candidates,
  mgmtArea,
  searching,
  snapshot,
  snapshotLoading,
  overrides,
  scoreSnapshot,
  stats,
  saving,
  onChangePhoto,
  draftButton,
  saveLabel,
  onSpeciesChange,
  onTimeChange,
  onPinMove,
  onCreateSpot,
  onOverride,
  onStatsChange,
  onSave,
}: {
  photoUrl: string | null;
  fishDetected: boolean;
  species: SpeciesChoice | null;
  speciesAtSpot: Array<{ id: string; name: string; slug: string | null }>;
  caughtAtNaive: string | null;
  pin: { lat: number; lng: number };
  spot: SelectedSpot | null;
  match: NearestSpotHit | null;
  candidates: NearestSpotHit[];
  mgmtArea: string | null;
  searching: boolean;
  snapshot: CatchSnapshot | null;
  snapshotLoading: boolean;
  overrides: SnapshotOverrides;
  scoreSnapshot: ScoreSnapshot;
  stats: StatDraft;
  saving: "draft" | "logged" | null;
  /** Omit to hide the Change photo button (detail/edit mode). */
  onChangePhoto?: () => void;
  /** false hides the secondary draft button (editing an already-logged catch). */
  draftButton?: boolean;
  /** Primary button label; defaults to the wizard's "Save catch ✓". */
  saveLabel?: string;
  onSpeciesChange: (choice: SpeciesChoice) => void;
  onTimeChange: (naive: string) => void;
  onPinMove: (lat: number, lng: number) => void;
  onCreateSpot: (name: string) => Promise<string | null>;
  onOverride: (key: keyof SnapshotOverrides, value: number | undefined) => void;
  onStatsChange: (patch: Partial<StatDraft>) => void;
  onSave: (status: "draft" | "logged") => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const caughtDate = caughtAtNaive ? new Date(caughtAtNaive) : null;
  const dateLabel =
    caughtDate && Number.isFinite(caughtDate.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }).format(caughtDate)
      : "—";
  const timeLabel =
    caughtDate && Number.isFinite(caughtDate.getTime())
      ? new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }).format(caughtDate)
      : "—";

  const speciesName = species?.name ?? "Unknown species";

  return (
    <div className="pb-28">
      {/* Photo */}
      {(photoUrl || onChangePhoto) && (
        <div className="relative rounded-2xl bg-rc-ink overflow-hidden">
          {photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Your catch"
              className="mx-auto max-h-[440px] object-contain"
            />
          )}
          <div className="absolute bottom-3 left-3">
            <VisionBadge fishDetected={fishDetected} />
          </div>
          {onChangePhoto && (
            <button
              type="button"
              onClick={onChangePhoto}
              className="absolute bottom-3 right-3 rounded-lg bg-rc-panel px-3 py-1.5 text-[13px] font-semibold text-rc-ink hover:bg-rc-surface transition-colors"
            >
              Change photo
            </button>
          )}
        </div>
      )}

      {/* Species header */}
      <div className="mt-5 relative">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">
            {speciesName}
          </h1>
          {species?.confidence !== null && species?.confidence !== undefined && (
            <span className="rounded-md bg-rc-brand-soft px-2 py-1 font-rc-mono text-[12px] font-semibold text-rc-brand">
              {Math.round(species.confidence * 100)}%
            </span>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="text-[14px] font-semibold text-rc-brand hover:underline"
          >
            Not right?
          </button>
        </div>
        {pickerOpen && (
          <SpeciesPicker
            speciesAtSpot={speciesAtSpot}
            onClose={() => setPickerOpen(false)}
            onSelect={(choice) => {
              setPickerOpen(false);
              onSpeciesChange(choice);
            }}
          />
        )}

        {/* Meta line */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 font-rc-mono text-[13px] text-rc-ink-soft">
          <span>{spot?.name ?? "No mapped spot"}</span>
          <span>·</span>
          {editingTime ? (
            <input
              autoFocus
              type="datetime-local"
              defaultValue={caughtAtNaive?.slice(0, 16) ?? undefined}
              onBlur={(e) => {
                setEditingTime(false);
                if (e.target.value) onTimeChange(e.target.value + ":00");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") setEditingTime(false);
              }}
              className="rounded-md border border-rc-brand bg-rc-panel px-2 py-0.5 text-[13px] text-rc-ink focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTime(true)}
              title="Edit catch time"
              className="hover:text-rc-brand transition-colors"
            >
              {dateLabel} · {timeLabel}
            </button>
          )}
          <span>·</span>
          <span>{formatCoords(pin.lat, pin.lng)}</span>
        </div>
      </div>

      {/* Stat row */}
      <div className="mt-5">
        <StatRow stats={stats} onChange={onStatsChange} />
      </div>

      {/* Conditions */}
      <div className="mt-8">
        <div className="flex items-center justify-between border-b border-rc-rule pb-2">
          <h2 className="rc-label text-[11px] font-bold text-rc-ink tracking-wider">
            CONDITIONS AT CATCH TIME
          </h2>
          <span className="flex items-center gap-1.5 font-rc-mono text-[11px] text-rc-ink-mute">
            <span className="w-1.5 h-1.5 rounded-full bg-rc-ink-mute" />
            Auto-filled from snapshot
          </span>
        </div>
        <div className="mt-3">
          <ConditionsGrid
            snapshot={snapshot}
            overrides={overrides}
            onOverride={onOverride}
            speciesName={species?.name ?? null}
            loading={snapshotLoading}
          />
        </div>
      </div>

      {/* Location */}
      <div className="mt-8">
        <div className="flex items-center justify-between border-b border-rc-rule pb-2">
          <h2 className="rc-label text-[11px] font-bold text-rc-ink tracking-wider">
            LOCATION
          </h2>
          <span className="font-rc-mono text-[11px] text-rc-ink-mute">
            drag the pin to adjust
          </span>
        </div>
        <div className="mt-3 space-y-3">
          <PinPickerMap
            lat={pin.lat}
            lng={pin.lng}
            onMove={onPinMove}
            candidates={candidates}
            matchedSpotId={spot?.id ?? match?.id ?? null}
            className="h-[300px]"
          />
          {match ? (
            <SpotMatchCard match={match} searching={searching} />
          ) : (
            <NoSpotCard onCreate={() => setCreateOpen(true)} searching={searching} />
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mt-8">
        <h2 className="rc-label text-[11px] font-bold text-rc-ink tracking-wider border-b border-rc-rule pb-2">
          NOTES
        </h2>
        <textarea
          value={stats.notes}
          onChange={(e) => onStatsChange({ notes: e.target.value })}
          rows={2}
          placeholder="Bite details, depth notes, what was working…"
          className="mt-3 w-full rounded-xl border border-rc-rule bg-rc-panel px-4 py-3 text-sm text-rc-ink placeholder:text-rc-ink-mute focus:outline-none focus:border-rc-brand"
        />
      </div>

      {/* Sticky footer. On phones it rides above the floating tab bar, which
          otherwise sits on top of the save buttons; the clearance is 0 on
          desktop, where the bar is hidden. */}
      <div
        style={{ bottom: "var(--rc-tabbar-clearance)" }}
        className="fixed inset-x-0 z-40 border-t border-rc-rule bg-rc-panel/95 backdrop-blur"
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 py-4">
          <div className="min-w-0">
            <div className="text-[15px] text-rc-ink truncate">
              Caught a <span className="font-semibold">{speciesName}</span>
              {spot ? (
                <>
                  {" "}at <span className="font-semibold">{spot.name}</span>
                </>
              ) : null}
            </div>
            {scoreSnapshot.status === "scored" && scoreSnapshot.score !== null && (
              <div className="font-rc-mono text-[11px] text-rc-ink-mute">
                Score at catch time: {scoreSnapshot.score}
              </div>
            )}
            {scoreSnapshot.status === "pending" && (
              <div className="font-rc-mono text-[11px] text-rc-ink-mute">
                Score pending. New spot scores on the next forecast run
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {draftButton !== false && (
              <button
                type="button"
                disabled={saving !== null}
                onClick={() => onSave("draft")}
                className="rounded-xl border border-rc-rule bg-rc-panel px-4 py-2.5 font-semibold text-rc-ink hover:bg-rc-surface disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving === "draft" && <Loader2 className="w-4 h-4 animate-spin" />}
                Save as draft
              </button>
            )}
            <button
              type="button"
              disabled={saving !== null}
              onClick={() => onSave("logged")}
              className="rounded-xl bg-rc-brand hover:bg-rc-brand-hover px-5 py-2.5 font-semibold text-white disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving === "logged" && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveLabel ?? "Save catch ✓"}
            </button>
          </div>
        </div>
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
