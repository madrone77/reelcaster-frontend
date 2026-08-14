import { test, expect, type Browser } from '@playwright/test';

/**
 * `/explore?loc=<city>` must be answered by the SERVER, not by the client.
 *
 * The Explore canvas has always honoured `?loc` — the shell resolves the slug,
 * frames the city, and loads its spots as the map moves. What it could not do
 * was make any of that happen before hydration. The page shipped the default
 * city's spots and the default city's prefetched 14-day strip, the shell threw
 * both away because the URL named somewhere else, and the deep link then spent
 * a continent-wide `map/spots` fetch discovering what its own URL had said in
 * the first place.
 *
 * Every assertion here runs with the client's API calls BLOCKED. That is the
 * whole point: whatever renders came out of the server response. Before the
 * fix, this page rendered "0 spots / No published spots here yet" under those
 * conditions.
 */

// The rail is desktop-only (lg+), and the spot count lives in it.
test.use({ viewport: { width: 1440, height: 900 } });

interface Render {
  text: string;
  /** Spots in the rail, per the "N spots" count the shell renders. */
  count: number;
  fatal: string[];
}

/**
 * Load in a fresh context with every client-side bluecaster call aborted, and
 * read what the server alone put on the page.
 *
 * A fresh context per case matters beyond isolation: the shell restores a
 * remembered camera from localStorage on a bare /explore, so a reused profile
 * would have the first case steering the second.
 */
async function serverOnlyRender(browser: Browser, url: string): Promise<Render> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  try {
    const page = await ctx.newPage();
    const fatal: string[] = [];
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.route('**/api/bluecaster/**', (r) => r.abort());

    const res = await page.goto(url);
    expect(res?.status(), `${url} should serve a page`).toBeLessThan(400);

    // Poll the rendered text rather than a selector: the count sits in a
    // truncating div that several looser locators also match.
    let text = '';
    await expect
      .poll(
        async () => {
          text = await page.locator('body').innerText();
          return /\d+\s+spots?\b|No published spots here yet/.test(text);
        },
        { message: `${url} never settled into a rail state` },
      )
      .toBe(true);

    const m = text.match(/(\d+)\s+spots?\b/);
    return { text, count: m ? Number(m[1]) : 0, fatal };
  } finally {
    await ctx.close();
  }
}

test('a ?loc deep link is framed by the server, not discovered by the client', async ({
  browser,
}) => {
  const { text, count, fatal } = await serverOnlyRender(
    browser,
    '/explore?loc=vancouver-bc',
  );

  expect(fatal, 'no exception during hydration').toEqual([]);
  // The regression this pins: with the client offline the page used to say
  // "0 spots" for the whole pre-hydration window.
  expect(count, 'Vancouver spots came from the server response').toBeGreaterThan(0);
  expect(text).toContain('Vancouver');
  expect(text).not.toContain('No published spots here yet');
});

test('the prefetched 14-day strip covers the linked city, so it paints offline', async ({
  browser,
}) => {
  const { text } = await serverOnlyRender(browser, '/explore?loc=vancouver-bc');

  // Score bands render from the strip payload. With the API blocked the only
  // way any exist is the server's prefetch, and the server only prefetches a
  // box it cut from the city the URL named.
  const bands = text.match(/\b(SLOW|FAIR|GOOD|PRIME)\b/g) ?? [];
  expect(bands.length, 'strip painted from the server prefetch').toBeGreaterThan(0);
});

test('bare /explore still opens on the default city', async ({ browser }) => {
  const { count, fatal } = await serverOnlyRender(browser, '/explore');

  expect(fatal).toEqual([]);
  expect(count, 'the default city still ships in the first response').toBeGreaterThan(0);
});

test('an unresolvable ?loc falls back to the default city, not to an empty map', async ({
  browser,
}) => {
  // A renamed slug, a hand-edited URL, or a probe. The slug goes into an
  // upstream `city=` fetch, so it is gated on the covered-city tree first (see
  // `coveredCitySlug`); anything failing that gate lands where a bare /explore
  // does. Asserting against the bare page rather than a hardcoded "Victoria"
  // keeps this true if the default city ever changes.
  const bare = await serverOnlyRender(browser, '/explore');
  expect(bare.count).toBeGreaterThan(0);

  for (const bad of ['not-a-city', '../../etc/passwd']) {
    const { count, fatal } = await serverOnlyRender(
      browser,
      `/explore?loc=${encodeURIComponent(bad)}`,
    );
    expect(fatal, `?loc=${bad} must not throw`).toEqual([]);
    expect(count, `?loc=${bad} falls back to the default city`).toBe(bare.count);
  }
});
