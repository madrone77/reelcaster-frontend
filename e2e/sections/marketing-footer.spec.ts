import { test, expect } from '@playwright/test';

/**
 * Marketing footer legal row — locks the six "always reachable" links
 * (Privacy · Terms · Contact · About · FAQ · Sign In) on every public page.
 * Pins their hrefs so a refactor can't quietly drop or rewire them.
 */

// `/species` is behind the coming-soon wall (not in middleware
// ALLOW_PREFIXES), so only the actually-public marketing pages are pinned.
const PAGES_WITH_FOOTER = ['/', '/plans'];

const LEGAL_LINKS: Array<{ label: string; href: string }> = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Contact', href: '/contact' },
  { label: 'About', href: '/about' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Sign In', href: '/login' },
];

test.describe('marketing footer legal row', () => {
  for (const path of PAGES_WITH_FOOTER) {
    test(`legal row renders on ${path} with all six links`, async ({ page }) => {
      const r = await page.goto(path);
      expect(r?.status()).toBeLessThan(400);

      const legal = page.getByTestId('marketing-footer-legal');
      await expect(legal).toBeVisible();

      for (const link of LEGAL_LINKS) {
        const a = legal.getByRole('link', { name: link.label, exact: true });
        await expect(a, `${link.label} link missing on ${path}`).toBeVisible();
        await expect(a).toHaveAttribute('href', link.href);
      }
    });
  }
});
