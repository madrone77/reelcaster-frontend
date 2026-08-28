"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { formatCoords } from "./types";

/**
 * "Create a custom spot" modal (mock parity): SPOT NAME free text,
 * COORDINATES + MGMT AREA auto-filled and read-only. Submits through the
 * shell's onCreate (authed proxy → BlueCaster custom-spot endpoint).
 */
export default function CreateSpotModal({
  lat,
  lng,
  mgmtArea,
  onCreate,
  onClose,
}: {
  lat: number;
  lng: number;
  mgmtArea: string | null; // "DFO 19-3" / "WDFW 9" — regulator included
  onCreate: (name: string) => Promise<string | null>; // resolves error message or null
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    const err = await onCreate(trimmed);
    if (err) {
      setError(err);
      setBusy(false);
    }
    // On success the shell closes the modal and advances.
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-rc-ink/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-sm rounded-2xl bg-rc-panel border border-rc-rule shadow-rc-panel p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 text-rc-ink-mute hover:text-rc-ink transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-rc-ink">Create a custom spot</h2>
        <p className="mt-1 text-[13px] text-rc-ink-soft">
          Adds the location to Explore so it gets daily forecasts and scoring.
        </p>

        <label className="mt-4 block">
          <span className="rc-label text-[9px] text-rc-ink-mute">SPOT NAME</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={80}
            placeholder="The Hump"
            className="mt-1 w-full rounded-lg border-2 border-rc-brand bg-rc-panel px-3 py-2 text-rc-ink focus:outline-none"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between">
              <span className="rc-label text-[9px] text-rc-ink-mute">COORDINATES</span>
              <span className="rc-label text-[9px] text-rc-good-ink">AUTO</span>
            </div>
            <div className="mt-1 rounded-lg border border-rc-good-ink/30 bg-rc-good-bg px-3 py-2 font-rc-mono text-[12px] text-rc-ink truncate">
              {formatCoords(lat, lng)}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <span className="rc-label text-[9px] text-rc-ink-mute">MGMT AREA</span>
              <span className="rc-label text-[9px] text-rc-good-ink">AUTO</span>
            </div>
            <div className="mt-1 rounded-lg border border-rc-good-ink/30 bg-rc-good-bg px-3 py-2 font-rc-mono text-[12px] text-rc-ink truncate">
              {mgmtArea ?? "—"}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-rc-poor-bg text-rc-poor-ink text-[13px] px-3 py-2">
            {error}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-rc-rule bg-rc-panel px-4 py-2.5 font-semibold text-rc-ink hover:bg-rc-surface transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || busy}
            className="flex-1 rounded-xl bg-rc-brand hover:bg-rc-brand-hover disabled:opacity-50 px-4 py-2.5 font-semibold text-white transition-colors flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Create &amp; use spot
          </button>
        </div>
      </div>
    </div>
  );
}
