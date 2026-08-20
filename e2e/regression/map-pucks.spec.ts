import { test, expect } from '@playwright/test';
import {
  collectMissingImages,
  expectPinsWithoutInteraction,
  installMapProbe,
  readMapPins,
} from '../helpers/map';

/**
 * Every map has to draw its pins on arrival, with nobody touching it.
 *
 * The score pucks are canvas sprites registered at runtime. They used to be
 * registered from the map's `onLoad`, which is too late: a symbol tile is laid
 * out as soon as its source has data, and an icon missing at that instant is
 * simply left off the tile. On a cold /explore the spots reached the source
 * about a second in while `load` was still waiting on every source in the
 * relief style, so MapLibre asked for `rcp:88:base:0:rd` and its siblings, got
 * nothing, and the map opened bare. The pins came back only when something
 * reloaded those tiles: a zoom, or a later payload whose new scores happened to
 * register an image. When neither happened the map stayed empty for the whole
 * visit.
 *
 * Two things are asserted, and both matter:
 *
 *  - **No missing-image warning.** MapLibre logs one at the exact moment a tile
 *    goes out without its icon, so it fires long before anything is visible and
 *    it fires even on the loads that later self-heal. It is the only signal
 *    that catches "the pins arrived, but three seconds late".
 *  - **Pins on screen without interaction.** Nothing here pans, zooms or
 *    clicks, because retiling the source is what used to paper the bug over.
 *
 * Fixed in FE #361 (Explore, the city pages and the homepage), #363 (the
 * homepage's hidden regulatory layers, which asked for a hatch pattern that map
 * never registered) and #365 (the spot page).
 */

/** Slugs carry a hash suffix; a bare name 404s into a page with no map at all. */
const SPOT = '/explore/spot/constance-bank-7615cc';

const SURFACES: Array<{ name: string; path: string }> = [
  { name: 'Explore', path: '/explore' },
  { name: 'the spot page', path: SPOT },
  { name: 'a city page', path: '/fishing/bc/victoria-bc' },
  { name: 'the homepage', path: '/' },
];

for (const { name, path } of SURFACES) {
  test(`${name} draws its pins with no missing images`, async ({ page }) => {
    const missing = collectMissingImages(page);
    await installMapProbe(page);

    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);

    await expectPinsWithoutInteraction(page);

    expect(
      missing,
      `${name} asked for images nothing had drawn yet: ${missing.join(', ')}`,
    ).toEqual([]);
  });
}

/**
 * Explore loads more spots as the viewport settles, and every new score is an
 * icon id that has never been drawn. The second wave has to arrive already
 * drawn too, not merely eventually.
 */
test('Explore keeps drawing pins as the viewport payload lands', async ({ page }) => {
  const missing = collectMissingImages(page);
  await installMapProbe(page);

  await page.goto('/explore');
  await expectPinsWithoutInteraction(page);

  const first = (await readMapPins(page))?.pucks ?? 0;

  // The viewport fetch covers far more water than the server-rendered opening
  // city, so the count climbs once it lands.
  await expect
    .poll(async () => (await readMapPins(page))?.pucks ?? 0, { timeout: 25_000 })
    .toBeGreaterThan(first);

  expect(
    missing,
    `the viewport payload brought scores nothing had drawn: ${missing.join(', ')}`,
  ).toEqual([]);
});
