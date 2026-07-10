import { test, expect } from '@playwright/test';
import { freeUser, proUser, setUserTier, resetUserState } from '../fixtures/users';

/**
 * Phase 7 — full-funnel canary.
 *
 * The end-to-end signal that the public → free → pro flow still works.
 * This spec doesn't fill a Stripe card form — that lives in
 * `e2e/paywall/checkout-flow.spec.ts` once the test-mode key is wired in
 * deploy envs. The old dashboard/onboarding legs were removed with the
 * dashboard feature; post-auth flows now land on /explore.
 *
 * Requires a populated `.env.test` and seeded `freeUser` / `proUser`.
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await setUserTier(freeUser.email, 'free');
  await resetUserState(freeUser.email);
  await setUserTier(proUser.email, 'pro_annual');
  await resetUserState(proUser.email);
});

test('public marketing homepage renders for an unauthed visitor', async ({ page }) => {
  const homepage = await page.goto('/');
  expect(homepage?.status()).toBeLessThan(400);
  await expect(page.getByTestId('marketing-hero-headline')).toBeVisible();
  await expect(page.getByTestId('marketing-primary-cta')).toHaveAttribute('href', /\/signup/);
});

test('legacy routes are gone', async ({ page }) => {
  for (const path of ['/v1', '/14-day-report', '/map-test', '/dashboard', '/fishing', '/historical-reports', '/my-spots', '/favorite-spots']) {
    const r = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(r?.status(), `${path} should be 404`).toBe(404);
  }
});
