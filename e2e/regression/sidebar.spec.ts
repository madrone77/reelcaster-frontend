import { test, expect } from '@playwright/test';
import { env } from '../fixtures/env';
import { freeUser, loginAs, setUserTier, resetUserState } from '../fixtures/users';

/**
 * Pin the authed icon-sidebar to exactly the three product-blueprint nodes:
 *   Alerts · Catch Log · Profile
 *
 * The Search button lives outside MAIN_NAV_ITEMS, so it's not part of the
 * testid set. Removed entries (Dashboard, My Spots, Reports, Species
 * Calendar, DFO Notices) must NOT reappear without an explicit decision.
 */

const enabled =
  Boolean(env.supabaseUrl) &&
  Boolean(env.supabaseServiceRoleKey) &&
  Boolean(freeUser.email) &&
  Boolean(freeUser.password);

test.describe('regression: icon sidebar shape', () => {
  test.skip(!enabled, 'admin/test-user credentials missing in .env.test');

  test.beforeEach(async () => {
    await setUserTier(freeUser.email, 'free');
    await resetUserState(freeUser.email);
  });

  test('icon sidebar shows exactly 3 nav entries with the expected hrefs', async ({
    page,
  }) => {
    // The icon sidebar is desktop-only (lg:flex w-[100px]). Force a wide
    // viewport so the assertions don't accidentally match the mobile bar.
    await page.setViewportSize({ width: 1440, height: 900 });

    await loginAs(page, freeUser);
    const r = await page.goto('/alerts');
    expect(r?.status()).toBeLessThan(400);
    await expect(page.getByText(/Loading\.\.\./).first()).toHaveCount(0, { timeout: 15_000 });

    const expected = [
      { id: 'alerts', href: '/alerts' },
      { id: 'catch-log', href: '/profile/catch-log' },
      { id: 'profile', href: '/profile' },
    ] as const;

    for (const { id, href } of expected) {
      const link = page.getByTestId(`nav-${id}`).first();
      await expect(link, `nav-${id} should be visible`).toBeVisible();
      await expect(link).toHaveAttribute('href', href);
    }

    for (const removed of ['dashboard', 'my-spots', 'reports', 'species-calendar', 'dfo-notices']) {
      await expect(
        page.getByTestId(`nav-${removed}`),
        `nav-${removed} should not exist after sidebar cleanup`,
      ).toHaveCount(0);
    }
  });
});
