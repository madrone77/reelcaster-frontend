// Unit tests for src/lib/forecast-horizon.ts — the day index and the map
// spots stripper behind /api/bluecaster/map/spots.
//
// Run with: npx tsx src/lib/forecast-horizon.test.ts

import assert from "node:assert/strict";
import {
  forecastDayIndex,
  horizonPhrase,
  stripMapSpotsPastHorizon,
  stripSpotsOutlook,
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from "./forecast-horizon";
import type { MapSpotsPayload, SpotsOutlook14dPayload } from "./bluecaster";

const payload = (date: string): MapSpotsPayload => ({
  date,
  tz: "America/Vancouver",
  forecast_version: 1,
  hours_utc: [],
  species: {},
  spots: [
    {
      id: "a",
      slug: "a",
      name: "A",
      lat: 48,
      lng: -123,
      city_slug: "victoria",
      home_city_slug: "victoria",
      best_species_id: "chinook",
      scores: {
        chinook: { peak: 0.9, peak_hour: 7, hours: [] },
      } as unknown as MapSpotsPayload["spots"][number]["scores"],
      conditions: null,
      has_reports: true,
    },
  ],
});

// forecastDayIndex counts whole calendar days, across a month end.
assert.equal(forecastDayIndex("2026-09-06", "2026-09-06"), 0);
assert.equal(forecastDayIndex("2026-09-06", "2026-09-07"), 1);
assert.equal(forecastDayIndex("2026-09-30", "2026-10-01"), 1);
assert.equal(forecastDayIndex("2026-09-06", "2026-09-19"), 13);
assert.equal(forecastDayIndex("2026-09-06", "2026-09-05"), -1);

// Inside the horizon the payload is returned as is.
const today = payload("2026-09-06");
assert.equal(stripMapSpotsPastHorizon(today, ANON_FORECAST_DAYS, "2026-09-06"), today);
const day2 = payload("2026-09-07");
assert.equal(stripMapSpotsPastHorizon(day2, FREE_FORECAST_DAYS, "2026-09-06"), day2);
const day7 = payload("2026-09-12");
assert.equal(stripMapSpotsPastHorizon(day7, FREE_FORECAST_DAYS, "2026-09-06"), day7);

// Anonymous callers see today only: tomorrow is already past the horizon.
assert.equal(ANON_FORECAST_DAYS, 1);
assert.deepEqual(stripMapSpotsPastHorizon(day2, ANON_FORECAST_DAYS, "2026-09-06").spots[0].scores, {});

// Past it, the spots stay and the scores go.
const day3 = payload("2026-09-08");
const anon3 = stripMapSpotsPastHorizon(day3, ANON_FORECAST_DAYS, "2026-09-06");
assert.notEqual(anon3, day3);
assert.equal(anon3.spots.length, 1);
assert.equal(anon3.spots[0].name, "A");
assert.equal(anon3.spots[0].has_reports, true);
assert.deepEqual(anon3.spots[0].scores, {});
assert.equal(anon3.spots[0].best_species_id, null);
// The input is not mutated.
assert.equal(day3.spots[0].best_species_id, "chinook");

const day8 = payload("2026-09-13");
assert.deepEqual(stripMapSpotsPastHorizon(day8, FREE_FORECAST_DAYS, "2026-09-06").spots[0].scores, {});

// Pro sees everything, including a date past the strip.
const day14 = payload("2026-09-20");
assert.equal(stripMapSpotsPastHorizon(day14, PRO_FORECAST_DAYS, "2026-09-06"), day14);

// Yesterday is not past the horizon.
const past = payload("2026-09-05");
assert.equal(stripMapSpotsPastHorizon(past, ANON_FORECAST_DAYS, "2026-09-06"), past);

// Copy never says "the next 1 days".
assert.equal(horizonPhrase(1), "today");
assert.equal(horizonPhrase(1, { sentenceStart: true }), "Today");
assert.equal(horizonPhrase(7), "the next 7 days");

console.log("forecast-horizon: all assertions passed");

// stripSpotsOutlook stamps the caller's horizon on every payload, Pro
// included, so a card can tell a locked day from a day with no score.
{
  const cell = { score: 80, peak_hour: 7 } as unknown as NonNullable<
    SpotsOutlook14dPayload["by_spot"][string][number]
  >;
  const outlook: SpotsOutlook14dPayload = {
    start: "2026-09-24",
    tz: "America/Vancouver",
    forecast_version: 1,
    days: [],
    species: {},
    // Scored 7 days, then nothing: a spot whose scoring stops short.
    by_spot: { a: [...Array(7).fill(cell), ...Array(7).fill(null)] },
  };
  const pro = stripSpotsOutlook(outlook, PRO_FORECAST_DAYS);
  assert.equal(pro.visible_days, 14);
  assert.deepEqual(pro.by_spot, outlook.by_spot);
  const member = stripSpotsOutlook(outlook, FREE_FORECAST_DAYS);
  assert.equal(member.visible_days, 7);
  const anon = stripSpotsOutlook(outlook, ANON_FORECAST_DAYS);
  assert.equal(anon.visible_days, 1);
  assert.equal(anon.by_spot.a.filter(Boolean).length, 1);
}

console.log("forecast-horizon: ok");
