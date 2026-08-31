import { test, expect } from '@playwright/test';
import { loginAs, freeUser, setUserTier, resetUserState } from '../fixtures/users';

/**
 * Alerts is the only notification system now.
 *
 * The scheduled forecast digest that used to live at /profile/forecast-emails
 * is retired: the nightly job reported success for months while never sending
 * a single email, and it scored days with the legacy Open-Meteo calculation
 * rather than BlueCaster's. Its settings page, the /settings/preferences card
 * that embedded the same form, and the pipeline behind them are gone.
 *
 * What these tests hold onto is that the three retired paths still land
 * somewhere useful, because bookmarks outlive features.
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await setUserTier(freeUser.email, 'free');
  await resetUserState(freeUser.email);
});

/**
 * Asserted as a real 308 with `maxRedirects: 0`, not with `waitForURL`.
 *
 * These used to be page-level `permanentRedirect()` stubs marked
 * `dynamic = 'force-static'`, which does not emit a 308 at all: Next bakes the
 * redirect into the prerendered payload and the browser runs it on hydration.
 * `waitForURL` passes on that, so the previous version of this test claimed
 * "308" in its name while a crawler was being served a 200 and a full app
 * shell. They are `next.config.ts` redirects now. Check the status code.
 */
const RETIRED: Array<[string, string]> = [
  ['/profile/notification-settings', '/alerts'],
  ['/profile/forecast-emails', '/alerts'],
  ['/settings/preferences', '/profile'],
];

for (const [from, to] of RETIRED) {
  test(`${from} is a 308 to ${to}`, async ({ page }) => {
    const res = await page.request.get(from, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers()['location'], 'https://x').pathname).toBe(to);
  });
}

test('the settings hub offers Account, Alerts, and Units, and no Preferences', async ({ page }) => {
  await loginAs(page, freeUser);
  await page.goto('/profile');
  await expect(page.locator('a[href="/settings/account"]')).toBeVisible();
  await expect(page.locator('a[href="/settings/units"]')).toBeVisible();
  await expect(page.locator('a[href="/alerts"]')).toBeVisible();
  await expect(page.locator('a[href="/settings/preferences"]')).toHaveCount(0);
});

test('/alerts is the canonical alerts landing', async ({ page }) => {
  await loginAs(page, freeUser);
  const r = await page.goto('/alerts');
  expect(r?.status()).toBeLessThan(400);
});
