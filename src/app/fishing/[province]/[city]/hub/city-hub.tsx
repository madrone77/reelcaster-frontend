// The conversion block at the top of a city page: radar, chips, spotlight,
// leaderboard, regulations, signup.
//
// One client component owns the species selection because four things respond
// to it — the hero's window, the spotlight, the tactic line and the ranking —
// and splitting the state would let them disagree for a frame.
//
// ── Why the default is the headline species, not "All" ───────────────────
//
// "All" ranks each spot on whatever it scores best, and crab and bottomfish
// hold a wide all-day plateau while salmon spike around the exchange. On
// Victoria that produced a hero reading "6 fishable hours for Chinook Salmon"
// directly above a leaderboard whose top three were crab and halibut water.
// Both halves were correct and the page contradicted itself, which is exactly
// the mental-model break that loses a cold reader. The list now opens on the
// fish the hero is talking about, and "All" is one tap away.
//
// ── Why the deep link is read on the client ──────────────────────────────
//
// `?species=coho` has to select a chip on arrival. Reading it through the
// route's `searchParams` would opt the whole page out of prerendering, and
// this page's first paint is the entire point of it: a cold reader off an ad
// gets static HTML from the edge. `useSearchParams` inside a Suspense
// boundary keeps the prerender — the static shell renders with the roster
// default, and the chip snaps to the ad's species on hydration.

"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { BlueCasterCityToday } from "@/lib/bluecaster";
import BiteRadar from "./bite-radar";
import SpeciesChips from "./species-chips";
import SpotSpotlight from "./spot-spotlight";
import SpotLeaderboard from "./spot-leaderboard";
import WeekendAlert from "./weekend-alert";
import {
  assignBadges,
  cellAt,
  chopLabel,
  phaseAt,
  rankSpots,
  type HubData,
} from "./hub-data";

/** The spotlight plus four runners-up. Five marks is the top of the spec's
 *  band once the featured one is counted. */
const LEADERBOARD_SIZE = 5;

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

/**
 * "Downrigger trolling, anchovy in teaser head".
 *
 * ONE bait, not the profile's full list. Victoria Chinook carries three, and
 * spelling them all out ran the spotlight's tactic pill to six lines and made
 * a glanceable card into a paragraph. The first is the profile's own leading
 * bait, and the species guide behind the card carries the rest.
 */
function tacticLine(
  tactic: { method: string; baits: string[] } | null,
): string | null {
  if (!tactic) return null;
  const method = tactic.method.charAt(0).toUpperCase() + tactic.method.slice(1);
  return tactic.baits.length ? `${method}, ${tactic.baits[0]}` : method;
}

export default function CityHub({
  today,
  hub,
  citySlug,
  cityName,
  provinceCode,
  areaLabel,
  areaNumbers,
  children,
}: {
  today: BlueCasterCityToday | null;
  hub: HubData;
  citySlug: string;
  cityName: string;
  provinceCode: string;
  areaLabel: string;
  areaNumbers: string[];
  /** The regulations section, which belongs between the leaderboard and the
   *  signup form. Passed through as children rather than rebuilt here so the
   *  page keeps deciding what goes in that slot; it owns its own collapse
   *  state and does not need anything from this component's. */
  children?: React.ReactNode;
}) {
  const params = useSearchParams();
  const [override, setOverride] = useState<string | null | undefined>(undefined);

  const headlineId = today?.headline?.species_id ?? null;
  const fromUrl = resolveSpecies(params.get("species"), hub.species);

  // undefined = the reader has not touched a chip, so the ad's species wins,
  // then the roster headline. null = they explicitly chose All.
  const selected = override === undefined ? (fromUrl ?? headlineId) : override;

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

  // The featured mark and the list under it come off ONE ranking, split. The
  // alternative — ranking twice — is how a "top water" card ends up naming a
  // spot the list below it puts third.
  const [featured, ...rest] = rows;

  // Badges are assigned over the RUNNERS-UP, not the whole set. They are
  // superlatives, and the featured spot would win most of them by being
  // featured — spending "best current window" on the card that is already
  // three times the size of the others leaves the four that need
  // differentiating with nothing.
  const badges = useMemo(() => assignBadges(rest), [rest]);

  /**
   * Chips, with the hero's species first.
   *
   * `buildHubData` orders them by how well they score, which is the right
   * default and the wrong first entry: the hero follows the city's target
   * roster, so on a day when a plateau species out-scores the target the chip
   * bar would open on a fish the headline is not talking about.
   */
  const chips = useMemo(() => {
    if (!headlineId) return hub.species;
    const head = hub.species.find((s) => s.id === headlineId);
    if (!head) return hub.species;
    return [head, ...hub.species.filter((s) => s.id !== headlineId)];
  }, [hub.species, headlineId]);

  const selectedSpecies = selected
    ? (hub.species.find((s) => s.id === selected) ?? null)
    : null;

  /**
   * Reflect the chip in the URL so the view is shareable and a reload lands
   * where the reader was.
   *
   * `history.replaceState`, never `router.replace`. This is a dynamic route,
   * and a router navigation re-runs the server render and round-trips the
   * whole page for what is a local filter.
   */
  const select = useCallback((id: string | null, slug: string | null) => {
    setOverride(id);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("species", slug);
    else url.searchParams.delete("species");
    window.history.replaceState(null, "", url);
  }, []);

  const tactic = tacticLine(heroSpecies?.tactic ?? null);

  /**
   * Why the featured mark leads, said in the reader's terms.
   *
   * The denominator has to follow the FILTER, not the species on the card.
   * Under a chip, every ranked spot holds that species and "top of 4
   * Dungeness Crab spots" is exactly true. On "All" each spot ranks on its
   * own best fish, so the pool is every spot in the city — and borrowing the
   * featured card's species for that sentence produced "top of 18 Dungeness
   * Crab spots" in a city with four of them.
   */
  const rankLine = featured
    ? selectedSpecies
      ? `Top of ${selectedSpecies.spotCount} fished ${selectedSpecies.name} spot${
          selectedSpecies.spotCount === 1 ? "" : "s"
        } around ${cityName} today`
      : `Top of ${hub.spots.length} fished spot${
          hub.spots.length === 1 ? "" : "s"
        } around ${cityName} today, on ${featured.speciesName}`
    : "";

  // Sea state at the hero's own peak hour, read off the featured spot — the
  // one mark the page is actually sending someone to.
  const chop = featured
    ? chopLabel(cellAt(featured.spot, featured.entry.peak_hour))
    : null;

  /**
   * "on the late ebb" for the hero, from the SAME hour the hero's window
   * opens at the SAME mark.
   *
   * It used to be computed on the server against BlueCaster's leading spot
   * and its peak hour, which made it a third source of truth about one
   * sentence: the window came from one mark, the phase from another, and the
   * card underneath showed a third.
   */
  const featuredPhase = featured
    ? phaseAt(featured.spot, featured.entry.window?.start_hour ?? null)
    : null;
  const heroPhrase = featuredPhase ? `on the ${featuredPhase.toLowerCase()}` : null;

  return (
    <div className="space-y-5">
      <BiteRadar
        cityName={cityName}
        provinceCode={provinceCode}
        areaLabel={areaLabel}
        areaNumbers={areaNumbers}
        verdict={today?.verdict ?? null}
        species={heroSpecies}
        // One window on the page, not two. Both the hero and the spotlight
        // describe TODAY'S TOP WATER, so both read it off the same row.
        window={featured?.entry.window ?? heroSpecies?.window ?? null}
        goodHours={featured?.entry.good_hours ?? heroSpecies?.good_hours ?? 0}
        conditions={today?.conditions ?? null}
        chop={chop}
        scoredSpots={today?.coverage.scored_spots ?? hub.spots.length}
        memberSpots={today?.coverage.member_spots ?? hub.spots.length}
        reports={today?.intel?.reports ?? 0}
        reportWindowDays={today?.intel?.window_days ?? 21}
        tideStationName={today?.tide_station?.name ?? null}
        tidePhrase={heroPhrase}
      />

      <SpeciesChips
        species={chips}
        selected={selected}
        totalSpots={hub.spots.length}
        onSelect={(id) =>
          select(id, id ? (hub.species.find((s) => s.id === id)?.slug ?? null) : null)
        }
      />

      {!featured && (
        <p className="rounded-xl border border-dashed border-rc-rule px-4 py-6 text-center text-[14px] leading-relaxed text-rc-ink-soft">
          {/* Honest rather than empty. The alternative is back-filling with
              marks nobody has reported from, which is the exact thing this
              pool exists to keep off the page. The map below still carries
              the whole roster. */}
          No catch reports have come in from{" "}
          {selectedSpecies ? `${selectedSpecies.name} water` : "spots"} around{" "}
          {cityName} this year. The map below shows every spot we score.
        </p>
      )}

      {featured && (
        <SpotSpotlight
          spot={featured.spot}
          entry={featured.entry}
          rankLine={rankLine}
          phase={featuredPhase}
          tactic={tactic}
          cityName={cityName}
        />
      )}

      <SpotLeaderboard
        rows={rest}
        badges={badges}
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
