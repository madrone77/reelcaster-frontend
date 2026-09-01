// Unit tests for src/app/explore/lib/home-spot-prompt.ts — when the spot page
// is allowed to ask an angler to make the spot they are reading their home
// spot.
//
// The gate is the whole feature: offer too early and it is chrome, offer after
// a "no" and it is nagging. Everything below is about those two edges.
//
// Run with: npx tsx src/app/explore/lib/home-spot-prompt.test.ts

import assert from "node:assert/strict";
import {
  DWELL_MS,
  MAX_DISMISSALS,
  REPEAT_VIEW_THRESHOLD,
  SNOOZE_MS,
  promptEarned,
  readDismissState,
  readSpotViews,
  recordDismissal,
  recordSpotView,
} from "./home-spot-prompt";

// The module reads localStorage inside its functions rather than at import
// time, so standing the shim up here — after the import, before any call — is
// enough. Node has no web storage at all.
const store = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() {
    return store.size;
  },
} as Storage;

let passed = 0;
let failed = 0;
function test(name: string, fn: () => void) {
  store.clear();
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}\n    ${(e as Error).message}`);
    failed++;
  }
}

const NONE = { n: 0, until: 0 };
const NOW = 1_780_000_000_000;

console.log("\npromptEarned");

test("a first, brief visit has not earned the offer", () => {
  assert.equal(
    promptEarned({ views: 1, dwellMet: false, dismissals: NONE, now: NOW }),
    false,
  );
});

test("staying on a first visit earns it", () => {
  assert.equal(
    promptEarned({ views: 1, dwellMet: true, dismissals: NONE, now: NOW }),
    true,
  );
});

test("coming back earns it without waiting", () => {
  assert.equal(
    promptEarned({
      views: REPEAT_VIEW_THRESHOLD,
      dwellMet: false,
      dismissals: NONE,
      now: NOW,
    }),
    true,
  );
});

test("a view that has not been counted yet is never enough", () => {
  // `views` starts at 0 on the very first render, before the effect that
  // counts it runs. That must read as not-earned, or the bar flashes on
  // arrival — the exact behaviour the dwell exists to avoid.
  assert.equal(
    promptEarned({ views: 0, dwellMet: false, dismissals: NONE, now: NOW }),
    false,
  );
});

console.log("\npromptEarned · after a dismissal");

test("one Not now buys silence for the snooze window", () => {
  const dismissals = { n: 1, until: NOW + SNOOZE_MS };
  assert.equal(
    promptEarned({ views: 9, dwellMet: true, dismissals, now: NOW }),
    false,
  );
  assert.equal(
    promptEarned({
      views: 9,
      dwellMet: true,
      dismissals,
      now: NOW + SNOOZE_MS - 1,
    }),
    false,
  );
});

test("and lapses once the window is up", () => {
  const dismissals = { n: 1, until: NOW + SNOOZE_MS };
  assert.equal(
    promptEarned({
      views: 9,
      dwellMet: true,
      dismissals,
      now: NOW + SNOOZE_MS,
    }),
    true,
  );
});

test("the second Not now is permanent, snooze window or not", () => {
  const dismissals = { n: MAX_DISMISSALS, until: NOW + SNOOZE_MS };
  assert.equal(
    promptEarned({ views: 9, dwellMet: true, dismissals, now: NOW }),
    false,
  );
  // Long past any snooze — still no.
  assert.equal(
    promptEarned({
      views: 99,
      dwellMet: true,
      dismissals,
      now: NOW + 10 * SNOOZE_MS,
    }),
    false,
  );
});

test("a corrupt or absent dismissal record reads as never asked", () => {
  store.set("rc-home-prompt", "not json");
  assert.deepEqual(readDismissState(), NONE);
  store.set("rc-home-prompt", JSON.stringify({ n: "lots", until: "soon" }));
  assert.deepEqual(readDismissState(), NONE);
});

console.log("\nrecordDismissal");

test("counts up and stamps the snooze from the clock it is handed", () => {
  assert.deepEqual(recordDismissal(NOW), { n: 1, until: NOW + SNOOZE_MS });
  assert.deepEqual(recordDismissal(NOW + 5), { n: 2, until: NOW + 5 + SNOOZE_MS });
  assert.deepEqual(readDismissState(), { n: 2, until: NOW + 5 + SNOOZE_MS });
});

console.log("\nrecordSpotView");

test("counts per spot, and each spot separately", () => {
  assert.equal(recordSpotView("oak-bay-flats"), 1);
  assert.equal(recordSpotView("oak-bay-flats"), 2);
  assert.equal(recordSpotView("sooke-bluffs"), 1);
  assert.equal(readSpotViews("oak-bay-flats"), 2);
  assert.equal(readSpotViews("sooke-bluffs"), 1);
  assert.equal(readSpotViews("never-opened"), 0);
});

test("is bounded, and never evicts the spot being counted", () => {
  for (let i = 0; i < 60; i++) recordSpotView(`spot-${i}`);
  const stored = JSON.parse(store.get("rc-spot-views") as string);
  assert.ok(
    Object.keys(stored).length <= 40,
    `kept ${Object.keys(stored).length} spots`,
  );
  // The most recent survives; the oldest is gone.
  assert.equal(readSpotViews("spot-59"), 1);
  assert.equal(readSpotViews("spot-0"), 0);
});

test("survives a browser that refuses storage rather than throwing", () => {
  const real = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError: The operation is insecure.");
    },
  });
  try {
    // Every read falls back to "we know nothing", which the gate treats as
    // not earned — the feature switches itself off instead of taking the page
    // down. See [[incident-blocked-storage-whitescreen]].
    assert.equal(readSpotViews("oak-bay-flats"), 0);
    assert.deepEqual(readDismissState(), NONE);
    assert.equal(recordSpotView("oak-bay-flats"), 1);
    assert.equal(
      promptEarned({
        views: 0,
        dwellMet: false,
        dismissals: readDismissState(),
        now: NOW,
      }),
      false,
    );
  } finally {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: real,
    });
  }
});

console.log("\nconstants");

test("the dwell is long enough to outlast a mis-tap", () => {
  assert.ok(DWELL_MS >= 10_000, `${DWELL_MS}ms is too eager`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
