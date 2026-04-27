import Stripe from 'stripe';

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  // Fail loud at import time on the server so misconfig is obvious.
  throw new Error('STRIPE_SECRET_KEY is required');
}

export const stripe = new Stripe(secret, {
  apiVersion: '2026-04-22.dahlia',
  typescript: true,
});

export function appOrigin(req?: Request): string {
  if (req) {
    const origin = new URL(req.url).origin;
    return origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004';
}
