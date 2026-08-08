import { test, expect } from '@playwright/test';
import { loginAs, freeUser, proUser, setUserTier } from '../fixtures/users';

/**
 * The standing upgrade path for an account that already exists.
 *
 * Signing in used to remove every way to buy: the top bar swapped its trial
 * CTA for the avatar, and /profile linked out to the sales page. A free
 * account's only route to checkout was tripping over a wall. These specs pin
 * the affordance in place, and pin it away from members who already pay.
 *
 * They stop at the modal — the Stripe handoff itself is covered by
 * checkout-flow.spec.ts and the Phase 7 canary.
 */

test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await setUserTier(freeUser.email, 'free');
  await setUserTier(proUser.email, 'pro_annual');
});

test.describe('Signed-in free account', () => {
  test('/explore top bar offers the upgrade, and it opens the modal', async ({
    page,
  }) => {
    await loginAs(page, freeUser);
    await page.goto('/explore');

    const upgrade = page.getByTestId('topbar-upgrade');
    await expect(upgrade).toBeVisible();

    await upgrade.click();
    await expect(page.getByTestId('pro-trial-modal')).toBeVisible();
  });

  test('/profile buys in place rather than linking to /plans', async ({
    page,
  }) => {
    await loginAs(page, freeUser);
    await page.goto('/profile');

    const upgrade = page.getByTestId('profile-upgrade');
    await expect(upgrade).toBeVisible();

    await upgrade.click();
    await expect(page.getByTestId('pro-trial-modal')).toBeVisible();
    // The decision was made on the card; we shouldn't have left the page.
    expect(new URL(page.url()).pathname).toBe('/profile');
  });

  test('the modal names one offer: the one the button gives', async ({
    page,
  }) => {
    await loginAs(page, freeUser);
    await page.goto('/explore');
    await page.getByTestId('topbar-upgrade').click();

    const modal = page.getByTestId('pro-trial-modal');
    await expect(modal).toBeVisible();

    // Eligibility is resolved server-side before either is drawn, so the
    // headline and the button can't disagree about whether this is a trial.
    const title = modal.locator('[data-trial]');
    await expect(title).not.toHaveAttribute('data-trial', 'resolving');
    const trialOn = (await title.getAttribute('data-trial')) === 'true';
    const cta = modal.getByTestId('trial-cta');

    if (trialOn) {
      await expect(title).toContainText(/free trial/i);
      await expect(cta).toContainText(/free trial/i);
    } else {
      await expect(title).toContainText(/with Pro/i);
      await expect(cta).toContainText(/Get Pro/i);
    }
  });
});

test.describe('Signed-in Pro member', () => {
  test('is never sold the subscription they already have', async ({ page }) => {
    await loginAs(page, proUser);
    await page.goto('/explore');

    // Give the tier lookup room to land: the button is held back until it
    // does, so an immediate assertion would pass for the wrong reason.
    await expect(page.getByTestId('topbar-upgrade')).toHaveCount(0);
    await page.waitForTimeout(3000);
    await expect(page.getByTestId('topbar-upgrade')).toHaveCount(0);
  });
});
