/**
 * Run with: npx tsx src/app/lp/_shared/lp-via.test.ts
 *
 * The stamp is one parameter, but a malformed one would either be dropped by
 * the counter's validation (and the arrival read as an ad again) or, worse,
 * accepted as a new row. These pin the shape at both ends.
 */

import assert from "node:assert/strict";
import { exploreHrefFrom, parseVia, viaAngle, VIA_ANGLE_SHAPE } from "./lp-via";

function testParseViaAcceptsLandingKeys() {
  assert.equal(parseVia("lpseattle1"), "lpseattle1");
  assert.equal(parseVia("lpvancouver4"), "lpvancouver4");
  assert.equal(parseVia("lp7"), "lp7");
  assert.equal(parseVia("LPSEATTLE1"), "lpseattle1", "case from a hand-edited link is not a new row");
}

function testParseViaRejectsEverythingElse() {
  for (const bad of ["", "seattle1", "spot", "explore", "lp", "lp:seattle1", "lp seattle", "lp/seattle/1", 42, null, undefined]) {
    assert.equal(parseVia(bad), null, String(bad));
  }
}

function testAngleShape() {
  assert.equal(viaAngle("lpseattle1"), "lp:lpseattle1");
  assert.ok(VIA_ANGLE_SHAPE.test(viaAngle("lpseattle1")));
  assert.ok(!VIA_ANGLE_SHAPE.test("lp:"));
  assert.ok(!VIA_ANGLE_SHAPE.test("proof"), "a real angle id is not a stamp");
}

function testButtonLinkCarriesTheStamp() {
  assert.equal(exploreHrefFrom("seattle-wa", "lpseattle1"), "/explore?loc=seattle-wa&ad=day2&via=lpseattle1");
  // A page with no valid key still opens the frame, just unstamped.
  assert.equal(exploreHrefFrom("seattle-wa", ""), "/explore?loc=seattle-wa&ad=day2");
}

const tests = [
  testParseViaAcceptsLandingKeys,
  testParseViaRejectsEverythingElse,
  testAngleShape,
  testButtonLinkCarriesTheStamp,
];

let failed = 0;
for (const t of tests) {
  try {
    t();
    console.log(`ok   ${t.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${t.name}`);
    console.error(err);
  }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
