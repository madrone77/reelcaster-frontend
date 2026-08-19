import { test, expect } from '@playwright/test';

/**
 * The spot page must hydrate cleanly against a *stale* cached copy of itself.
 *
 * The page is prerendered and served from the ISR cache, so its HTML can be
 * arbitrarily older than the moment a visitor loads it. Anything that reads the
 * clock during render therefore produces one answer on the server and a
 * different one on the client, and React aborts hydration with error #418 —
 * which Next surfaces as "Application error: a client-side exception has
 * occurred", replacing the fully-painted page about a second after it appears.
 *
 * That shipped, and it was invisible in normal testing: a warm edge serves HTML
 * that is seconds old, so server and client agree and everything looks fine.
 * It only broke for visitors whose edge held an older copy — which read as a
 * device-specific bug and took a long time to pin down.
 *
 * Advancing the browser clock reproduces cache staleness exactly: the HTML is
 * whatever the edge has, and the client believes it is later. Any regression
 * that puts a live clock read back into render fails here.
 */

const SPOT = '/explore/spot/constance-bank-7615cc';

/** Enough skew to cross an hour boundary, plus a day and a week. */
const SKEWS_HOURS = [0, 1, 5, 25, 170];

for (const hours of SKEWS_HOURS) {
  test(`spot page hydrates with the client clock +${hours}h vs the cached HTML`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.clock.install({ time: new Date(Date.now() + hours * 3600_000) });

    const res = await page.goto(SPOT);
    expect(res?.status()).toBeLessThan(400);

    // The crash lands shortly after first paint, so assert on settled state
    // rather than the initial render.
    await expect(page.getByText('Application error')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Constance Bank/i })).toBeVisible();

    const hydrationErrors = errors.filter((e) =>
      /Minified React error #(418|421|422|423|425)|hydrat/i.test(e),
    );
    expect(
      hydrationErrors,
      `hydration errors at +${hours}h skew:\n${hydrationErrors.join('\n')}`,
    ).toEqual([]);
  });
}

test('the NOW label reflects the viewer clock, not the moment the page was cached', async ({
  page,
}) => {
  // Pin the clock to a known hour, then confirm the page adopts it after mount
  // rather than displaying whatever hour the cached HTML was generated in.
  const pinned = new Date();
  pinned.setHours(3, 30, 0, 0);
  await page.clock.install({ time: pinned });

  await page.goto(SPOT);
  await expect(page.getByText(/NOW · 3 AM/)).toBeVisible();
});
