'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { NagFeatureId } from '@/lib/plan-features';

const ProTrialModal = dynamic(() => import('./pro-trial-modal'), { ssr: false });

/**
 * Any CTA that used to hand someone a signup form.
 *
 * Every entry point into "become a customer" opens the same modal now — the
 * plan matrix, the cadence choice, the email-and-pay flow, and the free-tier
 * link at its foot. A visitor who wants the free account still gets it in one
 * click; they just aren't asked to fill in a form before seeing what they'd
 * be signing up for.
 *
 * Marketing pages are server components, so this exists to give them a client
 * trigger. The modal itself is loaded on click, not with the page.
 */
export default function TrialModalButton({
  children,
  className,
  feature = 'forecast-14d',
  from,
  spotName,
  'data-testid': testId,
}: {
  children: React.ReactNode;
  className?: string;
  /** Which wall this CTA speaks for — drives the headline and highlighted row. */
  feature?: NagFeatureId;
  /** Analytics origin ('marketing-hero', 'login-page', …). */
  from: string;
  spotName?: string;
  'data-testid'?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => setOpen(true)}
        data-testid={testId}
      >
        {children}
      </button>
      {/* Mounted only once opened — marketing pages shouldn't pay for the
          matrix, the pricing tables and the checkout client on first paint. */}
      {open && (
        <ProTrialModal
          open={open}
          onOpenChange={setOpen}
          feature={feature}
          from={from}
          spotName={spotName}
        />
      )}
    </>
  );
}
