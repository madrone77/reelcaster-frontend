// Unit tests for src/app/explore/lib/opening-city.ts — the IP read and the
// nearest-covered-city snap behind the frame /explore opens on.
//
// The city fixture below is the real covered set with its real coordinates, so
// these assertions are about where an arrival actually lands, not about whether
// haversine works. Refresh it when a city ships.
//
// Run with: npx tsx src/app/explore/lib/opening-city.test.ts

import assert from "node:assert/strict";
import type { BlueCasterHierarchyLight } from "@/lib/bluecaster";
import {
  nearestOpeningCity,
  readVisitorPoint,
  type HeaderReader,
} from "./opening-city";

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

type CitySpec = [slug: string, name: string, lat: number, lng: number];

// The nine cities with published spots as of 2026-08-18.
const BC_CITIES: CitySpec[] = [
  ["vancouver-bc", "Vancouver", 49.2879, -123.1133],
  ["prince-rupert-bc", "Prince Rupert", 54.315, -130.3208],
  ["sooke-bc", "Sooke", 48.3747, -123.7266],
  ["victoria-bc", "Victoria", 48.4284, -123.3656],
  ["cowichan-bc", "Cowichan", 48.7787, -123.7079],
  ["sidney-bc", "Sidney", 48.6506, -123.3986],
];
const WA_CITIES: CitySpec[] = [
  ["friday-harbor-wa", "Friday Harbor", 48.5343, -123.0171],
  ["seattle-wa", "Seattle", 47.6061, -122.3328],
  ["bellingham-wa", "Bellingham", 48.7519, -122.4787],
];

function city(
  [slug, name, lat, lng]: CitySpec,
  extra: { lifecycle?: string; spot_count?: number } = {},
) {
  return {
    id: slug,
    name,
    slug,
    lat,
    lng,
    lifecycle: extra.lifecycle ?? "published",
    spot_count: extra.spot_count ?? 10,
  };
}

function province(code: string, name: string, cities: ReturnType<typeof city>[]) {
  return {
    id: code,
    name,
    code,
    type: "province",
    regions: [{ id: `${code}-r`, name: `${name} coast`, slug: `${code}-r`, cities }],
  };
}

function hierarchy(
  provinces = [
    province("BC", "British Columbia", BC_CITIES.map((c) => city(c))),
    province("WA", "Washington", WA_CITIES.map((c) => city(c))),
  ],
): BlueCasterHierarchyLight {
  return {
    countries: [{ id: "c", name: "Canada", code: "CA", states_provinces: provinces }],
  } as unknown as BlueCasterHierarchyLight;
}

function headersWith(values: Record<string, string>): HeaderReader {
  return { get: (name) => values[name] ?? null };
}

/** Where an arrival at these coordinates opens the map. */
const opensOn = (lat: number, lng: number, h = hierarchy()) =>
  nearestOpeningCity(h, { lat, lng });

// ── readVisitorPoint ────────────────────────────────────────────────────────

console.log("readVisitorPoint");

test("reads Vercel's edge geo headers", () => {
  const point = readVisitorPoint(
    headersWith({
      "x-vercel-ip-latitude": "47.6061",
      "x-vercel-ip-longitude": "-122.3328",
    }),
  );
  assert.deepEqual(point, { lat: 47.6061, lng: -122.3328 });
});

test("no headers is null, not an error — that is localhost and every crawler", () => {
  assert.equal(readVisitorPoint(headersWith({})), null);
});

test("a half-set pair is discarded rather than half-believed", () => {
  const point = readVisitorPoint(
    headersWith({ "x-vercel-ip-latitude": "47.6061" }),
  );
  assert.equal(point, null);
});

test("garbage in the header does not become NaN downstream", () => {
  const point = readVisitorPoint(
    headersWith({
      "x-vercel-ip-latitude": "north",
      "x-vercel-ip-longitude": "-122.3",
    }),
  );
  assert.equal(point, null);
});

test("outside production the ?geo_lat/?geo_lng override wins", () => {
  // VERCEL_ENV is unset under the test runner, which is the non-production case.
  const point = readVisitorPoint(
    headersWith({
      "x-vercel-ip-latitude": "48.4284",
      "x-vercel-ip-longitude": "-123.3656",
    }),
    { lat: "40.7128", lng: "-74.006" },
  );
  assert.deepEqual(point, { lat: 40.7128, lng: -74.006 });
});

test("an absent override falls through to the headers", () => {
  const point = readVisitorPoint(
    headersWith({
      "x-vercel-ip-latitude": "48.4284",
      "x-vercel-ip-longitude": "-123.3656",
    }),
    { lat: null, lng: null },
  );
  assert.deepEqual(point, { lat: 48.4284, lng: -123.3656 });
});

test("a BLANK override falls through — it is not 0N 0E", () => {
  // `Number("")` is 0, so `?geo_lat=&geo_lng=` used to read as a valid fix in
  // the Gulf of Guinea and open the map on whichever hub was nearest to it.
  const point = readVisitorPoint(
    headersWith({
      "x-vercel-ip-latitude": "48.4284",
      "x-vercel-ip-longitude": "-123.3656",
    }),
    { lat: "", lng: "" },
  );
  assert.deepEqual(point, { lat: 48.4284, lng: -123.3656 });
});

test("a blank override with no headers behind it is simply nothing", () => {
  assert.equal(readVisitorPoint(headersWith({}), { lat: "", lng: "" }), null);
});

test("half a blank override is not half a position", () => {
  assert.equal(
    readVisitorPoint(headersWith({}), { lat: "47.6061", lng: "" }),
    null,
  );
});

test("in production the override is not read at all", () => {
  const prior = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  try {
    const point = readVisitorPoint(
      headersWith({
        "x-vercel-ip-latitude": "48.4284",
        "x-vercel-ip-longitude": "-123.3656",
      }),
      { lat: "40.7128", lng: "-74.006" },
    );
    assert.deepEqual(point, { lat: 48.4284, lng: -123.3656 });
  } finally {
    if (prior === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prior;
  }
});

// ── nearestOpeningCity: where a real arrival lands ──────────────────────────
//
// Distances in the comments are great-circle km to the named city, measured
// against the fixture above. They are here because the choice between two
// cities 3 km apart at 3,863 km is the whole reason this function has two
// tiers rather than one.

console.log("nearestOpeningCity — local tier");

test("Seattle opens on Seattle", () => {
  assert.equal(opensOn(47.6061, -122.3328), "seattle-wa");
});

test("Everett opens on Seattle, 43 km away", () => {
  assert.equal(opensOn(47.979, -122.2021), "seattle-wa");
});

test("Victoria still opens on Victoria", () => {
  assert.equal(opensOn(48.4284, -123.3656), "victoria-bc");
});

test("Nanaimo opens on Cowichan (46 km), not on bigger Vancouver (62 km)", () => {
  // The local tier is plain nearest and does not prefer the hub.
  assert.equal(opensOn(49.1659, -123.9401), "cowichan-bc");
});

test("Portland opens on Seattle, 234 km — just inside the local radius", () => {
  assert.equal(opensOn(45.5152, -122.6784), "seattle-wa");
});

console.log("nearestOpeningCity — hub tier");

test("New York opens on Seattle, not on 3 km closer Bellingham", () => {
  // Bellingham 3,863 km, Seattle 3,866 km. This is the case the hub tier
  // exists for: a 0.08% margin decided where the entire eastern seaboard
  // landed.
  assert.equal(opensOn(40.7128, -74.006), "seattle-wa");
});

test("Toronto opens on Seattle, not on 6 km closer Bellingham", () => {
  assert.equal(opensOn(43.6532, -79.3832), "seattle-wa");
});

test("Los Angeles opens on Seattle", () => {
  assert.equal(opensOn(34.0522, -118.2437), "seattle-wa");
});

test("Calgary opens on Vancouver, not across the border to Bellingham", () => {
  // Bellingham 653 km, Vancouver 672 km — 19 km, against a passport.
  assert.equal(opensOn(51.0447, -114.0719), "vancouver-bc");
});

test("Kelowna opens on Vancouver, not across the border to Bellingham", () => {
  // Bellingham 250 km, Vancouver 269 km.
  assert.equal(opensOn(49.888, -119.496), "vancouver-bc");
});

test("Anchorage opens on Prince Rupert", () => {
  // The north-coast hub earns its place here: 1,384 km, against 2,129 km to
  // Vancouver.
  assert.equal(opensOn(61.2181, -149.9003), "prince-rupert-bc");
});

test("no distance cap — an arrival from Tokyo still gets a frame", () => {
  assert.equal(opensOn(35.6762, 139.6503), "prince-rupert-bc");
});

console.log("nearestOpeningCity — no answer");

test("no position falls through to the caller's default", () => {
  assert.equal(nearestOpeningCity(hierarchy(), null), null);
});

test("no hierarchy falls through to the caller's default", () => {
  assert.equal(nearestOpeningCity(null, { lat: 47.6061, lng: -122.3328 }), null);
});

test("a hierarchy with no openable city falls through too", () => {
  const h = hierarchy([province("BC", "British Columbia", [])]);
  assert.equal(nearestOpeningCity(h, { lat: 47.6061, lng: -122.3328 }), null);
});

// ── the gates on which cities can be opened on ──────────────────────────────

console.log("nearestOpeningCity — gates");

test("a closer city that is not published is skipped", () => {
  const h = hierarchy([
    province("BC", "British Columbia", BC_CITIES.map((c) => city(c))),
    province("WA", "Washington", [
      city(WA_CITIES[1], { lifecycle: "building" }), // Seattle, not public yet
      city(WA_CITIES[0]), // Friday Harbor
      city(WA_CITIES[2]), // Bellingham
    ]),
  ]);
  // From Seattle: Friday Harbor 115 km, Victoria 119 km, Bellingham 128 km.
  assert.equal(opensOn(47.6061, -122.3328, h), "friday-harbor-wa");
});

test("a closer city with no published spots is skipped", () => {
  const h = hierarchy([
    province("BC", "British Columbia", BC_CITIES.map((c) => city(c))),
    province("WA", "Washington", [
      city(WA_CITIES[1], { spot_count: 0 }), // Seattle, empty
      city(WA_CITIES[0]), // Friday Harbor
      city(WA_CITIES[2]), // Bellingham
    ]),
  ]);
  assert.equal(opensOn(47.6061, -122.3328, h), "friday-harbor-wa");
});

test("a closer city in an uncovered province is skipped", () => {
  // Oregon is the standing case: it can hold a published city and still not be
  // somewhere we sell or forecast. Opening the map there would be worse than
  // opening it far away.
  const h = hierarchy([
    province("BC", "British Columbia", BC_CITIES.map((c) => city(c))),
    province("WA", "Washington", WA_CITIES.map((c) => city(c))),
    province("OR", "Oregon", [city(["astoria-or", "Astoria", 46.1879, -123.831])]),
  ]);
  assert.equal(opensOn(45.5152, -122.6784, h), "seattle-wa");
});

test("a hub that fails the gates is ignored, not opened on", () => {
  // Seattle unpublished, so a New York arrival falls to the next hub rather
  // than to an empty map.
  const h = hierarchy([
    province("BC", "British Columbia", BC_CITIES.map((c) => city(c))),
    province("WA", "Washington", [
      city(WA_CITIES[0]),
      city(WA_CITIES[1], { lifecycle: "building" }),
      city(WA_CITIES[2]),
    ]),
  ]);
  assert.equal(opensOn(40.7128, -74.006, h), "vancouver-bc");
});

test("with no hub left standing, a far arrival still gets the nearest city", () => {
  const h = hierarchy([
    province("BC", "British Columbia", [city(BC_CITIES[3])]), // Victoria only
  ]);
  assert.equal(opensOn(40.7128, -74.006, h), "victoria-bc");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
