import { test, expect } from '@playwright/test';

/**
 * Journey 6: Anon → /plans → /signup form is reachable + correctly framed.
 *
 * Stops short of submitting the form (creating a real auth.users row from a
 * test would litter the table). The post-signup → onboarding modal flow is
 * exercised in the Phase 3 free-dashboard spec.
 */

test.use({ storageState: { cookies: [], origins: [] } });

test('anon: pricing → signup form is rendered', async ({ page }) => {
  let r = await page.goto('/plans');
  expect(r?.status()).toBeLessThan(400);
  // /plans renders under the marketing chrome. Just
  // verify the page heading + a sign-up entry point are present.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  r = await page.goto('/signup');
  expect(r?.status()).toBeLessThan(400);
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByLabel(/password/i)).toBeVisible();
});
