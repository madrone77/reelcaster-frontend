import { test, expect } from '@playwright/test';
import {
  assertHasMetaDescription,
  assertHasTitle,
} from '../helpers/seo';

/**
 * Phase 8 — section presence on the public homepage at `/`.
 *
 * The homepage is the light "rc" landing page (2026-07 redesign): hero with
 * demo score card, score ticker, two-plan pricing, data sources, signals
 * ("how it works"), map, features grid, and final CTA band. Asserts each
 * major section wrapper renders, plus chrome and SEO basics.
 */

test.describe('/ (marketing homepage)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('marketing chrome renders', async ({ page }) => {
    await expect(page.getByTestId('marketing-header')).toBeVisible();
    await expect(page.getByTestId('marketing-footer')).toBeVisible();
  });

  test('hero section + headline + primary CTA render', async ({ page }) => {
    await expect(page.getByTestId('homepage-hero')).toBeVisible();
    await expect(page.getByTestId('marketing-hero-headline')).toBeVisible();
    const cta = page.getByTestId('marketing-primary-cta');
    await expect(cta).toBeVisible();
    // It opens the trial modal; it is not a link to /signup and has not been
    // one since TrialModalButton replaced the signup links. This asserted an
    // href for months and passed nowhere, because e2e is not in CI.
    await cta.click();
    await expect(page.getByTestId('pro-trial-modal')).toBeVisible();
  });

  test('score ticker renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-ticker')).toBeVisible();
  });

  // Both pricing CTAs are buttons that open the trial modal, not links. The
  // caps are `text-transform: uppercase` rather than markup, so match the
  // accessible name case-insensitively and don't couple the test to CSS. The
  // Pro label interpolates TRIAL_DAYS, so match its shape rather than its
  // words.
  test('pricing section renders with member + pro CTAs', async ({ page }) => {
    const pricing = page.getByTestId('homepage-pricing');
    await expect(pricing).toBeVisible();

    const member = pricing.getByRole('button', { name: /^become a member$/i });
    const pro = pricing.getByRole('button', { name: /start .*free trial/i });
    await expect(member).toBeVisible();
    await expect(pro).toBeVisible();

    // The one that matters: the free-of-charge column still opens the offer.
    await member.click();
    await expect(page.getByTestId('pro-trial-modal')).toBeVisible();
  });

  test('how-it-works (signals) section renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-how-it-works')).toBeVisible();
  });

  test('features section renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-features')).toBeVisible();
  });

  test('final CTA section renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-final-cta')).toBeVisible();
  });

  test('removed homepage sections stay removed', async ({ page }) => {
    await expect(page.getByTestId('marketing-header')).toBeVisible();
    for (const removed of [
      'homepage-species-preview',
      'homepage-featured-cities',
      'homepage-featured-spots',
      'homepage-regulation-alerts',
    ]) {
      await expect(page.getByTestId(removed)).toHaveCount(0);
    }
  });

  test('SEO basics: title + meta description', async ({ page }) => {
    await assertHasTitle(page);
    await assertHasMetaDescription(page);
  });
});
