import { test, expect, type Page } from '@playwright/test';

/**
 * The mobile Explore preview carousel: a map pin docks a spot card, and swiping
 * the dock walks the spots around it.
 *
 * Two faults this guards, both of which shipped and neither of which any
 * existing test could see:
 *
 *  - **The tap jumped the pin behind the card.** `focusSpotOnMap` centred the
 *    spot in the map PANE, and the bottom ~270px of that pane is the dock that
 *    is about to appear over it. Measured at 390x844, the tapped pin landed at
 *    y=454 with the card top at y=493 — 39px of clearance, so the pin you just
 *    tapped dropped to the edge of the card covering it. `sheetSafeCenter`
 *    existed for exactly this and was only wired into the remembered view.
 *
 *  - **Cards went blank under a fling.** The mount window was the card in hand
 *    ±1, keyed to the map's selection, which only advances 90ms after scrolling
 *    STOPS. A flick across three cards therefore landed on a width-holding
 *    spacer with nothing in it: 358ms of empty deck, with the counter still
 *    naming the card you had left.
 *
 * Both are phone-only, so this runs at an explicit phone viewport rather than
 * the suite's desktop default.
 */

const PHONE = { width: 390, height: 844 };

/** Hand the map instance out of the React tree — there is no global handle. */
async function grabMap(page: Page) {
  await page.waitForSelector('.maplibregl-canvas', { timeout: 60_000 });
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.querySelector('.maplibregl-map') as
            | (Element & Record<string, unknown>)
            | null;
          if (!el) return false;
          for (const k of Object.keys(el)) {
            if (!k.startsWith('__reactFiber')) continue;
            let f = el[k] as any;
            for (let i = 0; i < 40 && f; i++, f = f.return) {
              let ms = f.memoizedState;
              for (let j = 0; j < 30 && ms; j++, ms = ms.next) {
                const v = ms.memoizedState;
                if (v?.current && typeof v.current.flyTo === 'function') {
                  (window as any).__M = v.current;
                  return true;
                }
              }
            }
          }
          return false;
        }),
      { timeout: 60_000, message: 'never found the MapLibre instance' },
    )
    .toBe(true);
}

/**
 * A puck the mouse can actually reach. The pucks are pills with tails, so a
 * neighbour's pill routinely covers the anchor beneath it — hit-test and check
 * the canvas is what's under the point, rather than trusting a projection.
 */
async function findPuck(page: Page, y0: number, y1: number) {
  return page.evaluate(
    ({ y0, y1 }) => {
      const M = (window as any).__M;
      const c = M.getCanvas();
      const r = c.getBoundingClientRect();
      for (let y = y0; y < y1; y += 6) {
        for (let x = 40; x < 350; x += 6) {
          const f = M.queryRenderedFeatures([x, y], { layers: ['bc-spot-puck'] });
          if (!f?.length || !f[0].properties?.slug) continue;
          if (document.elementFromPoint(x + r.left, y + r.top) !== c) continue;
          (window as any).__coord = f[0].geometry.coordinates;
          return {
            slug: f[0].properties.slug as string,
            x: Math.round(x + r.left),
            y: Math.round(y + r.top),
          };
        }
      }
      return null;
    },
    { y0, y1 },
  );
}

async function openPreview(page: Page) {
  await page.setViewportSize(PHONE);
  await page.goto('/explore');
  await grabMap(page);
  // The pucks arrive with the viewport payload, not with the style.
  await expect
    .poll(async () => findPuck(page, 300, 560), { timeout: 45_000 })
    .not.toBeNull();
  const pin = (await findPuck(page, 300, 560))!;
  await page.mouse.click(pin.x, pin.y);
  await expect(page.locator('[role="dialog"][aria-label$="preview"]')).toBeVisible();
  return pin;
}

test('a tapped pin lands in the water above the card, not behind it', async ({ page }) => {
  await openPreview(page);
  // Let the flight finish. It is 450ms, deferred two frames behind the dock.
  await page.waitForTimeout(1500);

  const geom = await page.evaluate(() => {
    const M = (window as any).__M;
    const r = M.getCanvas().getBoundingClientRect();
    const p = M.project((window as any).__coord);
    const dock = document
      .querySelector('[role="dialog"][aria-label$="preview"]')!
      .getBoundingClientRect();
    return {
      pinY: p.y + r.top,
      paneTop: r.top,
      dockTop: dock.top,
    };
  });

  // Comfortably clear of the card — the old behaviour left 39px.
  expect(geom.pinY).toBeLessThan(geom.dockTop - 120);
  // And still on screen, not shoved off the top by an over-correction.
  expect(geom.pinY).toBeGreaterThan(geom.paneTop + 40);
});

test('flinging the carousel never lands on an empty card', async ({ page }) => {
  await openPreview(page);
  await page.waitForTimeout(1200);

  // Sample the card in hand every frame for the whole gesture. A settle-keyed
  // mount window goes blank mid-fling and is painted again before anything a
  // test polls for would notice, so this has to watch rather than check after.
  await page.evaluate(() => {
    (window as any).__blank = 0;
    (window as any).__seen = 0;
    const tick = () => {
      const rail = document.querySelector('[data-rc-preview-rail]');
      if (rail) {
        const centre = rail.scrollLeft + rail.clientWidth / 2;
        let idx = -1;
        let best = Infinity;
        Array.from(rail.children).forEach((ch, i) => {
          const el = ch as HTMLElement;
          const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - centre);
          if (d < best) {
            best = d;
            idx = i;
          }
        });
        (window as any).__seen++;
        if (rail.children[idx] && rail.children[idx].children.length === 0) {
          (window as any).__blank++;
        }
      }
      requestAnimationFrame(tick);
    };
    tick();
  });

  const rail = page.locator('[data-rc-preview-rail]');
  const box = (await rail.boundingBox())!;
  const cy = box.y + box.height / 2;

  // A few deliberate swipes, then a fast fling across several cards — the fling
  // is the case that broke, one-at-a-time swiping always had its neighbour.
  for (let n = 0; n < 3; n++) {
    await page.mouse.move(box.x + box.width * 0.8, cy);
    await page.mouse.wheel(340, 0);
    await page.waitForTimeout(650);
  }
  await page.mouse.move(box.x + box.width * 0.5, cy);
  for (let i = 0; i < 10; i++) await page.mouse.wheel(120, 0);
  await page.waitForTimeout(1500);

  const { blank, seen } = await page.evaluate(() => ({
    blank: (window as any).__blank as number,
    seen: (window as any).__seen as number,
  }));
  expect(seen).toBeGreaterThan(60);
  expect(blank, 'the card in hand was an empty spacer for some frames').toBe(0);

  // The counter names the card in hand, not the one the map has settled on.
  await expect(page.locator('[data-rc-preview-count]')).not.toHaveText(/^1 of /);
});

test('tapping a second pin rebuilds the deck without whooshing back through it', async ({
  page,
}) => {
  await openPreview(page);
  await page.waitForTimeout(1200);

  const rail = page.locator('[data-rc-preview-rail]');
  const box = (await rail.boundingBox())!;
  for (let n = 0; n < 6; n++) {
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
    await page.mouse.wheel(340, 0);
    await page.waitForTimeout(420);
  }
  expect(await rail.evaluate((el) => el.scrollLeft)).toBeGreaterThan(1000);

  await page.evaluate(() => {
    (window as any).__scrolls = [];
    const r = document.querySelector('[data-rc-preview-rail]')!;
    r.addEventListener('scroll', () =>
      (window as any).__scrolls.push(Math.round(r.scrollLeft)),
    );
  });

  const second = await findPuck(page, 120, 420);
  test.skip(!second, 'no reachable second puck in the upper band');
  await page.mouse.click(second!.x, second!.y);
  await page.waitForTimeout(1200);

  // The dock survives the deck swap — a selection the frozen deck has not heard
  // of used to tear it down and flash the browse list up in its place.
  await expect(page.locator('[role="dialog"][aria-label$="preview"]')).toBeVisible();
  await expect(page.locator('[data-rc-preview-count]')).toHaveText(/^1 of /);

  // A new deck is not a move within the old one: it snaps, it does not animate
  // backwards through six unrelated cards.
  const scrolls = await page.evaluate(() => (window as any).__scrolls as number[]);
  // A smooth scroll back across six cards is dozens of events; a jump is one.
  expect(
    scrolls.length,
    `the rail animated back through the old deck (${scrolls.length} scroll events)`,
  ).toBeLessThanOrEqual(3);
  // Landed on the new anchor. Asserted as an index, not a pixel: the rail's
  // resting offset for card 0 is a few px off zero, because the card width and
  // the side padding are both vw-derived and round independently.
  const settledIndex = await rail.evaluate((el) => {
    const centre = el.scrollLeft + el.clientWidth / 2;
    let idx = -1;
    let best = Infinity;
    Array.from(el.children).forEach((ch, i) => {
      const c = ch as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    return idx;
  });
  expect(settledIndex).toBe(0);
});
