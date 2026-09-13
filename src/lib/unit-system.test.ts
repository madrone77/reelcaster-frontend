// Unit tests for src/lib/unit-system.ts: which units a spot reads in, by the
// country the water is in, with the angler's own choices on top.
//
// Run with: npx tsx src/lib/unit-system.test.ts

import assert from "node:assert/strict";
import {
  CA_DEFAULT_UNITS,
  CA_EXPLORE_RAIL_UNITS,
  US_DEFAULT_UNITS,
  chooseUnits,
  choicesFromLegacyLocal,
  choicesFromSaved,
  formatSignedTide,
  formatSpotDistance,
  formatWholeTemp,
  unitCountryFor,
  unitCountryForCitySlug,
  unitCountryForStationSource,
} from "./unit-system";
import { formatConditions, railUnitsFor } from "@/app/explore/lib/explore-data";
import type { MapCondCell } from "./bluecaster";

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

// ── country ─────────────────────────────────────────────────────────────────

test("WA, OR and CA are US water; BC is Canadian", () => {
  assert.equal(unitCountryFor("WA"), "US");
  assert.equal(unitCountryFor("OR"), "US");
  assert.equal(unitCountryFor("CA"), "US");
  assert.equal(unitCountryFor("BC"), "CA");
});

test("full region names resolve the same as codes", () => {
  assert.equal(unitCountryFor("California"), "US");
  assert.equal(unitCountryFor("Washington"), "US");
  assert.equal(unitCountryFor("British Columbia"), "CA");
});

test("region wins over country, so CA-the-state is not Canada", () => {
  assert.equal(unitCountryFor("CA", "Canada"), "US");
  assert.equal(unitCountryFor(null, "CA"), "CA");
  assert.equal(unitCountryFor(null, "United States"), "US");
  assert.equal(unitCountryFor("", "Canada"), "CA");
});

test("unknown or missing region gives null (today's behaviour)", () => {
  assert.equal(unitCountryFor(null), null);
  assert.equal(unitCountryFor("Alaska"), null);
  assert.equal(unitCountryFor(undefined, undefined), null);
});

test("city slugs and station sources name the country", () => {
  assert.equal(unitCountryForCitySlug("san-diego-ca"), "US");
  assert.equal(unitCountryForCitySlug("seattle-wa"), "US");
  assert.equal(unitCountryForCitySlug("victoria-bc"), "CA");
  assert.equal(unitCountryForCitySlug("nowhere"), null);
  assert.equal(unitCountryForCitySlug(null), null);
  assert.equal(unitCountryForStationSource("noaa"), "US");
  assert.equal(unitCountryForStationSource("ndbc"), "US");
  assert.equal(unitCountryForStationSource("chs"), "CA");
});

// ── chooser ─────────────────────────────────────────────────────────────────

test("US water defaults to feet, Fahrenheit, miles, knots", () => {
  const u = chooseUnits("US", {});
  assert.equal(u.tideUnit, "ft");
  assert.equal(u.depthUnit, "ft");
  assert.equal(u.tempUnit, "F");
  assert.equal(u.distanceUnit, "miles");
  assert.equal(u.windUnit, "knots");
  assert.equal(u.currentUnit, "knots");
});

test("Canadian water and unknown water keep the BC defaults exactly", () => {
  assert.deepEqual(chooseUnits("CA", {}), CA_DEFAULT_UNITS);
  assert.deepEqual(chooseUnits(null, {}), CA_DEFAULT_UNITS);
});

test("a surface's own Canadian base never leaks into US water", () => {
  assert.equal(chooseUnits("CA", {}, CA_EXPLORE_RAIL_UNITS).tideUnit, "m");
  assert.deepEqual(chooseUnits("US", {}, CA_EXPLORE_RAIL_UNITS), US_DEFAULT_UNITS);
});

test("an angler's choice wins in both countries", () => {
  const choices = { tempUnit: "C", tideUnit: "m", distanceUnit: "km" } as const;
  const us = chooseUnits("US", choices);
  assert.equal(us.tempUnit, "C");
  assert.equal(us.tideUnit, "m");
  assert.equal(us.distanceUnit, "km");
  assert.equal(us.depthUnit, "ft", "unchosen keys still follow the country");
  const ca = chooseUnits("CA", { tempUnit: "F", distanceUnit: "miles" });
  assert.equal(ca.tempUnit, "F");
  assert.equal(ca.distanceUnit, "miles");
  assert.equal(ca.waveUnit, "m");
});

test("saved preferences are read raw, with the legacy migrations", () => {
  assert.deepEqual(choicesFromSaved(null), {});
  assert.deepEqual(choicesFromSaved({ timezone: "America/Vancouver" }), {});
  assert.deepEqual(choicesFromSaved({ tempUnit: "C" }), { tempUnit: "C" });
  assert.deepEqual(choicesFromSaved({ windUnit: "mph" }), {
    windUnit: "mph",
    currentUnit: "mph",
  });
  assert.deepEqual(choicesFromSaved({ heightUnit: "m" }), { depthUnit: "m" });
  assert.deepEqual(choicesFromSaved({ heightUnit: "m", depthUnit: "fathoms" }), {
    depthUnit: "fathoms",
  });
});

test("the old full on-device blob only carries what differs from the default", () => {
  const blob = { ...CA_DEFAULT_UNITS, tempUnit: "F", distanceUnit: "nm" };
  assert.deepEqual(choicesFromLegacyLocal(blob), { tempUnit: "F", distanceUnit: "nm" });
  assert.deepEqual(choicesFromLegacyLocal({ ...CA_DEFAULT_UNITS }), {});
  assert.deepEqual(choicesFromLegacyLocal(null), {});
});

// ── formatting ──────────────────────────────────────────────────────────────

test("tide: metres exactly as the drawer always wrote them", () => {
  assert.equal(formatSignedTide(1.23, "m"), "+1.2m");
  assert.equal(formatSignedTide(-0.46, "m"), "-0.5m");
  assert.equal(formatSignedTide(0, "m"), "+0.0m");
});

test("tide: feet convert and keep the sign", () => {
  assert.equal(formatSignedTide(1.2, "ft"), "+3.9ft");
  assert.equal(formatSignedTide(-0.3, "ft"), "-1.0ft");
});

test("temperature: whole degrees in either scale", () => {
  assert.equal(formatWholeTemp(20, "C"), "20°C");
  assert.equal(formatWholeTemp(20, "F"), "68°F");
  assert.equal(formatWholeTemp(-1.4, "C"), "-1°C");
  assert.equal(formatWholeTemp(13.2, "F"), "56°F");
});

test("distance: km as it arrives, miles rounded", () => {
  assert.equal(formatSpotDistance(186, "km"), "186 km");
  assert.equal(formatSpotDistance(186, "miles"), "116 mi");
  assert.equal(formatSpotDistance(8, "miles"), "5.0 mi");
  assert.equal(formatSpotDistance(20, "nm"), "11 nm");
});

// ── the Explore rail ────────────────────────────────────────────────────────

const CELL = {
  tide: 1.2,
  tph: "flood",
  air: 20,
  cur: 0.4,
  wkt: 8,
  wdir: 225,
  wav: null,
  cld: 10,
  pcp: 0,
} as unknown as MapCondCell;

test("rail: Canadian water reads exactly as before", () => {
  const c = formatConditions(CELL, railUnitsFor("CA"));
  assert.equal(c.tide, "+1.2m ▲");
  assert.equal(c.air, "20°C");
  assert.deepEqual(formatConditions(CELL), c, "the default is the Canadian rail");
  assert.deepEqual(formatConditions(CELL, railUnitsFor(null)), c);
});

test("rail: US water reads feet and Fahrenheit, current stays knots", () => {
  const c = formatConditions(CELL, railUnitsFor("US"));
  assert.equal(c.tide, "+3.9ft ▲");
  assert.equal(c.air, "68°F");
  assert.equal(c.current, "0.4 kn");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
