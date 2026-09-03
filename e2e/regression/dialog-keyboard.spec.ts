import { test, expect, type Page } from '@playwright/test';

/**
 * Dialogs stay above the software keyboard.
 *
 * A `position: fixed` dialog is centred against the LAYOUT viewport, and the
 * keyboard only shrinks the VISUAL one, so a centred dialog used to keep its
 * bottom half under the keys — on the create-custom-spot dialog that was the
 * visibility toggle, the species picker and the Create button, all unreachable
 * from the moment the angler tapped the name field. `src/components/ui/dialog`
 * measures the visible band instead and lives inside it.
 *
 * This drives the trial modal, because it is the one dialog with a text field
 * an anonymous visitor can open with a single click and no fixtures. The
 * geometry it checks belongs to the shared `DialogContent`, so every other
 * dialog inherits the same answer.
 *
 * At this viewport the trial modal is the SHEET variant, which pins to the
 * bottom edge rather than centring. That is deliberate coverage rather than an
 * accident of which dialog was handy: the two variants sit above the keyboard
 * by different arithmetic (one sets `top`, the other `bottom`), and both have
 * to satisfy every assertion below. The centred branch is exercised by the
 * same file at any width above `sm`, and by every other dialog in the app.
 */

const KEYBOARD = 320;
const PHONE = { width: 412, height: 915 };
/** Where the top of the keyboard lands on a phone this tall. */
const KEYBOARD_TOP = PHONE.height - KEYBOARD;

test.use({ viewport: PHONE, hasTouch: true, isMobile: true });

/** Open the trial modal and wait for the lazily-imported panel. */
async function openDialog(page: Page) {
  await page.goto('/fishing-licence/bc');
  // The CTA is a client component on a server-rendered page: clicking before
  // hydration does nothing at all.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.getByRole('button', { name: 'Start free' }).last().click();
  const panel = page.locator('[data-slot="dialog-content"]');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  return panel;
}

/**
 * Raise the keyboard the way a phone does: shrink the visual viewport only,
 * leave `innerHeight` alone, and fire the resize the app listens for. Chromium
 * has no real software keyboard, and this is the part of one that matters.
 */
async function raiseKeyboard(page: Page) {
  await page.evaluate((kb) => {
    const vv = window.visualViewport!;
    Object.defineProperty(vv, 'height', {
      configurable: true,
      get: () => window.innerHeight - kb,
    });
    vv.dispatchEvent(new Event('resize'));
  }, KEYBOARD);
  await expect(page.locator('[data-slot="dialog-content"]')).toHaveAttribute(
    'data-keyboard',
    'up',
  );
}

test('the trial modal mounts in its final shape on the opening tap', async ({
  page,
}) => {
  await page.goto('/fishing-licence/bc');
  await page.waitForLoadState('networkidle').catch(() => {});

  // Record the shape of every dialog panel that enters the DOM from the tap
  // onward. The phone check used to answer in an effect, so the first panel
  // to mount was the centred dialog and the sheet replaced it a frame later.
  // On WebKit that swap let the sheet's outside-tap listener catch the tail
  // of the opening tap and close it. One shape, first time, is the fix.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __shapes: string[] }).__shapes = seen;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const panel = node.matches('[data-slot="dialog-content"]')
            ? node
            : node.querySelector('[data-slot="dialog-content"]');
          if (panel) seen.push(panel.getAttribute('data-shape') ?? '');
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  });

  await page.getByRole('button', { name: 'Start free' }).last().click();
  const panel = page.locator('[data-slot="dialog-content"]');
  await expect(panel).toBeVisible({ timeout: 15_000 });
  await expect(panel).toHaveAttribute('data-shape', 'sheet');

  const shapes = await page.evaluate(
    () => (window as unknown as { __shapes: string[] }).__shapes,
  );
  expect(shapes).toEqual(['sheet']);
});

test('a tap in the band the keyboard covers does not close the sheet', async ({
  page,
}) => {
  const panel = await openDialog(page);
  await expect(panel).toHaveAttribute('data-shape', 'sheet');
  await raiseKeyboard(page);

  // The sheet still reaches the bottom edge: the keys cover its padding, not
  // scrim. Lifting the whole panel by the keyboard's height left that band as
  // overlay, and a thumb landing there closed the sheet and threw away the
  // email being typed into it.
  const box = await panel.boundingBox();
  expect(Math.round(box!.y + box!.height)).toBeGreaterThanOrEqual(PHONE.height);

  const inBand = await page.evaluate(
    ({ x, y }) => {
      const hit = document.elementFromPoint(x, y);
      const panel = document.querySelector('[data-slot="dialog-content"]');
      return Boolean(hit && panel && panel.contains(hit));
    },
    { x: PHONE.width / 2, y: PHONE.height - KEYBOARD / 2 },
  );
  expect(inBand).toBe(true);

  await page.mouse.click(PHONE.width / 2, PHONE.height - KEYBOARD / 2);
  await expect(panel).toBeVisible();
});

test('opening a dialog on a touch device does not raise the keyboard', async ({
  page,
}) => {
  await openDialog(page);
  // Focus on the panel, not in a field: the reader sees what they opened
  // before anything asks them to type.
  const focused = await page.evaluate(() => document.activeElement?.tagName);
  expect(focused).not.toBe('INPUT');
  expect(focused).not.toBe('TEXTAREA');
});

test('a dialog fits above the keyboard, and scrolls if it cannot', async ({
  page,
}) => {
  const panel = await openDialog(page);
  // Sanity: this width really is the sheet, so a future change that flips the
  // breakpoint does not quietly leave this file testing the other variant.
  await expect(panel).toHaveAttribute('data-shape', 'sheet');
  await raiseKeyboard(page);

  // Everything the reader has to reach is in the band they can see. Before
  // this fix the panel ran ~265px past the top of the keyboard. The sheet
  // itself still touches the bottom edge (the keys cover its padding, so a
  // tap in that band lands on the sheet rather than on the scrim that closes
  // it), which is why this measures the buy button, the last thing in the
  // sheet, and not the panel's box. Polled because the modal's own content
  // settles over a couple of frames as the wallet buttons resolve.
  const cta = panel.getByTestId('trial-cta');
  await expect
    .poll(async () => {
      const box = await cta.boundingBox();
      return box ? Math.round(box.y + box.height) : null;
    })
    .toBeLessThanOrEqual(KEYBOARD_TOP);

  const box = await panel.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);

  // Anything that no longer fits is reachable by scrolling rather than gone.
  const reachable = await panel.evaluate(
    (el) => el.scrollHeight <= el.clientHeight + 1 || getComputedStyle(el).overflowY === 'auto',
  );
  expect(reachable).toBe(true);
});
