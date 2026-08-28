// Which marks the instrument page leads with, and which one drives its chart.
//
// The hub's `rankSpots` ranks on the FORECAST: peak first, track record only
// as a tie-break. That is the right order for "where should I fish today",
// and it is the wrong order for this page, which is bought traffic landing
// cold. A reader who has never heard of us reads the spot names before they
// read the numbers, and a page whose top card says "Brodie Rock 91" reads as
// a page about nowhere. "Constance Bank 88" reads as a page about Victoria.
//
// So here popularity leads and the score breaks its ties — the mirror of the
// hub. Nothing about the numbers changes: every score on this page is the
// same score the spot page shows for the same water. What changes is which
// mark gets to be first.

import type { HubSpeciesEntry, HubSpot } from "../hub/hub-data";

export interface RankedSpot {
  spot: HubSpot;
  speciesId: string;
  entry: HubSpeciesEntry;
}

/**
 * How well known a mark is, in the words a reader would use.
 *
 * The bands come from catch reports in the trailing year — `popular` is
 * roughly a report a month or better. This is the BADGE only; the ORDER comes
 * from `trackRank`, a finer cut of the same counts (see `rankByRecognition`).
 * Neither is ever a count: those are Pro-gated.
 *
 * There is no web-search signal behind this. Ranking on how often a name
 * appears off-site would need a corpus we do not collect, and inventing one
 * from the same forum scrape the bands already come from would just be this
 * measure wearing a second name.
 */
export function recognitionLabel(spot: HubSpot): string | null {
  switch (spot.trackRecord) {
    case "popular":
      return "Regularly fished";
    case "known":
      return "Known mark";
    default:
      // "sparse" and "unfished" say nothing worth printing. A badge reading
      // "rarely fished" is true and is not what this page is for; the spot
      // still appears, it just does not get a label arguing for it.
      return null;
  }
}

/**
 * The city's marks, best-known first.
 *
 * Report volume, then today's peak, then the daylight mean — the same three
 * measures the hub sorts on, in the opposite order of precedence. Spots that
 * did not score the selected species are dropped rather than ranked last at
 * zero, matching `rankSpots`.
 *
 * ⚠ This bites unevenly, because the intel coverage does. Victoria has 17
 * marks of 18 with a report in the trailing year and Sooke 14 of 18, but
 * Seattle has 3 of 16 — so a Seattle reader gets an order led by three real
 * names and then thirteen marks sorted on score alone. That is a coverage
 * fact, not a bug here, and Seattle is the paid-traffic target, so it is the
 * first thing to look at if this page converts worse there than in Victoria.
 */
export function rankByRecognition(
  spots: HubSpot[],
  speciesId: string | null,
  limit: number,
): RankedSpot[] {
  const rows: RankedSpot[] = [];

  for (const spot of spots) {
    const id = speciesId ?? spot.bestSpeciesId;
    if (!id) continue;
    const entry = spot.bySpecies[id];
    if (!entry) continue;
    rows.push({ spot, speciesId: id, entry });
  }

  // Report volume first — `trackRank` is Infinity for a mark with none, so
  // unfished spots fall to the bottom without a branch. Then today's peak,
  // then the daylight mean, for the marks the ordinal ties.
  //
  // The BAND is not in this comparator. It is derived from the same counts the
  // ordinal is, so sorting on both would be sorting on one measure twice —
  // and the coarser copy would win, which is the defect this replaced: seven
  // Victoria marks share `popular`, so the band handed the tie to today's
  // score and put an 89 for crab at Esquimalt Harbour Entrance above Victoria
  // Waterfront, the most-reported mark in the city. The band still earns the
  // badge; it no longer decides the order.
  rows.sort(
    (a, b) =>
      a.spot.trackRank - b.spot.trackRank ||
      b.entry.peak - a.entry.peak ||
      b.entry.day_mean - a.entry.day_mean,
  );

  return rows.slice(0, limit);
}

/**
 * The one mark the 24-hour chart reads off, chosen on the server.
 *
 * There is no such thing as a city's hourly wind, so the chart under the
 * 14-day strip has to belong to a spot, and the page has to say which. This
 * is that spot: the city's best-known mark, ranked over its ROSTER species
 * rather than a filter, so tapping a chip never moves the chart out from
 * under the reader.
 *
 * Same discipline as the hub's one-window rule — the chart, its conditions
 * strip and the line naming it all read this single row, so they cannot end
 * up describing three different pieces of water.
 */
export function featuredSpot(
  spots: HubSpot[],
  /**
   * The city's headline species, if it has one.
   *
   * The chart follows it wherever the featured mark scored it, and falls back
   * to that mark's own best otherwise. Without this the chart draws whatever
   * peaks highest there today, and on a Victoria August that is Dungeness
   * Crab — a real score for a real fishery, and not the one a salmon town's
   * landing page should be headlining. It never changes WHICH mark is
   * featured, only which species is drawn at it.
   */
  preferredSpeciesId: string | null = null,
): RankedSpot | null {
  const top = rankByRecognition(spots, null, 1)[0];
  if (!top) return null;
  if (!preferredSpeciesId) return top;
  const preferred = top.spot.bySpecies[preferredSpeciesId];
  return preferred
    ? { ...top, speciesId: preferredSpeciesId, entry: preferred }
    : top;
}
