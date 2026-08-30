/**
 * The server half of split testing: reading the registry, resolving a
 * visitor's price, and refusing to charge an amount nobody displayed.
 *
 * SERVER-ONLY. This module holds the service-role Supabase client and reads
 * environment variables that are not NEXT_PUBLIC. Importing it from a client
 * component would not leak the key (Next inlines only NEXT_PUBLIC_ vars, so
 * the rest arrive as undefined) but it would do something subtler and worse:
 * `priceIdFromEnv` would return an empty string in the browser, every arm
 * would silently look unconfigured, and the control price would be rendered
 * for everyone while the server charged the test price. The pure half lives in
 * ./split-tests and is the one a client component may import.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import {
  armsFromCookieHeader,
  assignArms,
  paymentArm,
  type SplitArms,
  type SplitTest,
  type SplitVariant,
} from './split-tests';
import {
  CONTROL_ANNUAL_CENTS,
  dollars,
  perMonthCents,
  type BillingCurrency,
  type PricingView,
} from './pricing';

// ── The registry ─────────────────────────────────────────────────────────

/**
 * Read once a minute per server process, not once per request.
 *
 * A module memo rather than a framework cache helper on purpose: this is
 * called from route handlers and server components alike, and a plain TTL
 * behaves identically in both without anyone having to remember which caching
 * semantics apply where. The cost is that flipping a test to `running` takes
 * up to a minute plus a cold start to reach every instance, which for a thing
 * measured in days is not a cost.
 *
 * A failed read returns an empty registry, which means no test is running,
 * which means every visitor gets the control. Failing toward today's price is
 * the only acceptable direction for this particular lookup.
 */
const REGISTRY_TTL_MS = 60_000;

let registryCache: { at: number; tests: SplitTest[] } | null = null;
let registryInFlight: Promise<SplitTest[]> | null = null;

function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface TestRow {
  key: string;
  name: string;
  surface_kind: string;
  status: string;
  split_by_currency: boolean;
}

interface VariantRow {
  test_key: string;
  variant: string;
  label: string;
  weight: number;
  is_control: boolean;
  config: Record<string, unknown> | null;
}

async function fetchRegistry(): Promise<SplitTest[]> {
  const admin = serviceClient();
  if (!admin) return [];

  const [tests, variants] = await Promise.all([
    admin
      .from('split_tests')
      .select('key, name, surface_kind, status, split_by_currency')
      // draft and concluded tests are deliberately not read: a test that is
      // not serving should cost the request nothing and appear nowhere.
      .in('status', ['running', 'paused']),
    admin
      .from('split_test_variants')
      .select('test_key, variant, label, weight, is_control, config'),
  ]);

  if (tests.error || variants.error) {
    console.warn('[split-tests] registry read failed', tests.error ?? variants.error);
    return [];
  }

  const byTest = new Map<string, SplitVariant[]>();
  for (const v of (variants.data ?? []) as VariantRow[]) {
    const list = byTest.get(v.test_key) ?? [];
    list.push({
      variant: v.variant,
      label: v.label,
      weight: Math.max(0, v.weight ?? 0),
      isControl: Boolean(v.is_control),
      config: (v.config ?? {}) as Record<string, unknown>,
    });
    byTest.set(v.test_key, list);
  }

  return ((tests.data ?? []) as TestRow[])
    .map((t) => ({
      key: t.key,
      name: t.name,
      surfaceKind: t.surface_kind,
      status: t.status as SplitTest['status'],
      splitByCurrency: Boolean(t.split_by_currency),
      variants: (byTest.get(t.key) ?? []).sort((a, b) =>
        a.variant.localeCompare(b.variant),
      ),
    }))
    // A test with fewer than two arms is not a test. Dropping it here rather
    // than at assignment means a half-written registry row cannot put anyone
    // into an arm with nothing to compare against.
    .filter((t) => t.variants.length >= 2);
}

export async function loadSplitTests(): Promise<SplitTest[]> {
  const now = Date.now();
  if (registryCache && now - registryCache.at < REGISTRY_TTL_MS) {
    return registryCache.tests;
  }
  // Coalesce: a cold instance taking ten concurrent requests should make one
  // round trip, not ten.
  if (!registryInFlight) {
    registryInFlight = fetchRegistry()
      .then((tests) => {
        registryCache = { at: Date.now(), tests };
        return tests;
      })
      .catch((err) => {
        console.warn('[split-tests] registry read threw', err);
        return [] as SplitTest[];
      })
      .finally(() => {
        registryInFlight = null;
      });
  }
  return registryInFlight;
}

/**
 * Is anything running that changes what a price surface should say?
 *
 * Worth its own helper because it is what lets pages stay statically cached
 * while nothing is running. A page that always read the arms would deopt to
 * dynamic rendering forever; a page that asks this first pays that cost only
 * for the days a price test is actually live.
 */
export async function paymentTestRunning(): Promise<boolean> {
  const tests = await loadSplitTests();
  return tests.some((t) => t.surfaceKind === 'payment');
}

// ── Resolving a price ────────────────────────────────────────────────────

function controlView(currency: BillingCurrency): PricingView {
  const cents = CONTROL_ANNUAL_CENTS[currency];
  return {
    currency,
    cents,
    perMonthCents: perMonthCents(cents),
    amount: dollars(cents),
    perMonth: dollars(perMonthCents(cents)),
    testKey: null,
    variant: null,
    priceEnv: 'STRIPE_ANNUAL_PRICE_ID',
  };
}

/**
 * Read an arm's advertised amount out of its registry config.
 *
 * Every failure here lands on the control, loudly. A payment arm whose config
 * cannot be read is not a reason to show someone a blank price or a zero; it
 * is a reason to show them today's price and to leave a line in the log
 * saying the registry row needs fixing.
 */
export function pricingFromArms(
  arms: SplitArms,
  tests: SplitTest[],
  currency: BillingCurrency,
): PricingView {
  const arm = paymentArm(arms, tests);
  if (!arm) return controlView(currency);

  const config = arm.variant.config ?? {};
  const where = `${arm.test.key}:${arm.variant.variant}`;

  // The control arm carries the same config shape as any other, so it flows
  // through this path too rather than being special-cased. That matters: it
  // means the control's advertised amount is verified against Stripe at
  // checkout on exactly the same terms as the test arm's.
  const centsMap = config.cents;
  if (!centsMap || typeof centsMap !== 'object') {
    console.warn(`[pricing] arm ${where} has no cents map`);
    return controlView(currency);
  }

  const cents = (centsMap as Record<string, unknown>)[currency];
  if (typeof cents !== 'number' || !Number.isInteger(cents) || cents <= 0) {
    console.warn(`[pricing] arm ${where} has no valid ${currency} amount`);
    return controlView(currency);
  }

  const priceEnv = typeof config.price_env === 'string' ? config.price_env : '';
  if (!priceEnv) {
    console.warn(`[pricing] arm ${where} names no price_env`);
    return controlView(currency);
  }

  // The second lock. An arm whose environment variable is unset cannot be
  // served, no matter what the registry says, and the visitor quietly gets
  // today's price. This is what lets the whole system ship dark: the rows can
  // exist, the test can even be flipped to running by mistake, and until
  // someone deliberately sets that variable on the Vercel project nobody is
  // quoted a price that was not already being charged.
  if (!priceIdFromEnv(priceEnv)) {
    console.info(`[pricing] arm ${where} not served: ${priceEnv} is unset`);
    return controlView(currency);
  }

  return {
    currency,
    cents,
    perMonthCents: perMonthCents(cents),
    amount: dollars(cents),
    perMonth: dollars(perMonthCents(cents)),
    testKey: arm.test.key,
    variant: arm.variant.variant,
    priceEnv,
  };
}

/**
 * The Stripe price id behind an arm.
 *
 * Enumerated rather than looked up as `process.env[priceEnv]`, because Next
 * inlines environment variables at build time and a dynamic index reads
 * undefined in exactly the bundles that matter. Adding a third arm means
 * adding a line here, which is the point: a price no human deliberately wired
 * up cannot be charged.
 */
export function priceIdFromEnv(priceEnv: string): string {
  switch (priceEnv) {
    case 'STRIPE_ANNUAL_PRICE_ID':
      return process.env.STRIPE_ANNUAL_PRICE_ID ?? '';
    case 'STRIPE_ANNUAL_PRICE_ID_B':
      return process.env.STRIPE_ANNUAL_PRICE_ID_B ?? '';
    default:
      return '';
  }
}

// ── Verifying before charging ────────────────────────────────────────────

/**
 * What Stripe says a price costs, memoised for the life of the process.
 *
 * A price object is immutable in Stripe, so this can be cached without a TTL:
 * the only way the answer changes is a new price id, which is a new cache key.
 */
const verifiedAmounts = new Map<string, Record<string, number>>();

async function amountsForPrice(
  stripe: Stripe,
  priceId: string,
): Promise<Record<string, number> | null> {
  const cached = verifiedAmounts.get(priceId);
  if (cached) return cached;

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['currency_options'],
    });

    const amounts: Record<string, number> = {};
    if (typeof price.unit_amount === 'number' && price.currency) {
      amounts[price.currency] = price.unit_amount;
    }
    for (const [code, option] of Object.entries(price.currency_options ?? {})) {
      if (typeof option.unit_amount === 'number') amounts[code] = option.unit_amount;
    }

    verifiedAmounts.set(priceId, amounts);
    return amounts;
  } catch (err) {
    console.error(`[pricing] could not retrieve price ${priceId}`, err);
    return null;
  }
}

export type PriceCheck =
  | { ok: true; priceId: string; cents: number }
  | { ok: false; reason: 'unset' | 'unreadable' | 'mismatch' | 'no_currency' };

/**
 * The price id to charge, but only if Stripe agrees it costs what we said.
 *
 * This is the guard that makes a price split test safe to run. The registry
 * carries two facts that must agree — an amount to display and a variable
 * naming the price to charge — and nothing but this check stops them drifting
 * apart. They drift the moment someone edits a `cents` value without touching
 * Stripe, or points the variable at the wrong price, both of which are one
 * careless afternoon away.
 *
 * On any disagreement the caller REFUSES the sale rather than falling back to
 * the control. A fallback charges a different number than the one on the
 * screen, which is the exact failure this exists to prevent; it merely fails
 * in the cheaper direction for this particular test, and would fail in the
 * more expensive one for a test that priced below the control.
 */
export async function verifiedPriceForCheckout(
  stripe: Stripe,
  view: PricingView,
): Promise<PriceCheck> {
  const priceId = priceIdFromEnv(view.priceEnv);
  if (!priceId) return { ok: false, reason: 'unset' };

  const amounts = await amountsForPrice(stripe, priceId);
  if (!amounts) return { ok: false, reason: 'unreadable' };

  const actual = amounts[view.currency];
  if (typeof actual !== 'number') {
    console.error(
      `[pricing] price ${priceId} has no ${view.currency} amount; ` +
        'a currency option is missing in Stripe',
    );
    return { ok: false, reason: 'no_currency' };
  }

  if (actual !== view.cents) {
    console.error(
      `[pricing] REFUSING CHECKOUT: displayed ${view.cents} ${view.currency} but ` +
        `Stripe price ${priceId} charges ${actual}. Fix the split_test_variants ` +
        'config or the price id before this arm can be sold.',
    );
    return { ok: false, reason: 'mismatch' };
  }

  return { ok: true, priceId, cents: actual };
}

/**
 * The arm's price in BOTH currencies.
 *
 * The display path needs this and a single view will not do, because the
 * currency is not settled at render time on the surfaces that matter. The
 * checkout summary has a region selector: a reader can arrive from a Seattle
 * ad, see USD, switch the dropdown to British Columbia and now owes CAD. With
 * one multi-currency price at the same number in both, that used to be a
 * cosmetic change. With CAD 45 against USD 39 it is a different amount, and a
 * page that would have to go back to the server to find out would either show
 * a stale number or flicker on every change of a dropdown.
 */
export function pricingByCurrency(
  arms: SplitArms,
  tests: SplitTest[],
): Record<BillingCurrency, PricingView> {
  return {
    cad: pricingFromArms(arms, tests, 'cad'),
    usd: pricingFromArms(arms, tests, 'usd'),
  };
}

// ── One call for a route handler ─────────────────────────────────────────

export interface SplitContext {
  tests: SplitTest[];
  arms: SplitArms;
  /** True when the caller should write the cookie back. */
  changed: boolean;
  pricing: PricingView;
}

/**
 * Everything a request needs: the registry, this visitor's arms brought up to
 * date, and the price they are being quoted.
 *
 * The currency is passed in rather than derived here because the two callers
 * know it by different routes — a checkout route has the posted region, a
 * server component has the geo header — and neither answer belongs in this
 * file.
 */
export async function resolveSplitContext(
  cookieHeader: string | null | undefined,
  currency: BillingCurrency,
): Promise<SplitContext> {
  const tests = await loadSplitTests();
  const { arms, changed } = assignArms(armsFromCookieHeader(cookieHeader), tests);
  return { tests, arms, changed, pricing: pricingFromArms(arms, tests, currency) };
}
