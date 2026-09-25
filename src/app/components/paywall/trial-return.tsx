'use client';

import { useEffect, useState } from 'react';
import { useLazyComponent } from '@/hooks/use-lazy-component';
import { useMountedOnce } from '@/hooks/use-mounted-once';
import { loadTrialModal } from '@/lib/paywall-preload';
import { takeTrialSheet, type TrialSheetRecord } from '@/lib/trial-return';
import type { NagFeatureId } from '@/lib/plan-features';

/**
 * Reopens the sheet a reader left for Stripe, when they come back to it.
 *
 * Mounted once at the root, so every wall that can send someone to Stripe is
 * covered without each learning to reopen itself: the modal records what it
 * was (from, feature, place, region, page) on the Start tap, and this reads
 * it back on the next full load of that page. `takeTrialSheet` decides
 * whether this load is a return (Stripe's back arrow, or the browser's back
 * button) and hands the record over once.
 *
 * Renders nothing, and loads no chunk, for everyone else: the modal module is
 * fetched only when there is a sheet to reopen (no idle warm here, unlike
 * useTrialModal, because this sits on every page of the app).
 */
export default function TrialReturn() {
  const [sheet, setSheet] = useState<TrialSheetRecord | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const rec = takeTrialSheet();
    if (!rec) return;
    setSheet(rec);
    setOpen(true);
  }, []);

  const ProTrialModal = useLazyComponent(loadTrialModal, useMountedOnce(open));
  if (!sheet || !ProTrialModal) return null;
  return (
    <ProTrialModal
      open={open}
      onOpenChange={setOpen}
      feature={sheet.feature as NagFeatureId}
      from={sheet.from}
      spotName={sheet.spotName}
      placeName={sheet.placeName}
      region={sheet.region}
      tapped={sheet.tapped}
    />
  );
}
