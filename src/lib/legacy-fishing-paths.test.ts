import assert from "node:assert";
import { newFishingPath } from "./legacy-fishing-paths";

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test("province index gains its country", () => {
  assert.equal(newFishingPath("/fishing/bc"), "/fishing/ca/bc");
  assert.equal(newFishingPath("/fishing/wa"), "/fishing/us/wa");
});

test("the city segment loses its province suffix", () => {
  assert.equal(newFishingPath("/fishing/bc/victoria-bc"), "/fishing/ca/bc/victoria");
  assert.equal(newFishingPath("/fishing/wa/seattle-wa"), "/fishing/us/wa/seattle");
});

test("guides move under the literal species segment", () => {
  assert.equal(
    newFishingPath("/fishing/bc/vancouver-bc/chinook-salmon"),
    "/fishing/ca/bc/vancouver/species/chinook-salmon",
  );
});

/**
 * The country slot and the state slot share the string "ca": Canada above,
 * California below. Only position separates them, so a new-shape URL must bail
 * before the province lookup or /fishing/ca/bc would be read as legacy.
 */
test("a new-shape URL is left alone", () => {
  for (const p of [
    "/fishing/ca",
    "/fishing/ca/bc",
    "/fishing/ca/bc/victoria",
    "/fishing/ca/bc/victoria/oak-bay",
    "/fishing/us/wa/seattle",
  ]) {
    assert.equal(newFishingPath(p), null, p);
  }
});

test("paths that are not ours yield null", () => {
  for (const p of ["/", "/explore", "/fishing", "/fishing-licence/bc", "/fishing/zz"]) {
    assert.equal(newFishingPath(p), null, p);
  }
});

test("a trailing slash does not change the answer", () => {
  assert.equal(newFishingPath("/fishing/bc/victoria-bc/"), "/fishing/ca/bc/victoria");
});

/** Nothing deeper than a guide ever existed, so there is nothing to invent. */
test("a path deeper than a guide is not translated", () => {
  assert.equal(newFishingPath("/fishing/bc/victoria-bc/chinook-salmon/extra"), null);
});

/**
 * An unpublished city's old URL would otherwise redirect to its new path and
 * land on a 404. The state page is the nearest true answer, and its guides are
 * gone with it.
 */
test("a retired city and everything under it goes to the state page", () => {
  assert.equal(newFishingPath("/fishing/wa/bellingham-wa"), "/fishing/us/wa");
  assert.equal(newFishingPath("/fishing/wa/bellingham-wa/lingcod"), "/fishing/us/wa");
  // Its neighbours are unaffected.
  assert.equal(newFishingPath("/fishing/wa/seattle-wa"), "/fishing/us/wa/seattle");
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name}`);
    console.error(err);
  }
}
console.log(`${tests.length - failed}/${tests.length} passed`);
if (failed) process.exit(1);
