"use client";

import { Plus } from "lucide-react";
import type { StatDraft } from "./types";

/**
 * WEIGHT / LENGTH / LURE / DEPTH strip (mock parity: "14 lb · 28 in ·
 * Flasher + hoochie · + Add"). Imperial free-text inputs; converted to
 * metric on save.
 */
export default function StatRow({
  stats,
  onChange,
}: {
  stats: StatDraft;
  onChange: (patch: Partial<StatDraft>) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 rounded-xl border border-rc-rule bg-rc-panel divide-x divide-rc-rule overflow-hidden">
      <StatCell
        label="WEIGHT"
        value={stats.weightLb}
        placeholder="14"
        suffix="lb"
        onChange={(v) => onChange({ weightLb: v })}
      />
      <StatCell
        label="LENGTH"
        value={stats.lengthIn}
        placeholder="28"
        suffix="in"
        onChange={(v) => onChange({ lengthIn: v })}
      />
      <div className="px-4 py-3">
        <input
          value={stats.lure}
          onChange={(e) => onChange({ lure: e.target.value })}
          placeholder="Flasher + hoochie"
          className="w-full bg-transparent text-lg font-bold text-rc-ink placeholder:text-rc-ink-mute/60 focus:outline-none"
        />
        <div className="rc-label text-[9px] text-rc-ink-mute mt-0.5">LURE</div>
      </div>
      <div className="px-4 py-3">
        {stats.depthFt === "" ? (
          <button
            type="button"
            onClick={() => onChange({ depthFt: "0" })}
            className="flex items-center gap-1 text-lg font-bold text-rc-fair-ink hover:opacity-80 transition-opacity"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        ) : (
          <div className="flex items-baseline gap-1">
            <input
              autoFocus
              type="number"
              min={0}
              value={stats.depthFt}
              onChange={(e) => onChange({ depthFt: e.target.value })}
              className="w-16 bg-transparent text-lg font-bold text-rc-ink focus:outline-none"
            />
            <span className="text-sm text-rc-ink-mute">ft</span>
          </div>
        )}
        <div className="rc-label text-[9px] text-rc-ink-mute mt-0.5">DEPTH</div>
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  placeholder,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  suffix: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-16 bg-transparent text-lg font-bold text-rc-ink placeholder:text-rc-ink-mute/60 focus:outline-none"
        />
        <span className="text-sm text-rc-ink-mute">{suffix}</span>
      </div>
      <div className="rc-label text-[9px] text-rc-ink-mute mt-0.5">{label}</div>
    </div>
  );
}
