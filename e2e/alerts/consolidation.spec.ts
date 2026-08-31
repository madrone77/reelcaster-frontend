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

for (const from of ['/profile/notification-settings', '/profile/forecast-emails']) {
  test(`${from} → /alerts`, async ({ page }) => {
    await loginAs(page, freeUser);
    await page.goto(from);
    await page.waitForURL((url) => url.pathname === '/alerts', { timeout: 10_000 });
  });
}

test('/settings/preferences → /profile', async ({ page }) => {
  await loginAs(page, freeUser);
  await page.goto('/settings/preferences');
  await page.waitForURL((url) => url.pathname === '/profile', { timeout: 10_000 });
});

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
