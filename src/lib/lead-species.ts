// Which fish a landing page leads with.
//
// Ad traffic arrives cold, so the first fish named has to be the one the
// reader came for. Today's top score is not that fish: the scores inside a
// city cluster within a point or two of each other, so "highest" is close to
// a coin toss between Chinook, Coho and Pink, and the flatter fisheries
// (crab, bottomfish) hold a wide all-day plateau that beats a salmon spike.
// Tacoma's hero read "Pink fishing at Point Defiance" on an 82 with Coho at
// 82 beside it.
//
// So the lead is ranked by what anglers want to catch. Casey's order,
// 2026-09-16: Chinook, Coho, Halibut, Lingcod. Anything else follows, best
// score first, and crab goes last so it only ever leads a spot where it is
// the only species.
//
// Explore's cards have their own list (SPECIES_PREFERENCE in
// explore/lib/explore-data.ts) which includes Chum and ranks crab above
// unlisted species. The two are deliberately separate: this one is the
// landing-page rule.
const LEAD_ORDER = ["chinook", "coho", "halibut", "lingcod"];

/** Lower ranks lead. Unlisted species sit between the named four and crab. */
export function leadSpeciesRank(name: string | null | undefined): number {
  if (!name) return LEAD_ORDER.length;
  const n = name.toLowerCase();
  if (n.includes("crab")) return LEAD_ORDER.length + 1;
  const i = LEAD_ORDER.findIndex((p) => n.includes(p));
  return i === -1 ? LEAD_ORDER.length : i;
}

/**
 * Order species for a landing page: by the list, then by today's score.
 *
 * `score` is what the page would print for that species today; pass a
 * negative number for one that did not score, which keeps it from leading.
 */
export function orderLeadSpecies<T extends { name: string; score: number }>(
  list: T[],
): T[] {
  return [...list].sort((a, b) => {
    const scored = Number(b.score >= 0) - Number(a.score >= 0);
    if (scored !== 0) return scored;
    const rank = leadSpeciesRank(a.name) - leadSpeciesRank(b.name);
    if (rank !== 0) return rank;
    return b.score - a.score;
  });
}

/**
 * Where a hero's lead fish came from, when it came from catches.
 *
 * BlueCaster picks the lead from what is being caught (spot reports, then the
 * city's, then the area's dockside checks) and says which tier decided. The
 * hero turns that into one line, "What's biting now", and shows it ONLY when
 * a tier of evidence picked the fish. A `default` pick is the fixed order
 * and says nothing about the bite, so the line is not shown for it.
 */
export type BitingSource = "spot_reports" | "city_reports" | "creel";

export interface Biting {
  fish: string;
  source: BitingSource;
  /** "Constance Bank" for a spot tier, "Victoria" for a city or area tier. */
  place: string;
}

/**
 * The line itself. Never a count, never a source: report counts are Pro and
 * the forums the spot tier reads must stay unnamed, and the area tier is kept
 * fish, so it says "biting", which is true of a fish that was boxed, and not
 * "caught", which the checks under-count.
 */
export function bitingLine(b: Biting): string {
  switch (b.source) {
    case "spot_reports":
      return `What's biting now at ${b.place}: ${b.fish}`;
    case "city_reports":
      return `What's biting now around ${b.place}: ${b.fish}`;
    case "creel":
      return `What's biting now near ${b.place}: ${b.fish}`;
  }
}

/** Builds the line's input from a payload pick, or null when there is nothing
 *  honest to say: a default pick, or a fish other than the one being shown. */
export function bitingFor(
  pick: { speciesId: string; source: string } | null | undefined,
  shown: { id: string; fish: string } | null,
  places: { spot: string; city: string | null },
): Biting | null {
  if (!pick || !shown || pick.speciesId !== shown.id) return null;
  if (pick.source === "spot_reports") return { fish: shown.fish, source: "spot_reports", place: places.spot };
  if (pick.source === "city_reports" || pick.source === "creel") {
    if (!places.city) return null;
    return { fish: shown.fish, source: pick.source, place: places.city };
  }
  return null;
}
