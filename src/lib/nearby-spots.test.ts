// Unit tests for src/lib/nearby-spots.ts — the nearest-city snap and the
// spot ranking behind the homepage's "near you" section.
//
// Run with: npx tsx src/lib/nearby-spots.test.ts

import assert from "node:assert/strict";
import type {
  BlueCasterHierarchyLight,
  MapSpotsPayload,
} from "./bluecaster";
import {
  coveredCityPoints,
  haversineKm,
  MAX_CITY_DISTANCE_KM,
  nearestCityTo,
  rankNearbySpots,
} from "./nearby-spots";

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
    failed++;
  }
}

// ── fixtures ────────────────────────────────────────────────────────────────

function city(
  slug: string,
  name: string,
  lat: number,
  lng: number,
  extra: { lifecycle?: string; spot_count?: number } = {},
) {
  return {
    id: slug,
    name,
    slug,
    lat,
    lng,
    lifecycle: extra.lifecycle ?? "published",
    spot_count: extra.spot_count ?? 5,
  };
}

const HIERARCHY = {
  countries: [
    {
      id: "ca",
      name: "Canada",
      code: "CA",
      states_provinces: [
        {
          id: "bc",
          name: "British Columbia",
          code: "BC",
          type: "province",
          regions: [
            {
              id: "vi",
              name: "Vancouver Island",
              slug: "vancouver-island",
              cities: [
                city("victoria-bc", "Victoria", 48.4284, -123.3656),
                city("sooke-bc", "Sooke", 48.3745, -123.7279),
                city("nanaimo-bc", "Nanaimo", 49.1659, -123.9401),
                // Covered but not public yet — must never be snapped to.
                city("tofino-bc", "Tofino", 49.153, -125.9066, {
                  lifecycle: "staging",
                }),
                // Published but empty — a link here lands on a blank map.
                city("empty-bc", "Emptyville", 48.44, -123.37, {
                  spot_count: 0,
                }),
              ],
            },
          ],
        },
      ],
    },
  ],
} as unknown as BlueCasterHierarchyLight;

function strip(peak: number) {
  return { peak, peak_hour: 12, hours: [], season: "peak" };
}

const PAYLOAD = {
  date: "2026-08-18",
  tz: "America/Vancouver",
  forecast_version: 1,
  hours_utc: [],
  species: {
    chinook: { id: "chinook", slug: "chinook", name: "Chinook" },
    coho: { id: "coho", slug: "coho", name: "Coho" },
  },
  spots: [
    // Best species is the higher peak, not the first key.
    {
      id: "s1",
      slug: "race-rocks",
      name: "Race Rocks",
      scores: { coho: strip(0.61), chinook: strip(0.86) },
    },
    { id: "s2", slug: "constance-bank", name: "Constance Bank", scores: { chinook: strip(0.9) } },
    { id: "s3", slug: "oak-bay", name: "Oak Bay", scores: { coho: strip(0.54) } },
    // Unscored — not a recommendation, must be dropped entirely.
    { id: "s4", slug: "no-forecast", name: "No Forecast", scores: {} },
    // Ties with Oak Bay; alphabetical order breaks the tie deterministically.
    { id: "s5", slug: "beechey-head", name: "Beechey Head", scores: { coho: strip(0.54) } },
  ],
} as unknown as MapSpotsPayload;

// ── the city snap ───────────────────────────────────────────────────────────

console.log("\ncoveredCityPoints");

test("keeps only published cities that have spots", () => {
  const slugs = coveredCityPoints(HIERARCHY).map((c) => c.slug);
  assert.deepEqual(slugs, ["victoria-bc", "sooke-bc", "nanaimo-bc"]);
});

test("a published city in an uncovered province is not offered", () => {
  // Oregon can hold a published city with spots and still not be somewhere we
  // sell or forecast — see the note atop lib/regions.ts.
  const tree = {
    countries: [
      {
        id: "us",
        name: "United States",
        code: "US",
        states_provinces: [
          {
            id: "or",
            name: "Oregon",
            code: "OR",
            type: "state",
            regions: [
              {
                id: "or-coast",
                name: "Oregon coast",
                slug: "or-coast",
                cities: [city("astoria-or", "Astoria", 46.1879, -123.831)],
              },
            ],
          },
        ],
      },
    ],
  } as unknown as BlueCasterHierarchyLight;
  assert.deepEqual(coveredCityPoints(tree), []);
});

test("a null hierarchy yields no cities rather than throwing", () => {
  assert.deepEqual(coveredCityPoints(null), []);
});

console.log("\nnearestCityTo");

const CITIES = coveredCityPoints(HIERARCHY);

test("Victoria-ish coordinates snap to Victoria", () => {
  // Downtown Victoria.
  const hit = nearestCityTo(48.4284, -123.3656, CITIES);
  assert.equal(hit?.city.slug, "victoria-bc");
  assert.ok(hit && hit.distanceKm < 1);
});

test("Sooke-ish coordinates snap to Sooke, not to the bigger city", () => {
  const hit = nearestCityTo(48.3745, -123.7279, CITIES);
  assert.equal(hit?.city.slug, "sooke-bc");
});

test("a staging city is never the answer even when it is nearest", () => {
  // Tofino's own coordinates: it is nearest by far, but it is not public.
  const hit = nearestCityTo(49.153, -125.9066, CITIES);
  assert.notEqual(hit?.city.slug, "tofino-bc");
});

test("an empty published city is never the answer even when it is nearest", () => {
  // Emptyville sits ~1 km from downtown Victoria and would otherwise win.
  const hit = nearestCityTo(48.44, -123.37, CITIES);
  assert.equal(hit?.city.slug, "victoria-bc");
});

test("mid-Pacific coordinates fall outside the cutoff and locate nothing", () => {
  assert.equal(nearestCityTo(30, -150, CITIES), null);
});

test("Calgary is inside BC's neighbour, still well past the cutoff", () => {
  assert.equal(nearestCityTo(51.0447, -114.0719, CITIES), null);
});

test("the cutoff is applied at exactly MAX_CITY_DISTANCE_KM", () => {
  const one = [city("victoria-bc", "Victoria", 48.4284, -123.3656)].map((c) => ({
    slug: c.slug,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    spotCount: c.spot_count,
    country: "CA",
    province: "BC",
  }));
  // Due north, a touch inside and a touch outside the ring.
  const degPerKm = 1 / 111.19;
  const inside = 48.4284 + (MAX_CITY_DISTANCE_KM - 2) * degPerKm;
  const outside = 48.4284 + (MAX_CITY_DISTANCE_KM + 2) * degPerKm;
  assert.ok(nearestCityTo(inside, -123.3656, one));
  assert.equal(nearestCityTo(outside, -123.3656, one), null);
});

console.log("\nhaversineKm");

test("Victoria → Nanaimo is about 90 km", () => {
  const d = haversineKm(48.4284, -123.3656, 49.1659, -123.9401);
  assert.ok(d > 85 && d < 95, `got ${d}`);
});

test("a point is zero km from itself", () => {
  assert.equal(haversineKm(48.4284, -123.3656, 48.4284, -123.3656), 0);
});

// ── the ranking ─────────────────────────────────────────────────────────────

console.log("\nrankNearbySpots");

test("orders by score, highest first", () => {
  const ranked = rankNearbySpots(PAYLOAD);
  assert.deepEqual(
    ranked.map((s) => s.slug),
    ["constance-bank", "race-rocks", "beechey-head", "oak-bay"],
  );
});

test("scores are the best species' peak, scaled to 0–100", () => {
  const ranked = rankNearbySpots(PAYLOAD);
  assert.equal(ranked[0].score, 90);
  assert.equal(ranked[1].score, 86);
});

test("names the species that produced the score, not the first one listed", () => {
  const ranked = rankNearbySpots(PAYLOAD);
  const raceRocks = ranked.find((s) => s.slug === "race-rocks");
  assert.equal(raceRocks?.topSpecies, "Chinook");
});

test("drops unscored spots instead of padding the list with them", () => {
  const ranked = rankNearbySpots(PAYLOAD);
  assert.ok(!ranked.some((s) => s.slug === "no-forecast"));
});

test("breaks score ties by name, so the order is stable across requests", () => {
  const ranked = rankNearbySpots(PAYLOAD).filter((s) => s.score === 54);
  assert.deepEqual(
    ranked.map((s) => s.slug),
    ["beechey-head", "oak-bay"],
  );
});

test("honours the limit", () => {
  assert.equal(rankNearbySpots(PAYLOAD, 2).length, 2);
});

test("a null payload yields no spots rather than throwing", () => {
  assert.deepEqual(rankNearbySpots(null), []);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
