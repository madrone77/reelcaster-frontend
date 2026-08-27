// Unit tests for src/app/explore/lib/home-spot-cookie.ts — the cookie mirror
// of the home-spot pin that lets /explore open on the home city in its first
// render.
//
// `sanitizeHomeSpotSlug` is the only guard between a value client JS wrote and
// an upstream request path, so the cases below are about what it refuses.
//
// Run with: npx tsx src/app/explore/lib/home-spot-cookie.test.ts

import assert from "node:assert/strict";
import {
  HOME_SPOT_COOKIE,
  sanitizeHomeSpotSlug,
  writeHomeSpotCookie,
} from "./home-spot-cookie";

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

console.log("\nsanitizeHomeSpotSlug");

test("passes a real spot slug through", () => {
  assert.equal(sanitizeHomeSpotSlug("oak-bay-flats"), "oak-bay-flats");
  assert.equal(sanitizeHomeSpotSlug("area-19"), "area-19");
});

test("absent, empty and undefined all read as no pin", () => {
  assert.equal(sanitizeHomeSpotSlug(null), null);
  assert.equal(sanitizeHomeSpotSlug(undefined), null);
  assert.equal(sanitizeHomeSpotSlug(""), null);
});

test("refuses anything that could steer the upstream path", () => {
  // The slug is interpolated into a BlueCaster request, so a traversal or a
  // query fragment must not survive the read.
  assert.equal(sanitizeHomeSpotSlug("../../admin"), null);
  assert.equal(sanitizeHomeSpotSlug("oak-bay?spots=all"), null);
  assert.equal(sanitizeHomeSpotSlug("oak bay"), null);
  assert.equal(sanitizeHomeSpotSlug("Oak-Bay"), null);
  assert.equal(sanitizeHomeSpotSlug("oak/bay"), null);
  assert.equal(sanitizeHomeSpotSlug("a".repeat(81)), null);
});

console.log("\nwriteHomeSpotCookie");

test("is a no-op on the server rather than a crash", () => {
  // The module is imported by a server component for its constant, and the
  // hook that calls this runs in effects — but a stray call must not throw.
  assert.equal(typeof document, "undefined");
  writeHomeSpotCookie("oak-bay-flats");
});

test("the cookie name is the one the page reads", () => {
  assert.equal(HOME_SPOT_COOKIE, "rc-home-spot");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
