import { test, expect } from '@playwright/test';

/**
 * The Winds control has to actually draw wind.
 *
 * For a long time it didn't. The spot map's Winds tab was an OpenWeatherMap
 * raster which, at the zoom a single spot is framed at, resolves to a nearly
 * uniform pale tint — the tab highlighted, nothing else changed, and it read as
 * a dead toggle. On Explore it was worse: the state, the prop and the map layer
 * all existed, but the chip that turned it on had been dropped from the rail,
 * so nothing could reach the layer at all.
 *
 * Both now run the same animated flow overlay as Currents, fed by
 * /api/bluecaster/wind/field. These tests assert what was missing rather than
 * how the animation looks: the control exists, turning it on asks for a wind
 * field, and scrubbing the hour asks for THAT hour — the last of which is its
 * own regression, since the endpoint originally answered for "now" only and
 * silently ignored the instant the rest of the page was showing.
 */

const SPOT = '/explore/spot/constance-bank-7615cc';

test('spot map Winds tab fetches a wind field', async ({ page }) => {
  const fields: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/wind/field')) fields.push(r.url());
  });

  await page.goto(SPOT);
  await page.getByRole('button', { name: 'Winds' }).click();
  await expect.poll(() => fields.length, { timeout: 15_000 }).toBeGreaterThan(0);

  // A bbox is required upstream; without it the endpoint 400s and the layer
  // silently stays empty, which is the failure this test exists to catch.
  expect(fields[0]).toContain('bbox=');
});

test('Explore rail has a Wind chip that fetches a wind field', async ({ page }) => {
  const fields: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/wind/field')) fields.push(r.url());
  });

  await page.goto('/explore');
  const chip = page.getByRole('button', { name: /^Wind$/ }).first();
  await expect(chip).toBeVisible({ timeout: 20_000 });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => fields.length, { timeout: 20_000 }).toBeGreaterThan(0);
});

test('scrubbing the hour moves the wind field with it', async ({ page }) => {
  const times: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/wind/field')) {
      times.push(decodeURIComponent(r.url().split('&time=')[1] ?? ''));
    }
  });

  await page.goto(SPOT);
  await page.getByRole('button', { name: 'Winds' }).click();
  await expect.poll(() => times.length, { timeout: 15_000 }).toBeGreaterThan(0);

  // The 24h terminal chart is the hour scrubber; arrow keys step it.
  const slider = page.locator('[role="slider"]').first();
  await slider.focus();
  for (let i = 0; i < 8; i += 1) {
    await slider.press('ArrowRight');
    await page.waitForTimeout(120);
  }

  // Fetches are debounced, so the count is not fixed — what matters is that a
  // later hour than the one we opened on was asked for.
  await expect
    .poll(() => new Set(times.filter(Boolean)).size, { timeout: 20_000 })
    .toBeGreaterThan(1);
});
