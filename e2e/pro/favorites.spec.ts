import { test, expect } from '@playwright/test';
import { proUser, setUserTier, resetUserState } from '../fixtures/users';
import { getAccessToken, authedFetch } from '../fixtures/auth-helpers';

/**
 * Phase 5 — Favorites Pro upgrade.
 *
 * Pro users can save more than 5 spots. (The /my-spots UI spec was removed
 * with the page; this is now an API-level contract.)
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await setUserTier(proUser.email, 'pro_annual');
  await resetUserState(proUser.email);
});

test('Pro user can save more than the free 5-spot cap', async ({ request }) => {
  const token = await getAccessToken(proUser);
  for (let i = 0; i < 7; i++) {
    const r = await authedFetch(request, token, '/api/favorite-spots', {
      method: 'POST',
      body: {
        name: `Pro spot ${i + 1}`,
        lat: 48.4 + i * 0.01,
        lon: -123.36,
        notes: '',
      },
    });
    expect.soft(r.status(), `add ${i} failed: ${await r.text().catch(() => '')}`).toBeLessThan(400);
  }
});

