import { test, expect, type Browser } from '@playwright/test';

/**
 * `/explore?spot=<slug>` must be answered by the SERVER, not by the client.
 *
 * The companion to explore-loc-ssr.spec.ts, for the deep link with the longer
 * chain. `map/spots` takes a city or a bbox and never a spot, so the shell
 * could not find a linked slug among the default city's spots; it asked
 * `spot-coords` where the spot was, flew 800 ms to it, and only then did the
 * settled viewport pull in the spots that let the drawer open. Every leg of
 * that waited on the JS bundle first.
 *
 * As with ?loc, every assertion runs with the client's API calls BLOCKED, so
 * whatever renders came out of the server response. Before the fix this page
 * rendered Victoria — the wrong city, no drawer, nothing about the link.
 */

/** A published spot deliberately NOT in the default city, so the test is real. */
const SPOT = 'howe-sound-pam-rock-worlcombe-island-area--f46c86';
const SPOT_NAME = /Pam Rock|Worlcombe/i;

async function serverOnly(browser: Browser, url: string) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await ctx.newPage();
    const fatal: string[] = [];
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.route('**/api/bluecaster/**', (r) => r.abort());

    const res = await page.goto(url);
    expect(res?.status(), `${url} should serve a page`).toBeLessThan(400);
    // Settled once the shell has rendered its rail — either the spot drawer or
    // the city list, whichever this URL earns.
    await expect
      .poll(async () => {
        const t = await page.locator('body').innerText();
        return SPOT_NAME.test(t) || /\d+\s+spots?\b/.test(t);
      })
      .toBe(true);

    return { text: await page.locator('body').innerText(), fatal };
  } finally {
    await ctx.close();
  }
}

test('a ?spot deep link opens its drawer from the server response', async ({
  browser,
}) => {
  const { text, fatal } = await serverOnly(browser, `/explore?spot=${SPOT}`);

  expect(fatal, 'no exception during hydration').toEqual([]);
  // The regression: with the client offline this used to render the default
  // city and nothing at all about the linked spot.
  expect(text, 'the drawer names the linked spot').toMatch(SPOT_NAME);
  expect(text).not.toContain('South Vancouver Island');
});

test('the payload is a box around the spot, not the spot alone', async ({ browser }) => {
  const { text } = await serverOnly(browser, `/explore?spot=${SPOT}`);

  // The drawer replaces the rail list, so the neighbours show up as map pins
  // rather than cards. What matters is that the strip painted: it is fed by the
  // prefetch for the spot's box, and an empty box would leave it blank.
  const days = text.match(/\b(Aug|Sep|Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul)\s+\d{1,2}\b/g) ?? [];
  expect(days.length, '14-day strip painted from the server prefetch').toBeGreaterThan(5);
});

test('the spot-coords round trip is gone', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const calls: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/spot-coords|\/map\/spots/.test(u)) calls.push(u.replace(/^https?:\/\/[^/]+/, ''));
  });

  await page.goto(`/explore?spot=${SPOT}`);
  await expect.poll(async () => calls.length > 0).toBe(true);
  await page.waitForTimeout(3000);

  // The server resolved the slug, so the client never has to ask where the spot
  // is — that hop was the first link in the old chain.
  expect(
    calls.filter((c) => c.includes('spot-coords')),
    'no client-side spot-coords lookup',
  ).toEqual([]);

  // And it never sat on the default city: the first spots request is for the
  // spot's own water, not Victoria's. (Victoria is around -123.5,48.4.)
  const firstSpots = calls.find((c) => c.includes('/map/spots'));
  expect(firstSpots, 'a spots request was made').toBeTruthy();
  expect(firstSpots, 'the first spots fetch is the spot box, not the default city')
    .toMatch(/bbox=-123\.\d+%2C49\./);

  await ctx.close();
});

test('an unresolvable ?spot falls through to the default city', async ({ browser }) => {
  // Unpublished, renamed, or invented. `fetchSpotCoords` returns nothing, the
  // page takes the ?loc/default path, and the client behaves exactly as it did
  // before any of this — including its own flyTo if the slug turns out to be
  // real but unpublished.
  const { text, fatal } = await serverOnly(browser, '/explore?spot=not-a-real-spot');

  expect(fatal).toEqual([]);
  expect(text).toMatch(/\d+\s+spots?\b/);
  expect(text).not.toMatch(SPOT_NAME);
});
