'use client';

/**
 * The price this visitor is being quoted, in a component that renders on a
 * cached page.
 *
 * Most of the site is served from a cache: landing pages are ISR at 900
 * seconds, city and spot pages likewise. The server render is therefore shared
 * by everyone who reads that URL, and cannot say anything about which arm of a
 * price test one particular reader is in. This hook is the seam. It renders
 * the control price immediately, asks /api/split-tests who the reader is, and
 * swaps only if the answer differs.
 *
 * WHAT THE READER SEES. While no price test is running — the normal state, and
 * the state this ships in — the fetch returns the control and nothing ever
 * changes on screen. While a test IS running, a reader in the test arm sees
 * the control price for one network round trip and then the arm's price. That
 * is a real flicker and it is the price of keeping these pages cacheable; the
 * alternative is making every landing page dynamic, which costs every visitor
 * a slower page so that half of them avoid a flicker.
 *
 * The order summary at /plans/checkout uses `usePricingIn` below instead,
 * because its region dropdown moves the reader between currencies while the
 * page is open and the two arms are not the same amount in each. That surface
 * needs a price it can look up per currency, not the single one the server
 * settled from geo before anyone touched the dropdown.
 *
 * ONE REQUEST PER PAGE, not one per component. A landing page mentions the
 * price six times; the module-level cache below is what stops that being six
 * fetches. Components mounted after the first resolve read the cached answer
 * synchronously and never flicker at all.
 */

import { useEffect, useState } from 'react';
import {
  controlPricing,
  currencyForRegion,
  type BillingCurrency,
  type PricingView,
} from '@/lib/pricing';
import type { SplitArms } from '@/lib/split-tests';

export interface SplitResponse {
  arms: SplitArms;
  pricing: PricingView;
  byCurrency: Record<BillingCurrency, PricingView>;
}

let cached: SplitResponse | null = null;
let inFlight: Promise<SplitResponse | null> | null = null;
const subscribers = new Set<(value: SplitResponse) => void>();

async function fetchSplit(region?: string): Promise<SplitResponse | null> {
  if (cached) return cached;
  if (!inFlight) {
    const query = region ? `?region=${encodeURIComponent(region)}` : '';
    inFlight = fetch(`/api/split-tests${query}`, { credentials: 'same-origin' })
      .then((res) => (res.ok ? (res.json() as Promise<SplitResponse>) : null))
      .then((value) => {
        if (value?.pricing) {
          cached = value;
          for (const notify of subscribers) notify(value);
        }
        return value;
      })
      .catch(() => null)
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/**
 * @param region  The province or state this surface is SELLING TO, when it
 *                knows. A landing page built for Seattle is selling in USD to
 *                whoever reads it, including a reader sitting in Vancouver.
 *
 * When a region is given it decides the currency outright, and the reader's
 * location is ignored. That is not a nicety, it is the only way this can agree
 * with what actually gets charged: `lpCheckoutHref` sends `region=WA` to
 * /api/stripe/checkout, and that route lets the region beat the IP country. A
 * page that quoted the geo currency instead would show CAD 45 to a Canadian
 * reading the Seattle page and then bill them USD 39.
 *
 * Under the control price that mismatch was invisible, because $33 was $33 in
 * both currencies. The arms are 45 against 39, so it stopped being invisible.
 */
export function usePricing(region?: string): PricingView {
  const byCurrency = useSplitPricing();

  // No region means the surface genuinely does not know who it is selling to
  // (the paywall modal can open anywhere), and the server's geo answer is the
  // best available. It is also the answer checkout will reach for, since it
  // will have no region to prefer either.
  if (!region) return byCurrency?.geo ?? controlPricing('cad');

  const currency = currencyForRegion(region);
  return byCurrency?.rates?.[currency] ?? controlPricing(currency);
}

/**
 * The visitor's price in a currency the CALLER names, changeable at will.
 *
 * For the checkout summary, whose region dropdown moves the reader between
 * currencies while the page is open. `usePricing(region)` takes a region and
 * resolves it once; this takes the currency directly and re-reads on every
 * change, which is what a dropdown needs.
 */
export function usePricingIn(currency: BillingCurrency): PricingView {
  const resolved = useSplitPricing();
  return resolved?.rates?.[currency] ?? controlPricing(currency);
}

interface ResolvedPricing {
  /** Both currencies, for a caller that knows which one it is selling in. */
  rates: Record<BillingCurrency, PricingView>;
  /** The one the server picked from this reader's location. */
  geo: PricingView;
}

/** The single subscription every price hook above shares. */
function useSplitPricing(): ResolvedPricing | null {
  const [value, setValue] = useState<ResolvedPricing | null>(() => resolvedFrom(cached));

  useEffect(() => {
    if (cached) {
      setValue(resolvedFrom(cached));
      return;
    }
    const notify = (next: SplitResponse) => setValue(resolvedFrom(next));
    subscribers.add(notify);
    void fetchSplit();
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return value;
}

function resolvedFrom(response: SplitResponse | null): ResolvedPricing | null {
  if (!response?.byCurrency || !response.pricing) return null;
  return { rates: response.byCurrency, geo: response.pricing };
}

/** The arms this visitor is in, for surfaces that vary something else. */
export function useSplitArms(): SplitArms {
  const [arms, setArms] = useState<SplitArms>(() => cached?.arms ?? {});

  useEffect(() => {
    if (cached) {
      setArms(cached.arms);
      return;
    }
    const notify = (next: SplitResponse) => setArms(next.arms);
    subscribers.add(notify);
    void fetchSplit();
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  return arms;
}
