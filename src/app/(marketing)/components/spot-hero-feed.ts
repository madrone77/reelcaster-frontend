import { fetchSpotLivePage } from '@/lib/bluecaster';
import { regulatorFrom, timezoneFor, type Regulator } from '@/lib/regions';
import type {
  HourlyConditions,
  LiveRegulation,
  LiveSpecies,
  LiveSpot,
  SunHours,
} from '@/lib/bluecaster/live-spot-types';

/**
 * The top of one real spot page, trimmed to what a picture of it needs.
 *
 * The carousel's spot slide used to be a screenshot — a real one, captured off
 * the real page, with arrows drawn on it. It went stale the way every
 * screenshot does: the score in it was whatever the day held when somebody
 * pressed the button, and the page it pictured kept moving. This is the same
 * screen rendered from the same payload the spot page itself renders from, so
 * it cannot show a spot page we do not ship.
 *
 * ── Why a trim and not the payload ───────────────────────────────────────
 *
 * `SpotPageInitial` carries fourteen days of hourly scores per species,
 * fourteen days of conditions, the tide series, catch signals, guide notes and
 * the neighbour rail. The picture uses today. Sending the rest to every
 * homepage visitor would be tens of kilobytes of JSON to draw one screen, so
 * this is day 0 and the identity, and nothing else.
 *
 * Same shape of decision as ../../lp/_city1/load-conditions.ts, which trims the
 * same payload for the phone below this one. The two are deliberately separate:
 * that one is a chart of a day, this one is a page's header, and folding them
 * into a single "everything either might want" feed would mean both slides
 * shipping the union.
 */
export interface SpotHeroFeed {
  spot: LiveSpot;
  /** In the spot page's own order: by rank. */
  species: LiveSpecies[];
  /** The species the page opens on — its best-scoring one today. */
  selectedId: string | null;
  /** Today's peak per species. Drives the species cards' numbers. */
  topScoreToday: Record<string, number>;
  /** Today's 24 hourly scores per species. Drives the cards' sparklines. */
  scoresToday: Record<string, (number | null)[]>;
  regulations: LiveRegulation[];
  /** The area number, e.g. "29-3". */
  regAreaCode: string | null;
  /**
   * Resolved on the server from the payload's own agency, never from the city.
   * A spot's jurisdiction is not reliably its city's — see `regAgency` on
   * LiveSpotDetail — and this is the string the mock prints beside a real
   * regulation, so it is the one thing here that must not be guessed.
   */
  regulator: Regulator;
  /** Today's 24 conditions cells, for the map's hour bar and the tide phase. */
  conditions: HourlyConditions[];
  sun: SunHours;
  /** The mark's own clock, which is not the reader's. */
  tz: string;
  /** Local date of the day drawn, for the map's flow-field hour. */
  iso: string | null;
}

/**
 * Load the top of the page.
 *
 * Returns null on any thin payload rather than throwing. This is one slide of
 * a carousel: a mark whose payload came back short should cost the slide, not
 * the homepage.
 *
 * `revalidate` is passed straight through. The homepage is a static page and
 * regenerates as often as the shortest-lived fetch under it, so it asks for
 * longer than the spot page's own 60 seconds.
 */
export async function loadSpotHeroFeed(
  slug: string,
  provinceCode: string,
  revalidate?: number,
): Promise<SpotHeroFeed | null> {
  const page = await fetchSpotLivePage(slug, undefined, revalidate).catch(
    () => null,
  );
  if (!page) return null;

  const species = [...page.species].sort((a, b) => a.rank - b.rank);
  const conditions = page.hourlyConditionsGrid?.[0];
  if (!species.length || !conditions?.length) return null;

  // The spot page's own opening pick: the best-scoring species today. Copied
  // rather than imported because it lives inside the 1,600-line client shell;
  // if it ever moves somewhere importable, this should read it from there.
  let selectedId: string | null = null;
  let best = -1;
  for (const s of species) {
    const v = page.topScoreTodayBySpecies[s.id] ?? -1;
    if (v > best) {
      best = v;
      selectedId = s.id;
    }
  }
  selectedId = selectedId ?? species[0]?.id ?? null;

  const scoresToday: Record<string, (number | null)[]> = {};
  for (const s of species) {
    const today = page.hourlyScoreGrid[s.id]?.[0];
    if (today) scoresToday[s.id] = today;
  }
  // A header with no numbers under it is worse than no header.
  if (!Object.keys(scoresToday).length) return null;

  return {
    spot: page.spot,
    species,
    selectedId,
    topScoreToday: page.topScoreTodayBySpecies,
    scoresToday,
    regulations: page.regulations,
    regAreaCode: page.regAreaCode,
    regulator: regulatorFrom({
      agency: page.regAgency,
      region: page.spot.region,
    }),
    conditions,
    sun: page.sun,
    tz: timezoneFor(provinceCode),
    iso: page.daily14?.[0]?.iso ?? null,
  };
}
