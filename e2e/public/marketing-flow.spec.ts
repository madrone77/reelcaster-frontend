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

test.describe('Species pages', () => {
  test('/species lists species', async ({ page }) => {
    const r = await page.goto('/species');
    expect(r?.status()).toBeLessThan(400);
    const list = page.getByTestId('species-list');
    await expect(list).toBeVisible();
    await assertHasTitle(page);
    await assertHasJsonLd(page, 'CollectionPage');
  });

  test('/species/<slug> renders detail page', async ({ page }) => {
    await page.goto('/species');
    const firstCard = page.getByTestId('species-card').first();
    const cardCount = await page.getByTestId('species-card').count();
    if (cardCount === 0) {
      test.skip(true, 'no species seeded');
      return;
    }
    const href = await firstCard.getAttribute('href');
    expect(href).toMatch(/^\/species\/[a-z0-9-]+$/);
    await page.goto(href!);
    await assertHasTitle(page);
    await assertHasJsonLd(page, 'Article');
  });
});

test.describe('Public regulations', () => {
  test('/regulations is reachable + indexed', async ({ page }) => {
    const r = await page.goto('/regulations');
    expect(r?.status()).toBeLessThan(400);
    await assertHasTitle(page);
    await assertHasMetaDescription(page);
    await assertHasJsonLd(page, 'GovernmentService');
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
    expect(xml).toContain('/regulations');
    expect(xml).toContain('/species');
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
