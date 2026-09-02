// Unit tests for `readHomeCityPrefs` in ./home-city-server.ts — pulling the two
// home settings out of a free-form auth metadata blob.
//
// The empty string is the case worth pinning. Both settings are CLEARED by
// writing "" rather than by deleting the key (see `saveHomeSpot` and
// `saveHomeCity`), so anything that treats the key's presence as the answer
// hands back a blank slug for every angler who ever set one and changed their
// mind. Downstream that blank goes into a city lookup that finds nothing, and
// the fallback tiers below it never run: the angler gets an empty dashboard
// because of a value that means "no answer".
//
// Run with: npx tsx src/lib/home-city-server.test.ts

import assert from "node:assert/strict";
import { readHomeCityPrefs } from "./home-city-server";

const meta = (preferences: unknown) => ({ preferences });

console.log("readHomeCityPrefs");

{
  const prefs = readHomeCityPrefs(
    meta({ homeCitySlug: "victoria-bc", homeSpotSlug: "oak-bay-flats" }),
  );
  assert.equal(prefs.homeCitySlug, "victoria-bc");
  assert.equal(prefs.homeSpotSlug, "oak-bay-flats");
  console.log("  ✓ reads both settings");
}

{
  const prefs = readHomeCityPrefs(meta({ homeCitySlug: "", homeSpotSlug: "" }));
  assert.equal(prefs.homeCitySlug, undefined);
  assert.equal(prefs.homeSpotSlug, undefined);
  console.log("  ✓ an empty string is a cleared setting, not a blank slug");
}

{
  const prefs = readHomeCityPrefs(meta({ homeCitySlug: "  seattle-wa  " }));
  assert.equal(prefs.homeCitySlug, "seattle-wa");
  console.log("  ✓ trims");
}

{
  // Whitespace only is somebody's fat finger, and it clears nothing and names
  // nothing. Same answer as an empty string.
  const prefs = readHomeCityPrefs(meta({ homeCitySlug: "   " }));
  assert.equal(prefs.homeCitySlug, undefined);
  console.log("  ✓ whitespace only reads as no answer");
}

{
  // The blob is written by a client this module does not control, so every
  // shape it could arrive in has to read as "nothing stated" rather than throw
  // on a dashboard load.
  for (const input of [null, undefined, {}, "nonsense", 7, meta(null), meta("x")]) {
    const prefs = readHomeCityPrefs(input);
    assert.equal(prefs.homeCitySlug, undefined);
    assert.equal(prefs.homeSpotSlug, undefined);
  }
  assert.equal(readHomeCityPrefs(meta({ homeCitySlug: 42 })).homeCitySlug, undefined);
  console.log("  ✓ junk metadata reads as nothing stated");
}

console.log("\nall passed");
