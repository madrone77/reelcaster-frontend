// Unit tests for `cityFromArrival` in ./suggestion.ts — turning the URL somebody
// landed on into the city we ask them to confirm.
//
// This is the one piece of real logic in the suggestion, and it has to cope
// with every shape a city can be named in: /fishing carries the url_slug
// ("victoria"), /lp and ?loc carry the full slug ("victoria-bc"), and a spot
// page carries a slug that must match nothing so the city segment above it
// wins. Getting it wrong asks an angler in Seattle whether they fish in
// Victoria, which is worse than not asking.
//
// Run with: npx tsx src/app/api/home-city/suggest/city-from-arrival.test.ts

import assert from "node:assert/strict";
import type { CityPoint } from "@/lib/nearby-spots";
import { cityFromArrival } from "./suggestion";

const city = (slug: string, name: string, lat = 0, lng = 0): CityPoint => ({
  slug,
  name,
  lat,
  lng,
  spotCount: 5,
});

const CITIES: CityPoint[] = [
  city("victoria-bc", "Victoria"),
  city("seattle-wa", "Seattle"),
  city("sooke-bc", "Sooke"),
  city("prince-rupert-bc", "Prince Rupert"),
];

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

const slugOf = (arrival: string | null) =>
  cityFromArrival(arrival, CITIES)?.slug ?? null;

console.log("\ncityFromArrival");

test("a /fishing city page, which carries the url_slug", () => {
  assert.equal(slugOf("/fishing/ca/bc/victoria"), "victoria-bc");
  assert.equal(slugOf("/fishing/us/wa/seattle"), "seattle-wa");
});

test("a spot page, whose city is one segment up", () => {
  // The spot slug is tried FIRST (segments are walked in reverse) and has to
  // match nothing, or every spot page would resolve to the wrong thing.
  assert.equal(
    slugOf("/fishing/ca/bc/victoria/oak-bay-flats-2d89e5"),
    "victoria-bc",
  );
});

test("a landing page, which carries the full slug", () => {
  assert.equal(slugOf("/lp/1/victoria-bc"), "victoria-bc");
  assert.equal(slugOf("/lp/3/seattle-wa"), "seattle-wa");
});

test("a city named in the query outranks the path", () => {
  // ?loc and ?city are somebody naming a destination outright. Recorded by
  // arrival-city as "<path>?city=<slug>".
  assert.equal(slugOf("/explore?city=sooke-bc"), "sooke-bc");
  assert.equal(slugOf("/fishing/ca/bc/victoria?city=seattle-wa"), "seattle-wa");
});

test("a multi-word city survives both shapes", () => {
  assert.equal(slugOf("/fishing/ca/bc/prince-rupert"), "prince-rupert-bc");
  assert.equal(slugOf("/lp/1/prince-rupert-bc"), "prince-rupert-bc");
});

test("case and encoding do not decide the answer", () => {
  assert.equal(slugOf("/fishing/CA/BC/Victoria"), "victoria-bc");
  assert.equal(slugOf("/lp/1/victoria%2Dbc"), "victoria-bc");
});

console.log("\ncityFromArrival · when it must say nothing");

test("a page that names no city", () => {
  assert.equal(slugOf("/pricing"), null);
  assert.equal(slugOf("/"), null);
  assert.equal(slugOf("/dashboard"), null);
});

test("no arrival at all", () => {
  assert.equal(slugOf(null), null);
  assert.equal(slugOf(""), null);
});

test("a city we do not cover", () => {
  assert.equal(slugOf("/fishing/us/or/astoria"), null);
  assert.equal(slugOf("/lp/1/portland-or"), null);
});

test("an ambiguous url_slug is refused rather than guessed", () => {
  // Two provinces can both have a Richmond, and the /fishing shape does not
  // carry the province in the leaf. Picking one at random would tell half of
  // them they live somewhere else.
  const ambiguous = [...CITIES, city("richmond-bc", "Richmond"), city("richmond-wa", "Richmond")];
  assert.equal(cityFromArrival("/fishing/ca/bc/richmond", ambiguous), null);
  // The full slug is unambiguous, so it still resolves.
  assert.equal(
    cityFromArrival("/lp/1/richmond-bc", ambiguous)?.slug,
    "richmond-bc",
  );
});

test("an empty city list answers nothing rather than throwing", () => {
  assert.equal(cityFromArrival("/fishing/ca/bc/victoria", []), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
