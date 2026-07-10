import { test, expect } from '@playwright/test';

/**
 * Phase 8 — confirm legacy / unknown routes are gone.
 *
 * Deleted route directories should return a hard HTTP 404.
 */

const HARD_404 = ['/v1', '/14-day-report', '/map-test', '/fishing', '/dashboard', '/my-spots', '/favorite-spots'];

for (const path of HARD_404) {
  test(`${path} returns hard 404`, async ({ page }) => {
    const r = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(r?.status(), `${path} should be 404`).toBe(404);
  });
}
