/**
 * The city-page-versus-quiz split: half of every bought click on a city
 * landing page is sent on to the quiz for that city instead.
 *
 * Every paid landing since 2026-09-25 is THE landing page, the framed city
 * page with the trial sheet, answering at /fishing/<country>/<state>/<city>?ad=
 * and at every /lp address an ad was ever bought against. The quiz at
 * /lp/q/<city> is the one other page that sells the same trial, and this
 * split asks which of the two turns a bought click into a trial more often.
 * One rule for every city that has paid traffic, so a new city's ads are in
 * the test the day they start, with no row to add.
 *
 * WHY THIS IS NOT src/lib/split-tests.ts. That system swaps a price or a
 * component INSIDE a page, so it can assign arms from a route the page calls
 * after it has loaded, and every page stays cached. Here the two arms are two
 * different pages. The only place that can send a visitor to one URL or the
 * other before they have seen either is middleware, and middleware cannot
 * read the registry without a database round trip on every request. So the
 * rule is code, the flip is a redirect, and starting or stopping the split is
 * a merge, which deploys on its own.
 *
 * WHY A REDIRECT AND NOT A REWRITE. A rewrite would serve the quiz under the
 * city page's URL, so the address bar, the Meta pixel's page view, the quiz's
 * own client-side hop for a bare city and our first-touch cookie would all
 * name the wrong page for half the visitors. A redirect costs one hop and
 * leaves every record naming the page the person actually saw. The one-page
 * paid flow (FE #830) took every OTHER hop out of the paid path; this is the
 * one that is the test itself, and it fires for half of the clicks only.
 *
 * COUNTING NEEDS NOTHING NEW. The city page counts under its landing key
 * (`city`, or the /lp key the ad was bought as) and the quiz under `lpq`,
 * each with the city as a column, and bluecaster's Campaign results shows the
 * pair as one split row (lib/lp-split-tests.ts there). The split only decides
 * which of two existing rows a bought click lands on.
 *
 * The cookie holds arm names and no identifier, for the same reason rc_split
 * does: "city_quiz:b" says which side of a coin toss someone landed on and
 * identifies nobody. Same grammar, separate cookie, because /api/split-tests
 * rewrites rc_split against the registry and would drop a key it has never
 * heard of.
 *
 * Pure and edge-safe: no imports, no environment, no Math.random of its own.
 * The caller passes the roll, which is what makes this testable.
 */

export const LP_SPLIT_COOKIE = 'rc_lp';

/** Thirty days. Sticky for as long as a bought click plausibly comes back. */
export const LP_SPLIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface LpSplit {
  /** Cookie key. Lowercase letters, digits and underscores. */
  key: string;
  /** Fraction of NEW visitors sent to the treatment, 0 to 1. */
  share: number;
}

/**
 * Every running split.
 *
 * Remove the row to stop the test: visitors already in the treatment arm are
 * served the city page from then on, and their stale cookie entry is dropped
 * on the next visit. Set share to 1 to send every paid click to the quiz.
 */
export const CITY_QUIZ_SPLIT: LpSplit = { key: 'city_quiz', share: 0.5 };

export const LP_SPLITS: readonly LpSplit[] = [CITY_QUIZ_SPLIT];

export const CONTROL_ARM = 'a';
export const TREATMENT_ARM = 'b';
export type LpArm = typeof CONTROL_ARM | typeof TREATMENT_ARM;

/** split key → arm. `{ city_quiz: 'b' }`. */
export type LpArms = Record<string, LpArm>;

const KEY_RE = /^[a-z0-9_]{1,64}$/;

function isArm(value: string): value is LpArm {
  return value === CONTROL_ARM || value === TREATMENT_ARM;
}

/** Click ids the ad networks append. Any one of them marks a bought click. */
const CLICK_IDS = ['fbclid', 'gclid', 'gbraid', 'wbraid', 'msclkid'];

/** utm_source values the link builder and hand-typed ad links use. */
const PAID_SOURCES = new Set(['meta', 'facebook', 'instagram', 'fb', 'ig', 'google', 'bing']);

/**
 * Is this query string a bought click: a click id, or a paid utm_source?
 *
 * Organic readers, shared links and the paid-flow Sentinel's city checks
 * (`?ad=today` with no click id) are never dealt an arm and always read the
 * city page.
 */
export function isPaidClick(search: string): boolean {
  const params = new URLSearchParams(search);
  if (CLICK_IDS.some((id) => params.get(id))) return true;
  return PAID_SOURCES.has((params.get('utm_source') ?? '').trim().toLowerCase());
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const VARIANT_RE = /^[0-9]{1,2}$/;

function segments(pathname: string): string[] {
  return pathname.toLowerCase().split('/').filter(Boolean);
}

/**
 * The quiz address for a city landing page, or null when the path is not one.
 *
 * Mirrors what answers each address (src/app/lp/[...path]/page.tsx and the
 * city ad rewrite in middleware), so the quiz a visitor is sent to is the
 * quiz for the city they would have read about:
 *
 *   /fishing/us/wa/seattle?ad=   → /lp/q/seattle       the framed city page
 *   /lp/seattle/5                → /lp/q/seattle       city-first
 *   /lp/5/seattle-wa             → /lp/q/seattle-wa    variant-first
 *   /lp/5?city=seattle-wa        → /lp/q/seattle-wa    the doorway shape
 *   /lp/seattle-wa               → /lp/q/seattle-wa    the link builder's shape
 *   /lp/6                        → /lp/q               nothing named: the quiz's
 *                                                       own country default
 *
 * The quiz route takes a bare city or a full slug, and hands anything it
 * cannot place to the visitor's nearest city, so a name the city page would
 * have defaulted never 404s here either. /lp/q itself is never a control:
 * the quiz's own ads are not in this test.
 */
export function quizPathFor(pathname: string, search = ''): string | null {
  const parts = segments(pathname);
  const params = new URLSearchParams(search);

  if (parts[0] === 'fishing') {
    // A city page carries the frame only with ?ad=; without it the public
    // page renders and nothing about the visit is a paid landing.
    if (parts.length !== 4 || !params.has('ad')) return null;
    return SLUG_RE.test(parts[3]) ? `/lp/q/${parts[3]}` : null;
  }

  if (parts[0] !== 'lp' || parts.length > 3) return null;
  if (parts[1] === 'q') return null;

  const [, head = '', second = ''] = parts;
  const named = VARIANT_RE.test(head) ? second : head;
  const candidates = [named, (params.get('city') ?? '').trim().toLowerCase()];
  const city = candidates.find((c) => c && SLUG_RE.test(c) && !VARIANT_RE.test(c));
  return city ? `/lp/q/${city}` : '/lp/q';
}

export interface LpSplitMatch {
  split: LpSplit;
  /** Where the treatment arm is sent. The query string rides along intact. */
  treatment: string;
}

/** The split this request is in, if it is a bought click on a city landing. */
export function splitForRequest(
  pathname: string,
  search = '',
  split: LpSplit | null = CITY_QUIZ_SPLIT,
): LpSplitMatch | null {
  if (!split) return null;
  if (!isPaidClick(search)) return null;
  const treatment = quizPathFor(pathname, search);
  return treatment ? { split, treatment } : null;
}

/**
 * `"city_quiz:b|other:a"` → `{ city_quiz: 'b', other: 'a' }`.
 *
 * Anything malformed is refused rather than corrected. The cookie is
 * client-writable, and the worst a hand-edited one achieves is putting its
 * owner in the arm of their choosing.
 */
export function parseLpSplitCookie(raw: string | null | undefined): LpArms {
  const arms: LpArms = {};
  if (!raw) return arms;
  // The value is written URL-encoded (NextResponse.cookies.set encodes the
  // colon), and whether it comes back decoded depends on who parsed the
  // Cookie header. Decoding a value that was never encoded is a no-op, so
  // always decode; a value that will not decode is one we did not write.
  let text = raw;
  try {
    text = decodeURIComponent(raw);
  } catch {
    // Read it as-is and let the shape tests below refuse it.
  }
  for (const pair of text.split('|')) {
    const idx = pair.indexOf(':');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx);
    const arm = pair.slice(idx + 1);
    if (!KEY_RE.test(key) || !isArm(arm)) continue;
    arms[key] = arm;
  }
  return arms;
}

export function serializeLpSplitArms(arms: LpArms): string {
  return Object.entries(arms)
    .map(([key, arm]) => `${key}:${arm}`)
    .join('|');
}

export interface LpResolution {
  /** The arm this visit is in for the split asked about. */
  arm: LpArm;
  /** The whole membership, ready to serialize. */
  arms: LpArms;
  /** True when the cookie needs writing. Nothing sets a cookie needlessly. */
  changed: boolean;
}

/**
 * Which arm this visitor is in for one split, assigning if they have none.
 *
 * `roll` is a number in [0, 1); below the split's share is the treatment. A
 * visitor already in an arm keeps it whatever the roll says, which is what
 * makes the split sticky. Keys for splits that no longer exist are dropped,
 * so the cookie is tidy after a test ends rather than carrying it for a
 * month.
 */
export function resolveLpArm(
  split: LpSplit,
  current: LpArms,
  roll: number,
  splits: readonly LpSplit[] = LP_SPLITS,
): LpResolution {
  const known = new Set(splits.map((s) => s.key));
  const arms: LpArms = {};
  let changed = false;

  for (const [key, arm] of Object.entries(current)) {
    if (known.has(key)) arms[key] = arm;
    else changed = true;
  }

  let arm = arms[split.key];
  if (!arm) {
    const share = Math.min(1, Math.max(0, split.share));
    arm = roll < share ? TREATMENT_ARM : CONTROL_ARM;
    arms[split.key] = arm;
    changed = true;
  }

  return { arm, arms, changed };
}
