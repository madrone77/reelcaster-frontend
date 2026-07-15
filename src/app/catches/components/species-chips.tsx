"use client";

export interface SpeciesChip {
  key: string; // species_id or species_name
  label: string;
  count: number;
}

/** "All species 37 · Chinook 14 · Coho 9 …" filter chips with counts. */
export default function SpeciesChips({
  chips,
  total,
  active,
  onSelect,
}: {
  chips: SpeciesChip[];
  total: number;
  active: string | null; // null = all
  onSelect: (key: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Chip
        label="All species"
        count={total}
        active={active === null}
        onClick={() => onSelect(null)}
      />
      {chips.map((c) => (
        <Chip
          key={c.key}
          label={c.label}
          count={c.count}
          active={active === c.key}
          onClick={() => onSelect(c.key)}
        />
      ))}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "border-rc-brand text-rc-brand bg-rc-brand-soft/40"
          : "border-rc-rule text-rc-ink-soft bg-rc-panel hover:bg-rc-surface"
      }`}
    >
      {label}
      <span className={`text-[11px] ${active ? "text-rc-brand" : "text-rc-ink-mute"}`}>
        {count}
      </span>
    </button>
  );
}
