import { test, expect } from '@playwright/test';

/**
 * Regression baseline: every public route loads without server error.
 *
 * 2026-07-15: `/species` + `/regulations` pages were deleted (not in the five
 * core flows) and the static info/legal pages were unwalled with the light
 * landing redesign.
 */

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/plans',
  '/explore',
  '/privacy',
  '/terms',
  '/contact',
  '/about',
  '/faq',
];

const AUTH_GATED_ROUTES_REDIRECT_TO_LOGIN = [
  '/profile',
  '/alerts',
];

test.describe('Phase 0 smoke: public routes resolve', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`GET ${route} responds without server error`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response, `no response for ${route}`).not.toBeNull();
      // Anything in 2xx or 3xx is acceptable here. We only fail on 4xx/5xx.
      const status = response!.status();
      expect.soft(status, `${route} returned ${status}`).toBeLessThan(400);
    });
  }
});

test.describe('Phase 0 smoke: gated routes redirect signed-out to /login', () => {
  for (const route of AUTH_GATED_ROUTES_REDIRECT_TO_LOGIN) {
    test(`GET ${route} redirects signed-out users`, async ({ page }) => {
      await page.goto(route);
      // AuthGate's effect runs client-side; give it a beat to redirect.
      await page.waitForURL((url) => url.pathname.startsWith('/login'), { timeout: 10_000 });
      expect(new URL(page.url()).pathname).toMatch(/^\/login/);
    });
  }
});

test.describe('Phase 0 smoke: SEO basics on public surfaces', () => {
  test('/robots.txt is reachable', async ({ request }) => {
    const r = await request.get('/robots.txt');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body.toLowerCase()).toContain('user-agent');
  });

  test('/sitemap.xml is reachable', async ({ request }) => {
    const r = await request.get('/sitemap.xml');
    expect(r.status()).toBe(200);
    const body = await r.text();
    expect(body).toContain('<?xml');
  });
});
