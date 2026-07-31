import { test, expect } from '@playwright/test';
import {
  assertHasMetaDescription,
  assertHasJsonLd,
  assertHasTitle,
} from '../helpers/seo';

/**
 * Phase 2 marketing flow: signed-out user lands on /, browses to city/spot/species,
 * hits sign-up gate. No authentication required for any of these specs.
 */

test.describe('Marketing homepage (/)', () => {
  test('renders without auth and shows hero + sign-up CTA', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    await expect(page.getByTestId('marketing-hero-headline')).toBeVisible();
    await expect(page.getByTestId('marketing-primary-cta')).toBeVisible();
    await expect(page.getByTestId('marketing-primary-cta')).toHaveAttribute(
      'href',
      /\/signup/,
    );

    await expect(page.getByTestId('marketing-header')).toBeVisible();
    await expect(page.getByTestId('marketing-footer')).toBeVisible();

    await assertHasTitle(page);
    await assertHasMetaDescription(page);
    await assertHasJsonLd(page, 'WebSite');
  });

});

test.describe('Public footer pages', () => {
  const PAGES: Array<{ path: string; jsonLd?: string }> = [
    { path: '/privacy', jsonLd: 'WebPage' },
    { path: '/terms', jsonLd: 'WebPage' },
    { path: '/contact', jsonLd: 'ContactPage' },
    { path: '/about', jsonLd: 'AboutPage' },
    { path: '/faq', jsonLd: 'FAQPage' },
  ];

  for (const { path, jsonLd } of PAGES) {
    test(`${path} renders with title, meta description, and JSON-LD`, async ({
      page,
    }) => {
      const r = await page.goto(path);
      expect(r?.status()).toBeLessThan(400);
      await assertHasTitle(page);
      await assertHasMetaDescription(page);
      if (jsonLd) {
        await assertHasJsonLd(page, jsonLd);
      }
      // Marketing chrome is shared across (marketing) route group.
      await expect(page.getByTestId('marketing-footer-legal')).toBeVisible();
    });
  }
});

test.describe('Sitemap + robots', () => {
  test('/sitemap.xml lists key public surfaces', async ({ request }) => {
    const r = await request.get('/sitemap.xml');
    expect(r.status()).toBe(200);
    const xml = await r.text();
    expect(xml).toContain('<?xml');
    expect(xml).toContain('https://reelcaster.com/');
    expect(xml).toContain('/plans');
    expect(xml).toContain('/privacy');
  });

  test('/robots.txt blocks gated surfaces', async ({ request }) => {
    const r = await request.get('/robots.txt');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body.toLowerCase()).toContain('user-agent');
    expect(body).toMatch(/Disallow:\s*\/profile\//);
    expect(body).toMatch(/Disallow:\s*\/api\//);
  });
});
