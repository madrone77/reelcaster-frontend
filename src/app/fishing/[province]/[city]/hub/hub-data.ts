// Leaderboard data, derived from the same map/spots payload the map draws.
//
// This does NOT reuse Explore's `RailSpot`. RailSpot keeps one 24-hour strip —
// the best species' — plus a peak per species, which is enough to rank cards
// but not enough to give each card a clock window for the species the reader
// picked. The raw payload carries every species' full strip, so the derivation
// happens here instead of being reconstructed from a lossy intermediate.

import type { MapSpeciesStrip, MapSpotsPayload } from "@/lib/bluecaster";

/**
 * Hours within this fraction of the peak count as "good".
 *
 * 0.05 is not a local choice: it mirrors GOOD_BAND in BlueCaster's
 * `build-city-today.ts`. The hero's window and a spot card's window are two
 * renderings of the same idea, and a page that computed them from different
 * bands would show "best 6:30 to 8:30" above a card reading "7 to 11".
 */
const GOOD_BAND = 0.05;

/** The daylight bounds the scoring fold uses. Nothing outside them is a
 *  window anyone is being sent to. */
const DAY_START_HOUR = 5;
const DAY_END_HOUR = 21;

export interface HubWindow {
  start_hour: number;
  end_hour: number;
}

export interface HubSpeciesEntry {
  /** 0–100. */
  peak: number;
  peak_hour: number;
  /**
   * Daylight mean, 0–100. The leaderboard's TIE-BREAK, not its badge.
   *
   * Peak alone cannot order these. Since the midday rescale a healthy Seattle
   * day peaks 89 to 92 at a dozen marks at once, so sorting on it yields
   * 91, 91, 91, 90, 90 with the order inside each group decided by whatever
   * the payload happened to list first. The mean is what separates a wide
   * plateau from a sharp dawn bite, so it breaks those ties — and it is the
   * same measure BlueCaster ranks on upstream.
   *
   * It is not the number on the badge. A card showing the mean would
   * disagree with the score the spot page shows for the same water, and a
   * reader who taps through to find a different number stops trusting both.
   */
  day_mean: number;
  /** Contiguous good run around the peak, or null if the peak sits outside
   *  daylight. */
  window: HubWindow | null;
}

export interface HubSpot {
  id: string;
  slug: string;
  name: string;
  /** Keyed by species id. Absent species simply did not score here today. */
  bySpecies: Record<string, HubSpeciesEntry>;
  /** Highest-peaking species at this spot, for the unfiltered ranking. */
  bestSpeciesId: string | null;
}

export interface HubSpecies {
  id: string;
  slug: string;
  name: string;
  /** How many spots scored this species today — the number on the chip. */
  spotCount: number;
  /** Best peak across the city, used to order the chips. */
  bestPeak: number;
}

export interface HubData {
  date: string;
  spots: HubSpot[];
  species: HubSpecies[];
}

/**
 * The contiguous run of good hours around the peak.
 *
 * Walks outward and stops at the first hour that drops out of the band, for
 * the same reason BlueCaster does: `good_hours` as a count can be a dawn bite
 * plus an evening one, and printing that as one span is a lie about the
 * middle of the day.
 */
function windowAround(
  strip: MapSpeciesStrip,
): HubWindow | null {
  const { peak, peak_hour, hours } = strip;
  if (peak_hour < DAY_START_HOUR || peak_hour > DAY_END_HOUR) return null;
  const floor = peak - GOOD_BAND;
  const at = (h: number): number | null => hours[h]?.s ?? null;
  if (at(peak_hour) == null) return null;

  let start = peak_hour;
  let end = peak_hour;
  while (start - 1 >= DAY_START_HOUR && (at(start - 1) ?? -1) >= floor) start--;
  while (end + 1 <= DAY_END_HOUR && (at(end + 1) ?? -1) >= floor) end++;
  return { start_hour: start, end_hour: end };
}

/** Scores arrive 0..1 and are multiplied by 100 exactly once, here. */
function pct(score: number): number {
  return Math.round(score * 100);
}

/** Mean of the daylight hours that scored. Hours with no score are skipped
 *  rather than counted as zero, which would punish a spot for a gap in the
 *  feed instead of for the fishing. */
function daylightMean(strip: MapSpeciesStrip): number {
  let sum = 0;
  let n = 0;
  for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
    const v = strip.hours[h]?.s;
    if (typeof v === "number") {
      sum += v;
      n += 1;
    }
  }
  return n === 0 ? pct(strip.peak) : pct(sum / n);
}

export function buildHubData(
  payload: MapSpotsPayload | null,
  /** Spot ids the page is actually rendering. The payload is already scoped
   *  to the city, but a shared spot can be a member of another city too, so
   *  the caller's set is what decides. */
  inCity: Set<string>,
): HubData {
  if (!payload) return { date: "", spots: [], species: [] };

  const spotCountBySpecies = new Map<string, number>();
  const bestPeakBySpecies = new Map<string, number>();

  const spots: HubSpot[] = [];

  for (const entry of payload.spots) {
    if (!inCity.has(entry.id)) continue;

    const bySpecies: Record<string, HubSpeciesEntry> = {};
    let bestId: string | null = null;
    let bestPeak = -1;

    for (const [speciesId, strip] of Object.entries(entry.scores)) {
      const peak = pct(strip.peak);
      bySpecies[speciesId] = {
        peak,
        peak_hour: strip.peak_hour,
        day_mean: daylightMean(strip),
        window: windowAround(strip),
      };
      if (peak > bestPeak) {
        bestPeak = peak;
        bestId = speciesId;
      }
      spotCountBySpecies.set(
        speciesId,
        (spotCountBySpecies.get(speciesId) ?? 0) + 1,
      );
      const seen = bestPeakBySpecies.get(speciesId) ?? -1;
      if (peak > seen) bestPeakBySpecies.set(speciesId, peak);
    }

    spots.push({
      id: entry.id,
      slug: entry.slug,
      name: entry.name,
      bySpecies,
      bestSpeciesId: bestId,
    });
  }

  const species: HubSpecies[] = [...spotCountBySpecies.entries()]
    .map(([id, spotCount]) => ({
      id,
      slug: payload.species[id]?.slug ?? id,
      name: payload.species[id]?.name ?? "Unknown",
      spotCount,
      bestPeak: bestPeakBySpecies.get(id) ?? 0,
    }))
    // Chips are ordered by how good the fishing is, which is the order
    // someone scanning them cares about. The hero's headline species is
    // pinned to the front by the caller, because that follows the city's
    // target roster rather than today's arithmetic.
    .sort((a, b) => b.bestPeak - a.bestPeak);

  return { date: payload.date, spots, species };
}

/**
 * The leaderboard for one species, or for "best species per spot" when
 * `speciesId` is null.
 *
 * Ranked on the peak, descending. Spots that did not score the selected
 * species are dropped rather than ranked last at zero: a chip that says
 * "Coho (7)" and then lists sixteen cards, nine of them blank, is worse than
 * one that lists seven.
 */
export function rankSpots(
  spots: HubSpot[],
  speciesId: string | null,
  limit: number,
): Array<{ spot: HubSpot; speciesId: string; entry: HubSpeciesEntry }> {
  const rows: Array<{ spot: HubSpot; speciesId: string; entry: HubSpeciesEntry }> = [];

  for (const spot of spots) {
    const id = speciesId ?? spot.bestSpeciesId;
    if (!id) continue;
    const entry = spot.bySpecies[id];
    if (!entry) continue;
    rows.push({ spot, speciesId: id, entry });
  }

  // Peak first so the badges descend and the number on the card is the
  // number that ordered it; mean second so the ties peak leaves behind are
  // broken by the shape of the day rather than by array order.
  rows.sort(
    (a, b) =>
      b.entry.peak - a.entry.peak || b.entry.day_mean - a.entry.day_mean,
  );
  return rows.slice(0, limit);
}
