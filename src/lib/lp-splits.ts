/**
 * Whole-page landing splits: half of an ad's clicks to one page and half to
 * another, decided at the edge before either page renders.
 *
 * WHY THIS IS NOT src/lib/split-tests.ts. That system swaps a price or a
 * component INSIDE a page, so it can assign arms from a route the page calls
 * after it has loaded, and every page stays cached. Here the two arms are two
 * different pages. The only place that can send a visitor to one URL or the
 * other before they have seen either is middleware, and middleware cannot
 * read the registry without a database round trip on every request. So the
 * table is code, the flip is a redirect, and starting or stopping a split is
 * a merge, which deploys on its own.
 *
 * WHY A REDIRECT AND NOT A REWRITE. A rewrite would serve the treatment under
 * the control's URL, so the address bar, the Meta pixel's page view and our
 * own first-touch cookie would all name the wrong page for half the visitors.
 * A redirect costs one hop and leaves every record naming the page the person
 * actually saw. It also avoids a known trap: redirect() and notFound() raised
 * inside a rewritten request are answered 200 with an empty document rather
 * than as real statuses.
 *
 * COUNTING NEEDS NOTHING NEW. Each page already counts its own hits and CTA
 * presses under its own landing key (src/app/lp/_city1/city1-city.ts), the
 * first-touch cookie already records the entry path, and the campaigns report
 * already has one row per landing key. The split only decides which of two
 * existing rows a bought click lands on.
 *
 * The cookie holds arm names and no identifier, for the same reason rc_split
 * does: "vancouver_4_5:b" says which side of a coin toss someone landed on
 * and identifies nobody. Same grammar, separate cookie, because
 * /api/split-tests rewrites rc_split against the registry and would drop a
 * key it has never heard of.
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
  /** The path the ad points at. Exact match; a trailing slash is ignored. */
  control: string;
  /** Where the treatment share is sent. The query string rides along intact. */
  treatment: string;
  /** Fraction of NEW visitors sent to the treatment, 0 to 1. */
  share: number;
}

/**
 * Every running split.
 *
 * Remove a row to stop its test. Visitors already in the treatment arm are
 * served the control from then on, because nothing matches their path any
 * more, and their stale cookie entry is dropped on the next visit.
 */
export const LP_SPLITS: readonly LpSplit[] = [
  {
    key: 'vancouver_4_5',
    control: '/lp/vancouver/4',
    treatment: '/lp/vancouver/5',
    share: 0.5,
  },
];

export const CONTROL_ARM = 'a';
export const TREATMENT_ARM = 'b';
export type LpArm = typeof CONTROL_ARM | typeof TREATMENT_ARM;

/** split key → arm. `{ vancouver_4_5: 'b' }`. */
export type LpArms = Record<string, LpArm>;

const KEY_RE = /^[a-z0-9_]{1,64}$/;

function isArm(value: string): value is LpArm {
  return value === CONTROL_ARM || value === TREATMENT_ARM;
}

/** The split whose control path this is, or null. */
export function splitForPath(
  pathname: string,
  splits: readonly LpSplit[] = LP_SPLITS,
): LpSplit | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  return splits.find((s) => s.control === path) ?? null;
}

/**
 * `"vancouver_4_5:b|other:a"` → `{ vancouver_4_5: 'b', other: 'a' }`.
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
