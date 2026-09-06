// Unit tests for src/lib/forecast-horizon.ts — the day index and the map
// spots stripper behind /api/bluecaster/map/spots.
//
// Run with: npx tsx src/lib/forecast-horizon.test.ts

import assert from "node:assert/strict";
import {
  forecastDayIndex,
  stripMapSpotsPastHorizon,
  ANON_FORECAST_DAYS,
  FREE_FORECAST_DAYS,
  PRO_FORECAST_DAYS,
} from "./forecast-horizon";
import type { MapSpotsPayload } from "./bluecaster";

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
assert.equal(stripMapSpotsPastHorizon(day2, ANON_FORECAST_DAYS, "2026-09-06"), day2);
const day7 = payload("2026-09-12");
assert.equal(stripMapSpotsPastHorizon(day7, FREE_FORECAST_DAYS, "2026-09-06"), day7);

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

console.log("forecast-horizon: all assertions passed");
