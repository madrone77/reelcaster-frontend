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
