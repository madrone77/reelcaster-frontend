"use client";

import { createContext, useContext } from "react";
import type { AdWall } from "@/lib/ad-mode";

/**
 * Is this subtree inside the ad frame, and under which wall?
 *
 * A context rather than a prop because the thing that needs the answer is
 * SpotCard's href, and SpotCard is rendered from five places (the desktop
 * rail, the mobile sheet twice, the mobile list, and the city page). Threading
 * a wall through all five to change one query string would put the ad frame
 * into the signature of components that are otherwise ignorant of it, and the
 * city page — which has no frame and never will — would have to pass null on
 * every one of them.
 *
 * Null is the product. Only ExploreShell provides a value, and only when the
 * URL carried `?ad=`; every other surface reads null and builds ordinary
 * links, which is what `withAdParams` returns for null anyway.
 *
 * Modelled on ./fishing-place, the same shape one segment over.
 */
export type AdFrame = {
  wall: AdWall;
  angle: string;
  /**
   * What any attempt to open a spot page does on the ad-framed map.
   *
   * Casey's call (2026-09-04): on the ad-framed Explore, FULL REPORT, a card
   * tap on a phone, the drawer's VIEW SPOT DETAILS and SET ALERT links, and a
   * search pick all stay on the map and open the trial modal, so the offer
   * arrives on the tap that showed the most intent. Callers use it instead
   * of navigating when it is set; hrefs stay in the markup, so a modified
   * click still opens the spot page.
   */
  onOpenSpot?: (spot: { name?: string }) => void;
};

const AdFrameContext = createContext<AdFrame | null>(null);

export const AdFrameProvider = AdFrameContext.Provider;

export function useAdFrame(): AdFrame | null {
  return useContext(AdFrameContext);
}
