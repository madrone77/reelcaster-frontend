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
 * /api/bluecaster/wind/field. These tests assert the two things that were
 * missing rather than how the animation looks: the control exists, and turning
 * it on asks for a wind field.
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
