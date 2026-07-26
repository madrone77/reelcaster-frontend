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
    await expect(cta).toHaveAttribute('href', /\/signup/);
  });

  test('score ticker renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-ticker')).toBeVisible();
  });

  test('pricing section renders with free + pro CTAs', async ({ page }) => {
    const pricing = page.getByTestId('homepage-pricing');
    await expect(pricing).toBeVisible();
    await expect(
      pricing.getByRole('link', { name: 'START FREE', exact: true }),
    ).toHaveAttribute('href', '/signup');
    await expect(
      pricing.getByRole('link', { name: 'START REELCASTER PRO', exact: true }),
    ).toHaveAttribute('href', '/plans');
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
