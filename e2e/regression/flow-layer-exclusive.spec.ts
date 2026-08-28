import { test, expect, Page } from '@playwright/test';
import { installMapProbe } from '../helpers/map';

/**
 * Currents and Wind are one choice, not two switches, on every map that offers
 * both.
 *
 * On Explore and on a city page the two chips drove their own boolean, so
 * turning Wind on left Currents running underneath it: two white-streak fields
 * advecting at different speeds on the same water, belonging to neither
 * dataset. On the spot page they were tabs in the same radio group as
 * Bathymetry and Satellite, which could not overlap but could not be switched
 * OFF either, and picking one threw away the base map the reader had chosen.
 *
 * The rule all three now keep: at most ONE flow layer is on the map, and
 * clicking the control that is already lit stops it.
 *
 * The assertions read the map's own layers rather than the control's
 * highlight. `aria-pressed` was never the thing that was wrong, the layer
 * underneath it was.
 */

const FLOW_LAYERS = ['flow-currents', 'flow-wind'] as const;

/** Which flow layers the map is actually carrying right now. */
async function flowLayers(page: Page): Promise<string[] | null> {
  return page.evaluate((ids) => {
    const map = (window as unknown as { __rcFindMap: () => unknown }).__rcFindMap() as
      | { getLayer: (id: string) => unknown }
      | null;
    if (!map) return null;
    // getLayer, not getStyle: a custom (WebGL) layer is on the map but is not
    // part of the serialised style, so getStyle would report every flow layer
    // as absent and the test would pass on a map that draws both.
    return ids.filter((id) => !!map.getLayer(id));
  }, FLOW_LAYERS as unknown as string[]);
}

/** Whether the spot map's satellite raster is drawing right now. */
async function satelliteVisibility(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const map = (window as unknown as { __rcFindMap: () => unknown }).__rcFindMap() as
      | { getLayoutProperty: (id: string, prop: string) => unknown }
      | null;
    return map ? map.getLayoutProperty('spot-sat', 'visibility') : null;
  });
}

test('Currents and Wind never draw at the same time, and toggle off', async ({ page }) => {
  await installMapProbe(page);
  await page.goto('/explore');

  const currents = page.getByRole('button', { name: /^Currents$/ }).first();
  const wind = page.getByRole('button', { name: /^Wind$/ }).first();
  await expect(currents).toBeVisible({ timeout: 20_000 });
  await expect(wind).toBeVisible({ timeout: 20_000 });

  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-currents']);
  await expect(currents).toHaveAttribute('aria-pressed', 'true');

  // The swap: wind on, currents gone from the map — not merely un-highlighted.
  await wind.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-wind']);
  await expect(currents).toHaveAttribute('aria-pressed', 'false');
  await expect(wind).toHaveAttribute('aria-pressed', 'true');

  // Clicking the lit chip stops it, leaving a bare map.
  await wind.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual([]);
  await expect(wind).toHaveAttribute('aria-pressed', 'false');

  // And back the other way, so neither chip is a one-way switch.
  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-currents']);
  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual([]);
});

test('the spot map runs one flow at a time, and keeps its base map', async ({ page }) => {
  await installMapProbe(page);
  await page.goto('/explore/spot/constance-bank-7615cc');

  const currents = page.getByRole('button', { name: 'Currents' });
  const winds = page.getByRole('button', { name: 'Winds' });
  await expect(currents).toBeVisible({ timeout: 20_000 });

  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-currents']);

  await winds.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-wind']);

  await winds.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual([]);

  // Turning a flow off hands the map back to the base tab the reader chose,
  // rather than dumping them on bathymetry. In the old single radio group that
  // choice was thrown away the moment a flow tab was clicked.
  await page.getByRole('button', { name: 'Satellite' }).click();
  await expect.poll(() => satelliteVisibility(page), { timeout: 20_000 }).toBe('visible');

  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-currents']);
  // The imagery steps aside while the flow draws, and says so.
  await expect.poll(() => satelliteVisibility(page), { timeout: 20_000 }).toBe('none');
  await expect(page.getByRole('button', { name: 'Satellite' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual([]);
  await expect.poll(() => satelliteVisibility(page), { timeout: 20_000 }).toBe('visible');
});

test('a city map runs one flow at a time', async ({ page }) => {
  await installMapProbe(page);
  await page.goto('/fishing/bc/victoria-bc');

  const currents = page.getByRole('button', { name: /^Currents$/ }).first();
  const wind = page.getByRole('button', { name: /^Wind$/ }).first();
  await expect(currents).toBeVisible({ timeout: 20_000 });

  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-currents']);

  await wind.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-wind']);

  await wind.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual([]);
});

test('the phone filter sheet can reach both flow layers', async ({ page }) => {
  // The chips this sheet holds were the only way to a flow layer on a phone,
  // and it carried Currents alone: the wind field existed and nothing on a
  // small screen could ask for it.
  await page.setViewportSize({ width: 390, height: 844 });
  await installMapProbe(page);
  await page.goto('/explore');

  const openSheet = page.getByRole('button', { name: 'Filters' });
  await expect(openSheet).toBeVisible({ timeout: 20_000 });
  await openSheet.click();

  // One exclusive choice, so one radiogroup — two chips claimed the layers
  // were independent when useFlowLayer has always made them one.
  const sheet = page.getByRole('dialog', { name: 'Map filters' });
  const wind = sheet.getByRole('radio', { name: /^Wind$/ });
  const currents = sheet.getByRole('radio', { name: /^Currents$/ });
  const noFlow = sheet.getByRole('radio', { name: /^No flow$/ });
  await expect(wind).toBeVisible();
  // Labels are always on now, so the sheet no longer offers to turn them off.
  await expect(sheet.getByRole('button', { name: /^Labels$/ })).toHaveCount(0);
  // Near me moved to the location header; it moves the camera, it never filtered.
  await expect(sheet.getByRole('button', { name: /near me/i })).toHaveCount(0);

  await wind.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-wind']);

  await currents.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual(['flow-currents']);
  await expect(wind).toHaveAttribute('aria-checked', 'false');

  await noFlow.click();
  await expect.poll(() => flowLayers(page), { timeout: 20_000 }).toEqual([]);
});

test('the score floor narrows the map, and says so', async ({ page }) => {
  // The sheet was called Map filters while only species filtered anything.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/explore');

  const openSheet = page.getByRole('button', { name: 'Filters' });
  await expect(openSheet).toBeVisible({ timeout: 20_000 });
  await openSheet.click();

  const sheet = page.getByRole('dialog', { name: 'Map filters' });
  const cta = sheet.getByRole('button', { name: /^(Show \d+ spots?|No spots match)$/ });
  await expect(cta).toBeVisible();

  // Spots stream in with the viewport, so the count climbs for a few seconds
  // after the sheet opens. Read it only once it stops moving — comparing an
  // early number against a later one measures the loader, not the filter.
  const count = async () => Number((await cta.innerText()).match(/\d+/)?.[0] ?? '0');
  let settled = -1;
  for (let i = 0; i < 25; i++) {
    const now = await count();
    if (now > 0 && now === settled) break;
    settled = now;
    await page.waitForTimeout(1_000);
  }
  expect(settled).toBeGreaterThan(0);

  await sheet.getByRole('radio', { name: '75+' }).click();
  await expect.poll(count, { timeout: 10_000 }).toBeLessThanOrEqual(settled);

  // A narrowed map has to say so from the outside, or it reads as empty water.
  await expect(page.getByRole('button', { name: /^Filters \(1 on\)$/ })).toBeVisible();

  await sheet.getByRole('button', { name: 'Reset' }).click();
  await expect(sheet.getByRole('radio', { name: 'Any score' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
});
