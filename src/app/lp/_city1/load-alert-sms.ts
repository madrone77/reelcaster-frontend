import { fetchSpotLivePage } from "@/lib/bluecaster";
import { timezoneFor } from "@/lib/regions";
import type { City1Mark } from "./city1-city";
import {
  nextSundayFrom,
  type AlertSmsParts,
  type AlertSmsWhen,
} from "./alert-sms";

/** Letters only, so "Chinook" matches "Chinook Salmon". Same rule as load-conditions.ts. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** What the alert phone draws: the parts of the message and the day it is about. */
export interface AlertSmsFeed {
  parts: AlertSmsParts;
  when: AlertSmsWhen;
}

type Peak = { score: number; hour: number };

/** The peak of one day's 24 hourly scores, or null when the day holds none. */
function peakOf(day: (number | null)[] | undefined): Peak | null {
  if (!day) return null;
  let best: Peak | null = null;
  day.forEach((v, hour) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return;
    if (!best || v > best.score) best = { score: v, hour };
  });
  return best;
}

/**
 * The alert text, read off the mark's own forecast for the Sunday it names.
 *
 * WHY THIS IS READ AND NOT WRITTEN DOWN
 *
 * This band used to print a species, a score and an hour typed per city, with
 * only the day computed. Seattle's copy said King Salmon at Jefferson Head on
 * a day the scorer had Chinook as release-only there (WDFW Marine Area 10 is
 * not open for Chinook retention in September), so the page was advertising
 * a text the product would never send. A message that names a date has to
 * agree with the forecast for that date, and the only way to guarantee that
 * is to read the forecast.
 *
 * WHAT IT READS
 *
 * The same spot payload the conditions phone and the /5 picture draw from.
 * The scorer already applies the regulations per day and drops release-only
 * and closed species from the grid, so a species that appears in this payload
 * for the target day is one an angler could keep that day. The peak is that
 * day's highest hourly score and the hour it lands on, which is what the real
 * heads-up would be about.
 *
 * WHICH SPECIES
 *
 * The one the mark names, when it is scored on that Sunday; otherwise the
 * best-scoring species that day. Same rule as load-conditions.ts, and for the
 * same reason: a message naming a fish the forecast is not scoring is worse
 * than a message naming a different fish.
 *
 * WHICH SUNDAY
 *
 * nextSundayFrom's: at least two days out, so the wording stays the heads-up
 * rather than the "Tomorrow" sentence. When that Sunday carries no scored
 * species at all, the Sunday after it is tried if it is still inside the
 * 14-day forecast. When neither is, this returns null and the band is not
 * drawn: no phone beats a made-up one.
 */
export async function loadAlertSmsFeed(
  mark: City1Mark,
  provinceCode: string,
  nowMs: number,
  /**
   * Seconds in the Data Cache, passed straight through. Ask for the same
   * lifetime as the other reads of this mark on the page, so Next serves all
   * of them from one upstream call. See fetchSpotLivePageWithCacheControl.
   */
  revalidate?: number,
): Promise<AlertSmsFeed | null> {
  const page = await fetchSpotLivePage(mark.slug, undefined, revalidate).catch(
    () => null,
  );
  if (!page) return null;

  const tz = timezoneFor(provinceCode);
  const named =
    page.species.find((s) => norm(s.name).includes(norm(mark.species)))?.id ??
    null;

  for (let extraWeeks = 0; extraWeeks < 2; extraWeeks++) {
    const when = nextSundayFrom(nowMs + extraWeeks * 7 * 86_400_000, tz);
    // The lead is measured from the real "now", not the shifted one.
    when.leadDays += extraWeeks * 7;
    when.arrivedOn = nextSundayFrom(nowMs, tz).arrivedOn;

    const dayIndex = page.daily14.findIndex((d) => d.iso === when.iso);
    if (dayIndex < 0) continue;

    // The named species if it is scored that day, else the best that day.
    let speciesId: string | null = null;
    let peak: Peak | null = null;
    const namedPeak = named
      ? peakOf(page.hourlyScoreGrid[named]?.[dayIndex])
      : null;
    if (named && namedPeak) {
      speciesId = named;
      peak = namedPeak;
    } else {
      for (const id of Object.keys(page.hourlyScoreGrid)) {
        const p = peakOf(page.hourlyScoreGrid[id]?.[dayIndex]);
        if (p && (!peak || p.score > peak.score)) {
          speciesId = id;
          peak = p;
        }
      }
    }
    if (!speciesId || !peak) continue;

    const speciesName = page.species.find((s) => s.id === speciesId)?.name;
    if (!speciesName) continue;

    return {
      parts: {
        species: speciesName,
        spot: page.spot.name,
        score: Math.round(peak.score),
        hour: peak.hour,
      },
      when,
    };
  }
  return null;
}
