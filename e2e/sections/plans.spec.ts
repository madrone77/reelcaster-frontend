import { test, expect } from '@playwright/test';
import { assertHasMetaDescription, assertHasTitle } from '../helpers/seo';

/**
 * Section presence on `/plans` (was `/pricing`, retired in favour of the
 * sales page).
 *
 * Bare URL: feature callout is hidden.
 * `?feature=alerts`: feature callout is visible.
 */

test.describe('/plans', () => {
  test('renders without the feature callout when no ?feature= query is set', async ({ page }) => {
    const r = await page.goto('/plans');
    expect(r?.status()).toBeLessThan(400);

    await expect(page.getByTestId('plans-feature-callout')).toHaveCount(0);
    await assertHasTitle(page);
    await assertHasMetaDescription(page);
  });

  test('renders the feature callout when ?feature=alerts is set', async ({ page }) => {
    await page.goto('/plans?feature=alerts');
    await expect(page.getByTestId('plans-feature-callout')).toBeVisible();
  });

  // The paywall CTAs send `favorite-spots`; the retired page only mapped
  // `favorites`, so this callout silently rendered nothing. Pin both slugs.
  test('renders the feature callout for the slug the paywall actually sends', async ({ page }) => {
    await page.goto('/plans?feature=favorite-spots');
    await expect(page.getByTestId('plans-feature-callout')).toBeVisible();
  });

  test('shows the free-vs-Pro comparison table', async ({ page }) => {
    await page.goto('/plans');
    await expect(page.getByRole('table')).toBeVisible();
  });
});

test.describe('/pricing → /plans', () => {
  test('the retired pricing URL redirects to the sales page', async ({ page }) => {
    const r = await page.goto('/pricing');
    expect(r?.status()).toBeLessThan(400);
    expect(new URL(page.url()).pathname).toBe('/plans');
  });

  test('the monthly deep link lands on checkout with the plan preserved', async ({ page }) => {
    await page.goto('/pricing?plan=monthly');
    const url = new URL(page.url());
    expect(url.pathname).toBe('/plans/checkout');
    expect(url.searchParams.get('plan')).toBe('monthly');
  });
});
