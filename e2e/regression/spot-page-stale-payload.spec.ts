import { test, expect } from '@playwright/test';

/**
 * The spot page must survive hydrating an HTML payload from an *older build*.
 *
 * The page is prerendered and ISR-cached, and a cached copy can outlive the
 * deploy that produced it. So a visitor can receive HTML generated before a
 * server→client prop existed, and hydrate it with a bundle that expects that
 * prop. The prop arrives `undefined`.
 *
 * That is not a theoretical concern: `new Date(undefined)` is an Invalid Date,
 * every `Intl` call on one throws `RangeError: date value is not finite`, and
 * the throw escapes into Next's root error boundary, which replaces the whole
 * page. Adding `serverNowMs` shipped exactly this — the deploy that introduced
 * the prop could blank the page for anyone still holding a pre-deploy copy,
 * which is the opposite of what that deploy was fixing.
 *
 * Stripping the prop from the served HTML reproduces it precisely. A hydration
 * mismatch here is acceptable and expected — the old HTML really does say
 * something different. A thrown exception is not.
 */

const SPOT = '/explore/spot/constance-bank-7615cc';

/** Props a stale payload could be missing, newest first. */
const PROPS = ['serverNowMs', 'tz', 'seedHour', 'seedTzAbbrev'];

for (const prop of PROPS) {
  test(`spot page survives a cached payload with no "${prop}"`, async ({ page }) => {
    const fatal: string[] = [];
    page.on('pageerror', (e) => fatal.push(e.message));

    await page.route(`**${SPOT}`, async (route) => {
      const res = await route.fetch();
      const body = (await res.text())
        .replace(new RegExp(`\\\\?"${prop}\\\\?":("[^"]*"|[\\d.]+),?`, 'g'), '')
        .replace(new RegExp(`"${prop}":("[^"]*"|[\\d.]+),?`, 'g'), '');
      return route.fulfill({
        response: res,
        body,
        headers: { ...res.headers(), 'content-type': 'text/html; charset=utf-8' },
      });
    });

    const res = await page.goto(SPOT);
    expect(res?.status()).toBeLessThan(400);

    await expect(page.getByText('Application error')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Constance Bank/i })).toBeVisible();

    // Hydration mismatches are fine here; a thrown exception is not.
    const thrown = fatal.filter((e) => !/Minified React error #(418|421|422|423|425)/.test(e));
    expect(thrown, `uncaught errors with "${prop}" missing:\n${thrown.join('\n')}`).toEqual([]);
  });
}
