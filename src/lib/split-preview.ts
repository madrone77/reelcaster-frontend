/**
 * Looking at an arm on purpose.
 *
 * The admin split-tests page links to an example of every test: the surface
 * drawn as arm a beside the same surface drawn as arm b, once at phone width
 * and once at desktop width. Those frames load the live site, and the live
 * site hands out arms by coin toss, so a frame needs a way to say which arm
 * it is showing. That is `?rc_arm=<test>:<variant>`, read here.
 *
 * A previewed arm is NEVER counted. The counters exist to compare what real
 * readers did, and an admin looking at both arms side by side is neither a
 * reader nor in one arm. Every reporter checks {@link previewActive} before
 * it posts.
 *
 * The choice is remembered for the tab (sessionStorage), because a surface
 * is often one tap past the URL that opened it: the phone sheet opens from
 * the trial button, the wall from a locked pin. Client-side navigation drops
 * the query string, and the arm must not change under the reader's finger.
 * Storage can be refused (a private window, a locked-down phone), and when it
 * is the arm holds for the page that carried the parameter and no further.
 *
 * Nothing here touches the cookie: a preview is a lens on this tab, not a
 * membership, and closing the tab ends it.
 */

import { type SplitArms, parseSplitCookie } from './split-tests';

export const PREVIEW_PARAM = 'rc_arm';
const STORE_KEY = 'rc_split_preview';

let memo: SplitArms | null = null;

/** The arms this tab was asked to draw, or `{}` outside a preview. */
export function previewArms(): SplitArms {
  if (memo) return memo;
  if (typeof window === 'undefined') return {};

  let raw: string | null = null;
  try {
    raw = new URLSearchParams(window.location.search).get(PREVIEW_PARAM);
  } catch {
    raw = null;
  }

  // The parameter carries the cookie's own grammar, "test:variant|test:variant",
  // and gets the cookie's own validation: a value we did not write is refused
  // rather than corrected.
  let arms = parseSplitCookie(raw);

  try {
    if (Object.keys(arms).length > 0) {
      window.sessionStorage.setItem(STORE_KEY, raw ?? '');
    } else {
      arms = parseSplitCookie(window.sessionStorage.getItem(STORE_KEY));
    }
  } catch {
    // Storage refused: the URL's arm, or nothing, and no memory of it.
  }

  memo = arms;
  return arms;
}

/** True when this tab is drawing an arm someone asked to see. */
export function previewActive(): boolean {
  return Object.keys(previewArms()).length > 0;
}

/** The visitor's arms with the previewed ones laid over the top. */
export function withPreview(arms: SplitArms): SplitArms {
  const preview = previewArms();
  if (Object.keys(preview).length === 0) return arms;
  return { ...arms, ...preview };
}
