'use client';

import { useState } from 'react';
import { useMountedOnce } from '@/hooks/use-mounted-once';
import { useTrialModal } from '@/hooks/use-paywall-modal';
import { preloadTrialModal } from '@/lib/paywall-preload';
import type { NagFeatureId } from '@/lib/plan-features';

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
 * trigger. The modal's chunk is still kept out of the page's own load — it
 * goes out on an idle frame after the page settles, which is early enough
 * that the press itself has nothing to wait for.
 */
export default function TrialModalButton({
  children,
  className,
  feature = 'forecast-14d',
  from,
  spotName,
  placeName,
  onPress,
  'data-testid': testId,
}: {
  children: React.ReactNode;
  className?: string;
  /** Which wall this CTA speaks for — drives the headline and highlighted row. */
  feature?: NagFeatureId;
  /** Analytics origin ('marketing-hero', 'login-page', …). */
  from: string;
  spotName?: string;
  /**
   * The place the reader is looking at when the bar has one, which for a
   * header CTA is a city rather than a spot: the city under the Explore
   * camera. It becomes the blue word in the phone sheet's headline ("See the
   * next 14 days in Seattle") and names the reports row after the same city.
   *
   * Left unset by every surface that cannot honestly name one. A bar that
   * guessed would put a city in front of a reader who never chose it, which
   * is worse than the plain headline.
   */
  placeName?: string;
  /** Called on press, before the modal opens. For split-test CTA counters. */
  onPress?: () => void;
  'data-testid'?: string;
}) {
  const [open, setOpen] = useState(false);

  // Warmed on an idle frame and rendered without a Suspense boundary, so the
  // press has nothing to fetch and nothing to wait on. See
  // @/hooks/use-paywall-modal.
  const ProTrialModal = useTrialModal(useMountedOnce(open));

  return (
    <>
      <button
        type="button"
        className={className}
        // The backstop for a press that beats the idle warm: a finger is on
        // the glass for 80-300ms before the click fires, and the import can
        // use every one of them. No-op once the chunk is in the module cache.
        onPointerDown={preloadTrialModal}
        onClick={() => {
          onPress?.();
          setOpen(true);
        }}
        data-testid={testId}
      >
        {children}
      </button>
      {/* Marketing pages still don't pay for the matrix, the pricing tables
          and the checkout client on first paint — the chunk goes out on an
          idle frame, not with the page. */}
      {open && ProTrialModal && (
        <ProTrialModal
          open={open}
          onOpenChange={setOpen}
          feature={feature}
          from={from}
          spotName={spotName}
          placeName={placeName}
        />
      )}
    </>
  );
}
