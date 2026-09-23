"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { AdFrameProvider } from "@/app/explore/lib/ad-frame";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import { useSubscription } from "@/hooks/use-subscription";
import { trackEvent } from "@/lib/analytics";
import { withAdParams, type AdWall } from "@/lib/ad-mode";
import {
  reportCampaignCta,
  useCampaignHit,
  type CampaignTarget,
} from "@/app/lp/_shared/lp-telemetry";
import AdHero, { AD_HERO_REEL_COL } from "../[spot]/ad-intro";
import { useMountedOnce } from "@/hooks/use-mounted-once";
import { useTrialModal } from "@/hooks/use-paywall-modal";

/**
 * "Open the trial modal", handed down the frame so the second ask below the
 * map (see ProGate adFrame) opens the same modal as the hero button instead
 * of linking out to /plans/checkout, which would leave the frame.
 */
const AdTrialContext = createContext<((placement: string) => void) | null>(null);

/**
 * The frame's "open the trial modal", or null outside the frame. For a
 * component that renders on both the public city page and this frame and has
 * to send its locked state somewhere different on each: the report band opens
 * the upgrade dialog on the public page and this modal here.
 */
export function useAdTrial(): ((placement: string) => void) | null {
  return useContext(AdTrialContext);
}

export function AdTrialButton({
  placement,
  className,
  children,
}: {
  placement: string;
  className: string;
  children: ReactNode;
}) {
  const open = useContext(AdTrialContext);
  return (
    <button type="button" className={className} onClick={() => open?.(placement)}>
      {children}
    </button>
  );
}

/**
 * The city ad page's frame: the same top bar, hero and trial modal as the spot
 * ad page, wrapped around the city's own sections.
 *
 * Everything below the hero renders inside `AdFrameProvider`, which is what
 * keeps a city page's links in the frame: the ranked list, the instrument's
 * featured mark, its map and the custom spots button all read the frame and
 * carry `?ad=` (and the keyword's `species`) onto the spot pages they open.
 * Those spot pages are the framed spot ad pages, so a click from here lands
 * on "Constance Bank Chinook Fishing Report", not on the public page.
 *
 * `data-ad-frame` is what hides the app's bottom tab bar (see globals.css).
 */
export default function CityAdView({
  citySlug,
  cityName,
  wall,
  angle,
  campaign,
  speciesParam,
  keepSlug,
  hero,
  reel,
  children,
}: {
  citySlug: string;
  cityName: string;
  wall: AdWall;
  angle: string;
  /** What Campaign results counts this page as. The page builds it once and
   *  hands the same object to the instrument, so the hit is filed under one
   *  key and counted once per tab. */
  campaign: CampaignTarget;
  /** The keyword's species slug, carried onto every framed spot link. */
  speciesParam: string | null;
  /** The mark the hero features. The map link names it in `?keep=` so the ad
   *  map's lock test leaves it open: the page already showed its score. */
  keepSlug: string | null;
  hero: {
    pills: ReactNode;
    title: string;
    spotName: string;
    fish: string | null;
    /** The fish's slug, for the engraved plate beside the verdict. */
    fishSlug: string | null;
    score: number | null;
    windowLabel: string | null;
    verdictText: string | null;
    whenText: string | null;
    explainerText: string;
    footnoteText: string;
  };
  reel: ReactNode;
  children: ReactNode;
}) {
  const { isPaid } = useSubscription();
  const [trialOpen, setTrialOpen] = useState(false);
  // The wall itself: warmed on an idle frame and rendered without a Suspense
  // boundary, so the tap has nothing left to fetch and nothing to wait on.
  // Null until it has loaded, which is what `next/dynamic` drew here too.
  // See @/hooks/use-paywall-modal.
  const ProTrialModal = useTrialModal(useMountedOnce(trialOpen));

  // The landing hit, once per tab. Unconditional: this frame only renders
  // under ?ad=, and nothing but an ad link carries that, so a framed visit
  // is an ad arrival whether or not the UTM tags survived the hop.
  useCampaignHit(campaign);

  const openTrial = (placement: string) => {
    trackEvent("City Ad Intro Trial Clicked", { city: citySlug, ad_wall: wall, placement });
    // The report's CTR numerator. The hero's trial button is the hero press;
    // the banner under the map is the second ask. Same positions the spot
    // and /lp pages use, so the column compares across page kinds.
    reportCampaignCta(placement === "hero" ? "hero" : "secondary", campaign);
    setTrialOpen(true);
  };
  const frame = {
    wall,
    angle,
    params: speciesParam ? { species: speciesParam } : undefined,
  };

  return (
    <div data-ad-frame="" className="min-h-dvh bg-rc-panel">
      <ExploreTopBar
        adFrame
        adBarEdge="top"
        upgradeCta={!isPaid}
        placeName={cityName}
        ctaOverColumn={reel ? AD_HERO_REEL_COL : undefined}
      />
      <div className="pt-16">
        <div className={`${PAGE_MEASURE} py-6 lg:py-8 space-y-10`}>
          <AdHero
            pills={hero.pills}
            title={hero.title}
            updatedLabel="Updated today"
            spotName={hero.spotName}
            fish={hero.fish}
            fishSlug={hero.fishSlug}
            score={hero.score}
            windowLabel={hero.windowLabel}
            tidePhase={null}
            verdictText={hero.verdictText}
            whenText={hero.whenText}
            explainerText={hero.explainerText}
            footnoteText={hero.footnoteText}
            reel={reel}
            onTrial={() => openTrial("hero")}
            /* Both buttons. ad_hero_map_button_v1 (concluded 2026-09-19,
               arm a) tried the trial button alone at the today wall: more
               hero presses, fewer trials (1 vs 3), and trials are the
               metric. */
            mapHref={withAdParams(`/explore?loc=${encodeURIComponent(citySlug)}`, {
              wall,
              angle,
              params: keepSlug ? { keep: keepSlug } : undefined,
            })}
            onMap={() => trackEvent("City Ad Intro Map Clicked", { city: citySlug, ad_wall: wall })}
          />
          <AdFrameProvider value={frame}>
            <AdTrialContext.Provider value={openTrial}>{children}</AdTrialContext.Provider>
          </AdFrameProvider>
        </div>
      </div>
      {ProTrialModal && (
      <ProTrialModal
        open={trialOpen}
        onOpenChange={setTrialOpen}
        feature="forecast-14d"
        from="city-ad-intro"
        placeName={cityName}
      />
      )}
    </div>
  );
}
