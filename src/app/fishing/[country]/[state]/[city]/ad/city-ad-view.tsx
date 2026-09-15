"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { AdFrameProvider } from "@/app/explore/lib/ad-frame";
import { PAGE_MEASURE } from "@/app/components/layout/page-measure";
import { useSubscription } from "@/hooks/use-subscription";
import { trackEvent } from "@/lib/analytics";
import { withAdParams, type AdWall } from "@/lib/ad-mode";
import AdHero, { AD_HERO_REEL_COL } from "../[spot]/ad-intro";

const ProTrialModal = dynamic(() => import("@/app/components/paywall/pro-trial-modal"), {
  ssr: false,
});

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
  speciesParam,
  hero,
  reel,
  children,
}: {
  citySlug: string;
  cityName: string;
  wall: AdWall;
  angle: string;
  /** The keyword's species slug, carried onto every framed spot link. */
  speciesParam: string | null;
  hero: {
    pills: ReactNode;
    title: string;
    spotName: string;
    fish: string | null;
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
            score={hero.score}
            windowLabel={hero.windowLabel}
            tidePhase={null}
            verdictText={hero.verdictText}
            whenText={hero.whenText}
            explainerText={hero.explainerText}
            footnoteText={hero.footnoteText}
            reel={reel}
            onTrial={() => {
              trackEvent("City Ad Intro Trial Clicked", { city: citySlug, ad_wall: wall });
              setTrialOpen(true);
            }}
            mapHref={withAdParams(`/explore?loc=${encodeURIComponent(citySlug)}`, { wall, angle })}
            onMap={() => trackEvent("City Ad Intro Map Clicked", { city: citySlug, ad_wall: wall })}
          />
          <AdFrameProvider value={frame}>{children}</AdFrameProvider>
        </div>
      </div>
      <ProTrialModal
        open={trialOpen}
        onOpenChange={setTrialOpen}
        feature="forecast-14d"
        from="city-ad-intro"
        placeName={cityName}
      />
    </div>
  );
}
