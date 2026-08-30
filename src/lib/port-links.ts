/**
 * Addresses into The Port (/support).
 *
 * The Port used to hold its open section in React state alone, which made it a
 * page you could only arrive at from its own front door: every guide and every
 * answer lived at the same URL. That was fine while the only way in was the
 * page's own search box, and stopped being fine the moment an email wanted to
 * say "here is how to set your home spot" and link to it.
 *
 * So section and focus are now in the query string, and this is the one place
 * that knows their names. Both ends import from here, which is the point: an
 * email holding a hand-written `?s=guides&id=save-spots` would keep pointing at
 * a guide id long after the guide was renamed, and nothing would fail loudly.
 *
 * The guide ids themselves are NOT here. They live beside the guides in
 * src/app/support/content.ts as WELCOME_GUIDE_IDS, where a `satisfies` clause
 * can check them against the real list; a second copy here would be one more
 * thing to keep in step.
 */

import { siteUrl } from '@/lib/site';

/** Query key for the open section. Short because it rides in email links. */
export const PORT_SECTION_PARAM = 's';
/** Query key for the guide or answer to open and scroll to. */
export const PORT_FOCUS_PARAM = 'id';

/**
 * The Port sections that are worth linking to from outside.
 *
 * Narrower than SectionId on purpose. 'billing' and 'tickets' render live
 * account state, so a link to them from an email is a link to a spinner
 * followed by something the reader did not ask about.
 */
export type PortLinkSection = 'start' | 'guides' | 'answers' | 'status';

/** Site-relative path into The Port, e.g. `/support?s=guides&id=save-spots`. */
export function portPath(section?: PortLinkSection, focusId?: string): string {
  if (!section) return '/support';
  const params = new URLSearchParams({ [PORT_SECTION_PARAM]: section });
  if (focusId) params.set(PORT_FOCUS_PARAM, focusId);
  return `/support?${params.toString()}`;
}

/** Absolute URL into The Port. Use this in email bodies. */
export function portUrl(section?: PortLinkSection, focusId?: string): string {
  return siteUrl(portPath(section, focusId));
}
