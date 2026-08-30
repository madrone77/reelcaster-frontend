/**
 * GET /api/split-tests → { arms, pricing }
 *
 * What a browser asks when the page it is on was served from a cache and
 * therefore cannot know who is reading it.
 *
 * That is most of the site. The landing pages are ISR at 900 seconds, city
 * pages and spot pages are cached too, and the whole point of a split test is
 * that two visitors to the same URL see different things. Something has to be
 * per-visitor, and the honest choice is to let the page stay cached and ask
 * this route for the one bit that varies, rather than to make every page
 * dynamic and lose the caching that makes them fast.
 *
 * Assignment happens HERE, not in middleware. Middleware runs on every request
 * for every asset and would need the registry at the edge; this runs only when
 * a surface actually needs to know, and can read Postgres like anything else.
 * The cookie it sets is what makes the answer stable for the next surface.
 *
 * The response deliberately carries no Stripe price id — only the amount to
 * display and the arm that produced it. The id is resolved server-side at
 * checkout from the arm, so a hand-edited response cannot buy at a price that
 * was never on offer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { pricingByCurrency, resolveSplitContext } from '@/lib/split-tests-server';
import { currencyForRegion } from '@/lib/pricing';
import {
  SPLIT_COOKIE,
  SPLIT_COOKIE_MAX_AGE,
  serializeSplitArms,
} from '@/lib/split-tests';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const region = request.nextUrl.searchParams.get('region');
  const currency = currencyForRegion(
    region,
    request.headers.get('x-vercel-ip-country'),
  );

  const ctx = await resolveSplitContext(request.headers.get('cookie'), currency);

  const response = NextResponse.json({
    arms: ctx.arms,
    // The visitor's own currency, for surfaces that only ever quote one.
    pricing: ctx.pricing,
    // Both, for the surfaces that let a reader change their region without
    // reloading. See pricingByCurrency for why one number is not enough now
    // that the arms differ per currency.
    byCurrency: pricingByCurrency(ctx.arms, ctx.tests),
  });

  // Written only when something actually changed, so a visitor already in an
  // arm gets a plain cacheable-looking response instead of a fresh Set-Cookie
  // on every page of their visit.
  if (ctx.changed) {
    response.cookies.set(SPLIT_COOKIE, serializeSplitArms(ctx.arms), {
      maxAge: SPLIT_COOKIE_MAX_AGE,
      path: '/',
      sameSite: 'lax',
      // Readable by client code on purpose: the surfaces that render a price
      // are components, and a httpOnly cookie would force every one of them
      // through another round trip to learn something that is not a secret.
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  // Never shared. Two visitors get two answers, which is the entire point.
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
