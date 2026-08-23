// The conversion block at the top of a city page: radar, chips, leaderboard.
//
// One client component owns the species selection because three things
// respond to it — the hero's window, the tactic line and the ranking — and
// splitting the state would let them disagree for a frame.
//
// ── Why the deep link is read on the client ──────────────────────────────
//
// `?species=coho` has to select a chip on arrival. Reading it through the
// route's `searchParams` would opt the whole page out of prerendering, and
// this page's first paint is the entire point of it: a cold reader off an ad
// gets the static HTML from the edge. `useSearchParams` inside a Suspense
// boundary keeps the prerender — the static shell renders with the roster
// default, and the chip snaps to the ad's species on hydration.

"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BlueCasterCityToday } from "@/lib/bluecaster";
import BiteRadar from "./bite-radar";
import SpeciesChips from "./species-chips";
import SpotLeaderboard from "./spot-leaderboard";
import WeekendAlert from "./weekend-alert";
import { rankSpots, type HubData } from "./hub-data";

/** Cards shown at once. Six is the top of the spec's 4 to 6 band. */
const LEADERBOARD_SIZE = 6;

/**
 * `?species=` → a species id, or null.
 *
 * Deliberately tolerant, because the value comes off an ad URL somebody typed
 * into a campaign builder. Exact slug first, then a prefix ("coho" for
 * "coho-salmon"), then the display name. An ambiguous prefix resolves to
 * NOTHING rather than to the first match: "salmon" is five species here, and
 * silently picking one would point the hero at a fish the ad never mentioned.
 */
function resolveSpecies(
  raw: string | null,
  species: HubData["species"],
): string | null {
  if (!raw) return null;
  const q = raw.trim().toLowerCase();
  if (!q) return null;

  const exact = species.find((s) => s.slug.toLowerCase() === q);
  if (exact) return exact.id;

  const byName = species.filter((s) => s.name.toLowerCase() === q);
  if (byName.length === 1) return byName[0].id;

  const prefix = species.filter((s) => s.slug.toLowerCase().startsWith(`${q}-`));
  return prefix.length === 1 ? prefix[0].id : null;
}

/** "Trolling, on cut-plug herring or flashers with hoochies" */
function tacticLine(tactic: { method: string; baits: string[] } | null): string | null {
  if (!tactic) return null;
  const method = tactic.method.charAt(0).toUpperCase() + tactic.method.slice(1);
  if (!tactic.baits.length) return method;
  const baits =
    tactic.baits.length === 1
      ? tactic.baits[0]
      : `${tactic.baits.slice(0, -1).join(", ")} or ${tactic.baits[tactic.baits.length - 1]}`;
  return `${method}, on ${baits}`;
}

export default function CityHub({
  today,
  hub,
  citySlug,
  cityName,
  provinceCode,
  areaLabel,
  areaNumbers,
  tidePhrase,
  children,
}: {
  today: BlueCasterCityToday | null;
  hub: HubData;
  citySlug: string;
  cityName: string;
  provinceCode: string;
  areaLabel: string;
  areaNumbers: string[];
  tidePhrase: string | null;
  /** The regulations section, which belongs between the leaderboard and the
   *  signup form. It is a server component passed through rather than
   *  rebuilt here, so none of that markup ships as JavaScript. */
  children?: React.ReactNode;
}) {
  const params = useSearchParams();
  const [override, setOverride] = useState<string | null | undefined>(undefined);

  // undefined = the reader has not touched a chip, so the ad's species (if
  // any) still governs. null = they explicitly chose All.
  const fromUrl = resolveSpecies(params.get("species"), hub.species);
  const selected = override === undefined ? fromUrl : override;

  // The hero follows the chip when one is picked, and the city's ROSTER
  // headline otherwise — never today's top scorer. Ranking by score surfaces
  // the flattest species, which would headline crabbing in a Chinook town
  // every day and be arithmetically correct every time.
  const heroSpecies = useMemo(() => {
    if (!today) return null;
    if (selected) {
      return today.species.find((s) => s.species_id === selected) ?? today.headline;
    }
    return today.headline;
  }, [today, selected]);

  const rows = useMemo(() => {
    const nameById = new Map(hub.species.map((s) => [s.id, s.name]));
    return rankSpots(hub.spots, selected, LEADERBOARD_SIZE).map((row) => ({
      ...row,
      speciesName: nameById.get(row.speciesId) ?? "",
    }));
  }, [hub.spots, hub.species, selected]);

  /**
   * Chips, with the hero's species first.
   *
   * `buildHubData` orders them by how well they score, which is the right
   * default and the wrong first entry: the hero follows the city's target
   * roster, so on a day when a plateau species out-means the target, the
   * chip bar would open on a fish the headline is not talking about.
   */
  const chips = useMemo(() => {
    const headId = today?.headline?.species_id;
    if (!headId) return hub.species;
    const head = hub.species.find((s) => s.id === headId);
    if (!head) return hub.species;
    return [head, ...hub.species.filter((s) => s.id !== headId)];
  }, [hub.species, today]);

  const selectedSpecies = selected
    ? (hub.species.find((s) => s.id === selected) ?? null)
    : null;

  /**
   * Reflect the chip in the URL so the view is shareable and so a reload
   * lands where the reader was.
   *
   * `history.replaceState`, never `router.replace`. This is a dynamic route,
   * and a router navigation here re-runs the server render and round-trips
   * the whole page for what is a local filter.
   */
  const select = useCallback(
    (id: string | null, slug: string | null) => {
      setOverride(id);
      if (typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (slug) url.searchParams.set("species", slug);
      else url.searchParams.delete("species");
      window.history.replaceState(null, "", url);
    },
    [],
  );

  const tactic = tacticLine(heroSpecies?.tactic ?? null);

  return (
    <div className="space-y-5">
      <BiteRadar
        cityName={cityName}
        provinceCode={provinceCode}
        areaLabel={areaLabel}
        areaNumbers={areaNumbers}
        verdict={today?.verdict ?? null}
        species={heroSpecies}
        conditions={today?.conditions ?? null}
        scoredSpots={today?.coverage.scored_spots ?? hub.spots.length}
        memberSpots={today?.coverage.member_spots ?? hub.spots.length}
        tideStationName={today?.tide_station?.name ?? null}
        tidePhrase={tidePhrase}
      />

      <SpeciesChips
        species={chips}
        selected={selected}
        totalSpots={hub.spots.length}
        onSelect={(id) =>
          select(id, id ? (hub.species.find((s) => s.id === id)?.slug ?? null) : null)
        }
      />

      {tactic && heroSpecies && (
        <p className="font-rc-mono text-[11px] text-rc-ink-mute">
          {/* City grain, said out loud. The wizard profiles methods per city
              and species and there is no per-spot technique data anywhere,
              so this must not sit on a card and imply otherwise. */}
          How {cityName} fishes {heroSpecies.species_name}: {tactic}
        </p>
      )}

      <SpotLeaderboard
        rows={rows}
        speciesName={selectedSpecies?.name ?? null}
        cityName={cityName}
      />

      {children}

      <WeekendAlert
        citySlug={citySlug}
        cityName={cityName}
        provinceCode={provinceCode}
        speciesSlug={selectedSpecies?.slug ?? null}
      />
    </div>
  );
}
