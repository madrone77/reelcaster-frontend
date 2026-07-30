import type { Metadata } from 'next';
import SupportClient from './support-client';

export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  title: 'Support',
  description:
    'Pro member support: guides, answers, billing, service status, and priority ticketing.',
  // Signed-in and Pro-gated. Nothing here is useful to a crawler, and every
  // path through it either redirects to /login or renders a paywall.
  robots: { index: false, follow: false },
};

export default function SupportPage() {
  return <SupportClient />;
}
