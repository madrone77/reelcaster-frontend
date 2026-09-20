'use client';

/**
 * Locked spots on the signed-out map.
 *
 * Was `explore_locked_spots_v1`, concluded 2026-09-20 with arm b (locked pins)
 * the winner: 6 trials on 429 exposures against the open map's 2 on 482. The
 * locks are now the default for every signed-out viewer on Explore, the city
 * page chart and the hero reel, with the landing spot and anything `?keep=`
 * named left open (see explore/lib/spot-locks.ts). Nothing is counted any
 * more; the hook keeps its shape so the four maps that read it did not have
 * to change.
 */

/** Which map: Explore, the city page's chart, or the hero phone reel. */
export type LockedSpotsSurface = 'explore_map' | 'city_map' | 'hero_reel';

export interface LockedSpots {
  /** Lock the pins. True whenever the viewer is signed out and auth has settled. */
  locksOn: boolean;
  /** Kept for the call sites; the split that counted presses has concluded. */
  reportLockPress: () => void;
}

/**
 * @param surface   Which map, or null when locks do not apply here: a
 *                  signed-in viewer, or auth still resolving. Nothing locks
 *                  while null, so a member never sees locks flash on and off.
 */
export function useLockedSpots(surface: LockedSpotsSurface | null): LockedSpots {
  return { locksOn: surface !== null, reportLockPress: () => {} };
}
