/**
 * Live split testing: which arm is this visitor in, and how does that stay
 * true from the landing page all the way to the charge.
 *
 * Three moving parts, and they are deliberately in three different places:
 *
 *   the registry   Postgres (`split_tests` + `split_test_variants`). What is
 *                  being tested and whether it is running. A test starts and
 *                  stops with an UPDATE, not a deploy.
 *   the membership a cookie on the visitor (`rc_split`). Arm names only.
 *   the counting   `split_test_events_daily`, via /api/split-tests/event.
 *
 * WHY THE COOKIE HOLDS ARMS AND NOT AN ID. The obvious design is a random
 * visitor id, hashed with the test key to pick an arm. It is one short string
 * and it survives weight changes. It is also an identifier: once every request
 * carries a stable per-person token, this stops being the counter the rest of
 * our telemetry is (see campaign_events_daily) and becomes a tracking system
 * with a retention policy to write. Storing the arm names themselves costs a
 * few more bytes and identifies nobody. "price_annual_v2:b" says which half of
 * a coin toss someone landed on, and there is no id to join it to.
 *
 * The trade is real and worth naming: with no id, a person cannot be counted
 * once. Exposures are exposures, not people, and every rate built on them is
 * per-exposure. The report says so in as many words.
 *
 * NOTHING RUNS UNTIL SOMETHING SAYS RUN. A test with status 'draft' assigns
 * nobody and serves the control to everybody, which is the state the price
 * test ships in. For a payment test there is a second, independent lock: the
 * arm names an environment variable, and with that variable unset the arm
 * cannot be served no matter what the registry says. Either lock alone keeps
 * every visitor on today's price.
 */

export const SPLIT_COOKIE = 'rc_split';

/** Six months. Long enough that a test outlives its own read window. */
export const SPLIT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** test key → variant. `{ price_annual_v2: 'b' }`. */
export type SplitArms = Record<string, string>;

export interface SplitVariant {
  variant: string;
  label: string;
  weight: number;
  isControl: boolean;
  config: Record<string, unknown>;
}

export interface SplitTest {
  key: string;
  name: string;
  surfaceKind: string;
  status: 'draft' | 'running' | 'paused' | 'concluded';
  splitByCurrency: boolean;
  variants: SplitVariant[];
}

/**
 * Shapes, not lists. A key that does not match is dropped rather than
 * corrected, because the cookie is client-writable and the only thing worth
 * doing with a value we did not write is refusing it. The worst a hand-edited
 * cookie can achieve is putting its owner in an arm of their choosing, which
 * is a wrong number on an internal dashboard and not an exposure of anything.
 */
const TEST_KEY_RE = /^[a-z0-9_]{1,64}$/;
const VARIANT_RE = /^[a-z0-9]{1,8}$/;

/** `"price_annual_v2:b|modal_copy_v1:a"` → `{ price_annual_v2: 'b', ... }`. */
export function parseSplitCookie(raw: string | null | undefined): SplitArms {
  const arms: SplitArms = {};
  if (!raw) return arms;
  for (const pair of raw.split('|')) {
    const idx = pair.indexOf(':');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx);
    const variant = pair.slice(idx + 1);
    if (!TEST_KEY_RE.test(key) || !VARIANT_RE.test(variant)) continue;
    arms[key] = variant;
  }
  return arms;
}

export function serializeSplitArms(arms: SplitArms): string {
  return Object.entries(arms)
    .map(([key, variant]) => `${key}:${variant}`)
    .join('|');
}

/** Read the arms off a raw Cookie header, for routes that have the request. */
export function armsFromCookieHeader(header: string | null | undefined): SplitArms {
  if (!header) return {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${SPLIT_COOKIE}=`)) {
      return parseSplitCookie(decodeURIComponent(trimmed.slice(SPLIT_COOKIE.length + 1)));
    }
  }
  return {};
}

// ── Assignment ───────────────────────────────────────────────────────────

function pickWeighted(variants: SplitVariant[]): SplitVariant {
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  // Every weight zero is a registry mistake, not an instruction to serve
  // nobody. Fall back to the control so the surface still renders.
  if (total <= 0) return variants.find((v) => v.isControl) ?? variants[0];

  let roll = Math.random() * total;
  for (const v of variants) {
    roll -= v.weight;
    if (roll < 0) return v;
  }
  return variants[variants.length - 1];
}

export interface AssignResult {
  arms: SplitArms;
  /** True when the cookie needs rewriting. Nothing sets a cookie needlessly. */
  changed: boolean;
}

/**
 * Bring a visitor's arm memberships up to date against the registry.
 *
 * Four rules, and the order matters:
 *
 *   1. A test that is no longer running or paused is REMOVED. A concluded
 *      test must stop serving its arm the moment it concludes, and leaving
 *      the key in the cookie would keep serving it for six months.
 *   2. An arm that no longer exists in the registry is reassigned. Deleting a
 *      variant row otherwise strands everyone who was in it.
 *   3. A `paused` test keeps the arms already assigned and hands out no new
 *      ones. That is the difference between paused and stopped: the people
 *      mid-decision keep the price they were quoted.
 *   4. A `running` test with no arm yet gets one, by weight.
 */
export function assignArms(current: SplitArms, tests: SplitTest[]): AssignResult {
  const arms: SplitArms = {};
  let changed = false;

  const byKey = new Map(tests.map((t) => [t.key, t]));

  for (const [key, variant] of Object.entries(current)) {
    const test = byKey.get(key);
    if (!test) {
      changed = true; // rule 1
      continue;
    }
    if (test.variants.some((v) => v.variant === variant)) {
      arms[key] = variant;
    } else {
      arms[key] = pickWeighted(test.variants).variant; // rule 2
      changed = true;
    }
  }

  for (const test of tests) {
    if (arms[test.key]) continue;
    if (test.status !== 'running') continue; // rule 3
    arms[test.key] = pickWeighted(test.variants).variant; // rule 4
    changed = true;
  }

  return { arms, changed };
}

/** The arm a visitor is in for one test, or null. */
export function armFor(
  arms: SplitArms,
  tests: SplitTest[],
  key: string,
): { test: SplitTest; variant: SplitVariant } | null {
  const test = tests.find((t) => t.key === key);
  if (!test) return null;
  const variant = test.variants.find((v) => v.variant === arms[key]);
  return variant ? { test, variant } : null;
}

/**
 * The payment arm in play, if any.
 *
 * First match wins and that is deliberate: two simultaneous price tests would
 * make "what does this cost" a question with two answers, and the honest
 * failure is to pick one rather than to blend them. If a second payment test
 * is ever wanted, the registry is where the collision should be prevented.
 */
export function paymentArm(
  arms: SplitArms,
  tests: SplitTest[],
): { test: SplitTest; variant: SplitVariant } | null {
  for (const test of tests) {
    if (test.surfaceKind !== 'payment') continue;
    const variant = test.variants.find((v) => v.variant === arms[test.key]);
    if (variant) return { test, variant };
  }
  return null;
}

// ── Carrying the arms to Stripe and back ─────────────────────────────────

/**
 * Stripe metadata keys for the arms in play.
 *
 * This is the ONLY carrier that survives a hosted-checkout round trip for a
 * buyer who has no account yet: there is no user row to write to, the cookie
 * does not travel to Stripe, and by the time the webhook fires a week later
 * for the first real payment, the browser that was assigned the arm is long
 * gone. Lose this and a price test can count who saw each arm but not which
 * arm anybody bought, which is the entire question.
 *
 * Prefixed rather than bundled into one JSON value so a human reading a
 * subscription in the Stripe dashboard can see which test it belonged to.
 */
export const SPLIT_METADATA_PREFIX = 'split_';

export function splitMetadata(arms: SplitArms): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, variant] of Object.entries(arms)) {
    // Stripe caps metadata keys at 40 characters. A key that would be clipped
    // is dropped whole: a truncated key silently joins the wrong test.
    const metaKey = `${SPLIT_METADATA_PREFIX}${key}`;
    if (metaKey.length > 40) {
      console.warn(`[split-tests] test key too long for Stripe metadata: ${key}`);
      continue;
    }
    out[metaKey] = variant;
  }
  return out;
}

/** The inverse, for the webhook. `split_price_annual_v2: 'b'` → `{...}`. */
export function armsFromMetadata(
  metadata: Record<string, string> | null | undefined,
): SplitArms {
  const arms: SplitArms = {};
  for (const [key, value] of Object.entries(metadata ?? {})) {
    if (!key.startsWith(SPLIT_METADATA_PREFIX)) continue;
    const testKey = key.slice(SPLIT_METADATA_PREFIX.length);
    if (!TEST_KEY_RE.test(testKey) || !VARIANT_RE.test(value)) continue;
    arms[testKey] = value;
  }
  return arms;
}
