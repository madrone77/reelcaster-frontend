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

  // The whole panel is in the band the reader can see. Before this fix it ran
  // ~265px past the top of the keyboard. Polled because the modal's own
  // content settles over a couple of frames as the wallet buttons resolve.
  await expect
    .poll(async () => {
      const box = await panel.boundingBox();
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
