'use client';

/**
 * Whether the Pro trial modal names the lock the reader pressed.
 *
 * Arm a is control: the modal as it stands, on both shapes. The desktop
 * dialog leads with "See the next 14 days at <spot>" whatever was pressed;
 * the phone sheet leads with "Try ReelCaster Pro / 7 days free" and names
 * no lock at all (only the padlocked-pin walls hand it a line). Arm b puts
 * one line over the offer on both shapes, from WALL_UNLOCK_LABELS in
 * src/lib/plan-features: "Unlock all spots" for a padlocked pin, "Unlock
 * the full 14-day forecast" for a locked day, "Unlock score alerts" for the
 * bell, and so on for every wall in the product.
 *
 * WHAT THE TEST IS ASKING. Every wall opens the same offer, so a reader who
 * pressed a padlock and a reader who pressed a locked day get the same
 * screen, and neither screen says what pressing it would open. The guess is
 * that a modal that answers the press ("you wanted all the spots; here is
 * where you get them") converts more of the presses into trials than one
 * that changes the subject to the plan. The risk is the opposite: a line
 * naming one feature sells a smaller thing than "Pro", and the reader who
 * did not much want that one feature closes it.
 *
 * WHERE. Both shapes of the modal, read inside the content that mounts on
 * open (DialogBody in pro-trial-modal, TrialSheetStripe), so a wall that
 * mounts closed counts nothing. Exposure = the modal opened with an arm;
 * cta_click = the buy button pressed (any method that leads to the card).
 * The surface is `<shape>_<feature>` so the report can be read per lock:
 * a label may help the padlock and hurt the bell, and one pooled rate would
 * hide that. Pooling is a filter on the admin page.
 *
 * ONE EXPOSURE PER ARM PER SURFACE PER PAGE LOAD, the house rule. Stop it
 * with an UPDATE on `split_tests`; with no arm assigned every reader gets
 * arm a, which is today.
 */

import { useEffect } from 'react';
import { WALL_UNLOCK_LABELS, type NagFeatureId } from '@/lib/plan-features';
import { useSplitArms } from './use-pricing';
import { reportSplitArmCta, reportSplitArmExposure } from './report';

export const WALL_LABEL_TEST = 'wall_label_v1';

/** Which shape of the modal is drawing it. */
export type WallLabelShape = 'sheet' | 'dialog';

const seen = new Set<string>();

export interface WallLabelArm {
  /** The line to draw over the offer on arm b; undefined on arm a and outside the test. */
  label: string | undefined;
  /** Call when the buy button is pressed. No-op outside the test. */
  reportPress: () => void;
}

/**
 * @param feature The wall the reader pressed, as the counter records it.
 * @param shape   Which shape is open. A page never mounts both at once.
 */
export function useWallLabel(feature: NagFeatureId, shape: WallLabelShape): WallLabelArm {
  const arms = useSplitArms();
  const arm = arms[WALL_LABEL_TEST] ?? null;
  const surface = `${shape}_${feature}`;

  useEffect(() => {
    if (!arm) return;
    const key = `${WALL_LABEL_TEST}:${arm}:${surface}`;
    if (seen.has(key)) return;
    seen.add(key);
    reportSplitArmExposure(WALL_LABEL_TEST, arm, surface);
  }, [arm, surface]);

  return {
    label: arm === 'b' ? WALL_UNLOCK_LABELS[feature] : undefined,
    reportPress: () => {
      if (!arm) return;
      reportSplitArmCta(WALL_LABEL_TEST, arm, surface);
    },
  };
}
