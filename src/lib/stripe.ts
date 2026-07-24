import Stripe from 'stripe';
import { getServerSecret } from '@/lib/secrets';

// Lazy singleton: constructing the client at import time made `next build`
// throw while collecting page data (the secret only exists at runtime).
// getServerSecret prefers Vault when configured and falls back to
// process.env, so this is also the migration-ready pattern.
let cached: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!cached) {
    const secret = await getServerSecret('STRIPE_SECRET_KEY');
    cached = new Stripe(secret, {
      apiVersion: '2026-04-22.dahlia',
      typescript: true,
    });
  }
  return cached;
}

export function appOrigin(req?: Request): string {
  if (req) {
    const origin = new URL(req.url).origin;
    return origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3004';
}
