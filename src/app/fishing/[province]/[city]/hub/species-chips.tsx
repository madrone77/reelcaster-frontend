// Horizontal species filter.
//
// Chips are built from what actually SCORED in this city today, not from the
// roster. A city can carry a species on its roster all year and have nothing
// scoring it this morning, and a chip that filters a list to nothing is a
// dead end dressed as a control. Seattle in late August offers two chips, and
// two honest chips beat five that mostly empty the page.

"use client";

import type { HubSpecies } from "./hub-data";

export default function SpeciesChips({
  species,
  selected,
  totalSpots,
  onSelect,
}: {
  species: HubSpecies[];
  selected: string | null;
  totalSpots: number;
  onSelect: (id: string | null) => void;
}) {
  if (species.length < 2) return null;

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
      active
        ? "border-rc-brand bg-rc-brand text-white"
        : "border-rc-rule bg-rc-panel text-rc-ink-soft hover:border-rc-brand hover:text-rc-ink"
    }`;

  return (
    // Scrolls itself rather than the page. Chips are a phone-first control
    // and there are more of them than fit a 390px column.
    <div
      className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
      role="group"
      aria-label="Filter spots by species"
    >
      <button
        type="button"
        className={chip(selected === null)}
        aria-pressed={selected === null}
        onClick={() => onSelect(null)}
      >
        All ({totalSpots})
      </button>
      {species.map((s) => (
        <button
          key={s.id}
          type="button"
          className={chip(selected === s.id)}
          aria-pressed={selected === s.id}
          onClick={() => onSelect(s.id)}
        >
          {s.name} ({s.spotCount})
        </button>
      ))}
    </div>
  );
}
