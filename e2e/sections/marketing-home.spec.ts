import { test, expect } from '@playwright/test';
import {
  assertHasMetaDescription,
  assertHasTitle,
} from '../helpers/seo';

/**
 * Phase 8 — section presence on the public homepage at `/`.
 *
 * Asserts each major section wrapper renders, plus chrome and SEO basics.
 * SpeciesPreview skips gracefully when the BC test instance has no
 * published species. (FeaturedCities/FeaturedSpots/DFO-alerts sections were
 * removed with the /fishing pages + scraper cleanup.)
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

  test('how-it-works section renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-how-it-works')).toBeVisible();
  });

  test('species preview section renders with at least one species card', async ({ page }) => {
    // Wait for AuthGate to flip from its Loading splash before asserting on
    // public-page testids (the SSR shell ships the testids inside an RSC
    // payload that only attaches to the DOM after hydration).
    await expect(page.getByTestId('marketing-header')).toBeVisible();
    await expect(page.getByTestId('homepage-species-preview')).toBeVisible();
    await expect(page.getByTestId('species-card').first()).toBeVisible();
  });

  test('removed homepage sections stay removed', async ({ page }) => {
    await expect(page.getByTestId('marketing-header')).toBeVisible();
    for (const removed of [
      'homepage-featured-cities',
      'homepage-featured-spots',
      'homepage-regulation-alerts',
    ]) {
      await expect(page.getByTestId(removed)).toHaveCount(0);
    }
  });

  test('final CTA section renders', async ({ page }) => {
    await expect(page.getByTestId('homepage-final-cta')).toBeVisible();
  });

  test('SEO basics: title + meta description', async ({ page }) => {
    // Note: the marketing homepage doesn't currently emit JSON-LD. If we add
    // a `WebSite` JSON-LD block later (see homepage SEO follow-up), assert it
    // here via assertHasJsonLd(page, 'WebSite').
    await assertHasTitle(page);
    await assertHasMetaDescription(page);
  });
});
