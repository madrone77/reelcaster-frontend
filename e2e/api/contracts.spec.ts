import { test, expect } from '@playwright/test';
import { env } from '../fixtures/env';
import { freeUser, proUser, setUserTier, resetUserState } from '../fixtures/users';
import { getAccessToken, authedFetch } from '../fixtures/auth-helpers';

/**
 * Phase 0 contract baseline: documents the existing tier-gating behavior
 * (alerts: 1 free / 10 paid; favorites: 5 free / unlimited paid) so later
 * phases can refactor the API without silently breaking the contract.
 *
 * These specs require a populated .env.test. They skip themselves if the
 * supabase admin credentials aren't available, so the suite still runs in
 * environments where only smoke specs are relevant.
 */

const hasAdmin =
  Boolean(env.supabaseUrl) &&
  Boolean(env.supabaseServiceRoleKey) &&
  Boolean(freeUser.email) &&
  Boolean(freeUser.password);

test.describe('Phase 0 contract: alerts tier limits', () => {
  test.skip(!hasAdmin, 'admin credentials missing; skipping contract spec');

  test.beforeEach(async () => {
    if (!hasAdmin) return;
    await setUserTier(freeUser.email, 'free');
    await resetUserState(freeUser.email);
  });

  test('POST /api/alerts (1st alert) succeeds for free user', async ({ request }) => {
    const token = await getAccessToken(freeUser);
    const res = await authedFetch(request, token, '/api/alerts', {
      method: 'POST',
      body: minimalAlertBody('Smoke alert 1'),
    });
    expect.soft(res.status(), `body: ${await res.text()}`).toBeLessThan(400);
  });

  test('POST /api/alerts (2nd alert) returns upgrade_required for free user', async ({ request }) => {
    const token = await getAccessToken(freeUser);
    // Create the first alert
    const first = await authedFetch(request, token, '/api/alerts', {
      method: 'POST',
      body: minimalAlertBody('Smoke alert 1'),
    });
    expect(first.status()).toBeLessThan(400);
    // Second should fail
    const second = await authedFetch(request, token, '/api/alerts', {
      method: 'POST',
      body: minimalAlertBody('Smoke alert 2'),
    });
    expect(second.status()).toBe(400);
    const body = await second.json();
    expect(body.upgrade_required).toBe(true);
  });
});

test.describe('Phase 0 contract: favorites tier limits', () => {
  test.skip(!hasAdmin, 'admin credentials missing; skipping contract spec');

  test.beforeEach(async () => {
    if (!hasAdmin) return;
    await setUserTier(freeUser.email, 'free');
    await resetUserState(freeUser.email);
  });

  test('6th favorite returns upgrade_required for free user', async ({ request }) => {
    const token = await getAccessToken(freeUser);
    for (let i = 0; i < 5; i++) {
      const r = await authedFetch(request, token, '/api/favorite-spots', {
        method: 'POST',
        body: minimalFavoriteBody(`Smoke spot ${i + 1}`, 48.4 + i * 0.01, -123.36),
      });
      expect
        .soft(r.status(), `seeding failed at i=${i}: ${await r.text().catch(() => '')}`)
        .toBeLessThan(400);
    }
    const sixth = await authedFetch(request, token, '/api/favorite-spots', {
      method: 'POST',
      body: minimalFavoriteBody('Smoke spot 6', 48.5, -123.4),
    });
    // /api/favorite-spots returns 402 (Payment Required); /api/alerts returns 400.
    expect([400, 402]).toContain(sixth.status());
    const body = await sixth.json();
    expect(body.upgrade_required).toBe(true);
  });
});

test.describe('Phase 3 contract: forecast horizon by tier', () => {
  test.skip(!hasAdmin, 'admin credentials missing; skipping contract spec');

  test.beforeEach(async () => {
    if (!hasAdmin) return;
    await resetUserState(freeUser.email);
    await resetUserState(proUser.email);
  });

  test('free user → available_horizon_days=1, max=14', async ({ request }) => {
    await setUserTier(freeUser.email, 'free');
    const slug = await firstPublishedSpotSlug(request);
    if (!slug) {
      test.skip(true, 'no published spots in test instance');
      return;
    }
    const token = await getAccessToken(freeUser);
    const r = await authedFetch(request, token, `/api/spot-page/${slug}`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.tier_meta).toMatchObject({
      authed: true,
      is_paid: false,
      available_horizon_days: 1,
      max_horizon_days: 14,
    });
    // Forecast rows must fall within the next ~24h.
    if (body.forecast?.rows?.length > 0) {
      const cutoffMs = Date.now() + 24 * 60 * 60 * 1000;
      for (const row of body.forecast.rows) {
        expect(new Date(row.hour_utc).getTime()).toBeLessThanOrEqual(cutoffMs + 60_000);
      }
    }
  });

  test('pro user → available_horizon_days=14', async ({ request }) => {
    await setUserTier(proUser.email, 'pro_annual');
    const slug = await firstPublishedSpotSlug(request);
    if (!slug) {
      test.skip(true, 'no published spots in test instance');
      return;
    }
    const token = await getAccessToken(proUser);
    const r = await authedFetch(request, token, `/api/spot-page/${slug}`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.tier_meta).toMatchObject({
      authed: true,
      is_paid: true,
      available_horizon_days: 14,
      max_horizon_days: 14,
    });
  });

  test('unauthenticated → available_horizon_days=0', async ({ request }) => {
    const slug = await firstPublishedSpotSlug(request);
    if (!slug) {
      test.skip(true, 'no published spots in test instance');
      return;
    }
    const r = await request.get(`/api/spot-page/${slug}`);
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.tier_meta).toMatchObject({
      authed: false,
      is_paid: false,
      available_horizon_days: 0,
    });
    expect(body.forecast.rows.length).toBe(0);
  });
});

test.describe('Phase 0 contract: auth required on protected endpoints', () => {
  test('GET /api/alerts without auth → 401', async ({ request }) => {
    const r = await request.get('/api/alerts');
    expect([401, 403]).toContain(r.status());
  });

  // Checkout is deliberately NOT auth-gated any more: an anonymous visitor
  // pays first and the webhook creates their account. What it still refuses is
  // a session with no identity attached at all.
  test('POST /api/stripe/checkout with no auth and no email → 400', async ({ request }) => {
    const r = await request.post('/api/stripe/checkout', {
      data: { plan: 'annual', region: 'BC' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBe('email_required');
  });

  test('POST /api/stripe/checkout with no auth and a junk email → 400', async ({ request }) => {
    const r = await request.post('/api/stripe/checkout', {
      data: { plan: 'annual', region: 'BC', email: 'not-an-email' },
    });
    expect(r.status()).toBe(400);
    expect((await r.json()).error).toBe('invalid_email');
  });

  // An address that already has an account can't be bought for anonymously —
  // that would attach a subscription to an account the payer can't manage.
  test('POST /api/stripe/checkout with an existing account email → 409', async ({ request }) => {
    const r = await request.post('/api/stripe/checkout', {
      data: { plan: 'annual', region: 'BC', email: freeUser.email },
    });
    expect(r.status()).toBe(409);
    expect((await r.json()).error).toBe('account_exists');
  });

  test('POST /api/stripe/portal without auth → 401', async ({ request }) => {
    const r = await request.post('/api/stripe/portal');
    expect(r.status()).toBe(401);
  });
});

test.describe('Phase 4 contract: stripe status endpoint', () => {
  test.skip(!hasAdmin, 'admin credentials missing; skipping contract spec');

  // Public shape for anonymous callers — it must say whether the OFFER exists
  // without leaking anything about an account.
  test('GET /api/stripe/checkout without auth returns the public shape only', async ({ request }) => {
    const r = await request.get('/api/stripe/checkout?session_id=cs_test_dummy');
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.is_active).toBe(false);
    expect(body.tier).toBe('free');
    expect(body.period_end).toBeNull();
    expect(typeof body.annual_available).toBe('boolean');
  });

  test('GET /api/stripe/checkout returns tier metadata for free user', async ({ request }) => {
    await setUserTier(freeUser.email, 'free');
    const token = await getAccessToken(freeUser);
    const r = await authedFetch(
      request,
      token,
      '/api/stripe/checkout?session_id=cs_test_dummy',
    );
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body).toMatchObject({ tier: 'free', is_active: false });
  });

  test('GET /api/stripe/checkout returns active=true for pro user', async ({ request }) => {
    await setUserTier(proUser.email, 'pro_annual');
    const token = await getAccessToken(proUser);
    const r = await authedFetch(
      request,
      token,
      '/api/stripe/checkout?session_id=cs_test_dummy',
    );
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.is_active).toBe(true);
    expect(['pro_annual', 'pro_monthly']).toContain(body.tier);
  });
});

// ---------------- helpers ----------------

function minimalAlertBody(name: string) {
  return {
    name,
    location_lat: 48.4284,
    location_lng: -123.3656,
    location_name: 'Victoria Waterfront',
    triggers: {
      fishing_score: { enabled: true, min_score: 60 },
    },
    logic_mode: 'AND',
    cooldown_hours: 24,
    delivery_channels: ['email'],
    active: true,
  };
}

function minimalFavoriteBody(name: string, lat: number, lon: number) {
  return {
    name,
    lat,
    lon,
    notes: '',
  };
}

async function firstPublishedSpotSlug(
  request: import('@playwright/test').APIRequestContext,
): Promise<string | null> {
  const sitemap = await request.get('/sitemap.xml');
  if (!sitemap.ok()) return null;
  const xml = await sitemap.text();
  const match = xml.match(
    /<loc>https?:\/\/[^/]+\/fishing\/[a-z]{2}\/[a-z0-9-]+\/([a-z0-9-]+)<\/loc>/,
  );
  return match ? match[1] : null;
}
