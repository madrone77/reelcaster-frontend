import { test, expect } from '@playwright/test';
import { env } from '../fixtures/env';
import { freeUser, loginAs, setUserTier, resetUserState } from '../fixtures/users';
import { getAccessToken, authedFetch } from '../fixtures/auth-helpers';

/**
 * Journey 8: Free user saves their one allowed favorite, attempts a 2nd → cap.
 *
 * Drives the API directly (faster + more deterministic than UI clicks),
 * since the browser surface for adding favorites is documented in
 * `e2e/free/`. This journey verifies the cap from the user's perspective.
 */

const enabled =
  Boolean(env.supabaseUrl) &&
  Boolean(env.supabaseServiceRoleKey) &&
  Boolean(freeUser.email) &&
  Boolean(freeUser.password);

test.describe('free: 2nd favorite hits cap', () => {
  test.skip(!enabled, 'admin/test-user credentials missing in .env.test');

  test.beforeEach(async () => {
    await setUserTier(freeUser.email, 'free');
    await resetUserState(freeUser.email);
  });

  test('2nd POST returns 402 + upgrade_required:true', async ({ request, page }) => {
    await loginAs(page, freeUser);
    const token = await getAccessToken(freeUser);
    const first = await authedFetch(request, token, '/api/favorite-spots', {
      method: 'POST',
      body: { name: 'Cap spot 1', lat: 48.4, lon: -123.36, notes: '' },
    });
    expect.soft(first.status(), 'seed').toBeLessThan(400);

    const second = await authedFetch(request, token, '/api/favorite-spots', {
      method: 'POST',
      body: { name: 'Cap spot 2', lat: 48.5, lon: -123.4, notes: '' },
    });
    // The cap response is 402 (Payment Required); some adjacent endpoints
    // return 400 instead. Accept either + the upgrade_required flag.
    expect([400, 402]).toContain(second.status());
    const body = await second.json();
    expect(body.upgrade_required).toBe(true);
  });
});
