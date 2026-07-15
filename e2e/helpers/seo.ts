import { Page, expect } from '@playwright/test';

/**
 * Assert the current page has a non-empty <meta name="description">.
 */
export async function assertHasMetaDescription(page: Page) {
  const content = await page
    .locator('meta[name="description"]')
    .first()
    .getAttribute('content');
  expect(content, 'meta[name="description"] missing or empty').toBeTruthy();
  expect((content ?? '').trim().length).toBeGreaterThan(0);
}

/**
 * Assert the current page has a <link rel="canonical"> matching the expected URL.
 * Pass `null` for `expected` to just assert presence.
 */
export async function assertCanonicalUrl(page: Page, expected: string | null = null) {
  const href = await page
    .locator('link[rel="canonical"]')
    .first()
    .getAttribute('href');
  expect(href, 'canonical link missing').toBeTruthy();
  if (expected) {
    expect(href).toBe(expected);
  }
}

/**
 * Assert the current page has at least one <script type="application/ld+json">,
 * optionally containing a JSON-LD object whose @type matches `type`.
 */
export async function assertHasJsonLd(page: Page, type?: string) {
  const locator = page.locator('script[type="application/ld+json"]');
  // Streaming SSR can attach the block after `load` fires — auto-wait for it.
  await expect(locator.first(), 'no JSON-LD blocks on page').toBeAttached();
  const blocks = await locator.allTextContents();
  expect(blocks.length, 'no JSON-LD blocks on page').toBeGreaterThan(0);
  if (type) {
    let found = false;
    for (const raw of blocks) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed['@type'] === type) {
          found = true;
          break;
        }
      } catch {
        // skip invalid block
      }
    }
    expect(found, `no JSON-LD block with @type="${type}"`).toBe(true);
  }
}

/**
 * Assert the current page has a non-empty <title>.
 */
export async function assertHasTitle(page: Page) {
  const title = await page.title();
  expect(title.trim().length).toBeGreaterThan(0);
}
