import { test, expect } from '@playwright/test';

/**
 * Regression baseline: every public route loads without server error.
 *
 * Phase 0 established the route-group skeleton; Phase 2 made `/` public
 * (marketing homepage) and added `/species`, `/species/[slug]`, and
 * `/regulations` to the public surface.
 */

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/pricing',
  '/explore',
  '/species',
  '/regulations',
];

const AUTH_GATED_ROUTES_REDIRECT_TO_LOGIN = [
  '/profile',
  '/alerts',
];

const LEGACY_REDIRECTS: Array<{ from: string; to: string }> = [
  { from: '/dfo-notices', to: '/regulations' },
  { from: '/species-calendar', to: '/species' },
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

test.describe('Phase 5 smoke: legacy paths redirect to their public counterparts', () => {
  for (const { from, to } of LEGACY_REDIRECTS) {
    test(`GET ${from} lands on ${to}`, async ({ page }) => {
      await page.goto(from, { waitUntil: 'domcontentloaded' });
      expect(new URL(page.url()).pathname).toBe(to);
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
