/**
 * Single source of truth for the contact details that appear in the legal
 * documents under `src/content/legal/`.
 *
 * The markdown files are the canonical, reviewable text and carry `{{TOKEN}}`
 * placeholders. `fillLegalPlaceholders` substitutes them at render time, so
 * changing an address means editing this file and nothing else.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DO NOT PUBLISH while `LEGAL_DETAILS_COMPLETE` is false.
 *
 * A mailing address and telephone number are required disclosures for a
 * distance sales contract under the BC Business Practices and Consumer
 * Protection Act, and the copyright-agent address only earns the DMCA safe
 * harbour once that agent is registered with the US Copyright Office.
 * The pages render an unmissable banner until the flag below is flipped.
 * ─────────────────────────────────────────────────────────────────────────
 */

/** Flip to `true` once every value below is real. Gates the warning banner. */
export const LEGAL_DETAILS_COMPLETE = true;

export const LEGAL_CONTACT = {
  /** Confirmed: already published on the live site. */
  CONTACT_EMAIL: 'support@reelcaster.com',

  /**
   * Deliberately the same inbox as CONTACT_EMAIL. Privacy requests (30 days
   * under PIPEDA, 45 under the CCPA) and copyright notices both carry legal
   * response clocks, so if support volume ever grows enough to bury them,
   * split these back out into their own addresses.
   */
  PRIVACY_EMAIL: 'support@reelcaster.com',

  /** Must match the agent registered with the US Copyright Office. */
  DMCA_AGENT_EMAIL: 'support@reelcaster.com',

  /**
   * Street line only. The contact blocks in both documents print
   * "Victoria, British Columbia, Canada" on the following line, and the
   * inline supplier disclosure in Terms section 6 spells the city out.
   */
  MAILING_ADDRESS: '612 View Street, Suite 302',

  PHONE: '+1 236 857 7771',

  EFFECTIVE_DATE: 'August 18, 2026',
} as const;

type LegalToken = keyof typeof LEGAL_CONTACT;

/** Replaces every `{{TOKEN}}` in `markdown` with its value from LEGAL_CONTACT. */
export function fillLegalPlaceholders(markdown: string): string {
  return markdown.replace(/\{\{([A-Z_]+)\}\}/g, (whole, token: string) => {
    const value = LEGAL_CONTACT[token as LegalToken];
    // An unknown token is a typo in the markdown. Leave it visible rather than
    // silently emitting an empty string into a legal document.
    return value ?? whole;
  });
}

/**
 * Drops the leading `# Title` line. The page renders its own styled <h1>, and
 * two of them would be both ugly and bad for SEO.
 */
export function stripLeadingTitle(markdown: string): string {
  return markdown.replace(/^#\s+.*\r?\n/, '').trimStart();
}
