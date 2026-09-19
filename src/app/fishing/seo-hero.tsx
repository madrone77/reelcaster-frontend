"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import AdHero from "./[country]/[state]/[city]/[spot]/ad-intro";
import type { Biting } from "@/lib/lead-species";

/**
 * True inside the header copy that SeoHero keeps in the markup while the
 * session is still loading. That copy is hidden by CSS but it is real DOM,
 * and the hero beside it already carries the page's <h1>; a second one there
 * gave every hero-bearing city and spot page two h1s. The header renders its
 * title through PageHeading, which demotes to a <p> under this flag and is
 * an <h1> everywhere else (no hero, or a signed-in reader once the session
 * resolves and the hero leaves).
 */
const HeroHeaderSlotContext = createContext(false);

export function PageHeading({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const inSlot = useContext(HeroHeaderSlotContext);
  return inSlot ? (
    <p className={className}>{children}</p>
  ) : (
    <h1 className={className}>{children}</h1>
  );
}

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

export default function SeoHero({
  enabled,
  children,
  pills,
  title,
  spotName,
  fish,
  fishSlug,
  score,
  windowLabel,
  tidePhase,
  mapHref,
  place,
  reel = null,
  biting = null,
}: {
  /** Off outside the markets in lib/seo-hero.ts, where this renders nothing
   *  of its own and the page's own header stands. */
  enabled: boolean;
  /**
   * The four-phone reel, rendered on the server by ad/ad-reel.tsx and handed
   * in — the same one the paid hero carries, pointed at this page's mark.
   *
   * Null is a single-column hero. AdHero already handles that, so a market
   * without one, or a spot whose payload is too thin for two slides, simply
   * reads narrower.
   */
  reel?: ReactNode;
  /** That header — also what a signed-in reader gets back. */
  children: ReactNode;
  pills: ReactNode;
  title: string;
  spotName: string;
  fish: string | null;
  fishSlug: string | null;
  score: number | null;
  windowLabel: string | null;
  tidePhase: string | null;
  mapHref: string;
  /** Slug reported with the events, so spot and city read apart. */
  place: string;
  /** The "What's biting now" line, when the lead fish came from catches. */
  biting?: Biting | null;
}) {
  const { user, loading } = useAuth();
  const [trialOpen, setTrialOpen] = useState(false);

  // Only a RESOLVED session removes it. While `loading` is true — which is the
  // server render and the first paint — both versions are in the markup, so
  // the crawler and every reader get the same bytes, and CSS picks one off the
  // `data-rc-session` hint the root layout stamps before paint (globals.css).
  // Without that, a signed-in reader saw the hero flash and then vanish.
  if (!enabled || (!loading && user)) return <>{children}</>;

  return (
    <>
      {loading && (
        <div data-seo-hero-slot="header">
          <HeroHeaderSlotContext.Provider value={true}>
            {children}
          </HeroHeaderSlotContext.Provider>
        </div>
      )}
      <div data-seo-hero-slot={loading ? "hero-pending" : "hero"}>
      <AdHero
        pills={pills}
        title={title}
        updatedLabel="Updated today"
        spotName={spotName}
        fish={fish}
        fishSlug={fishSlug}
        score={score}
        windowLabel={windowLabel}
        tidePhase={tidePhase}
        reel={reel}
        biting={biting}
        breakAfterVerdict
        onTrial={() => {
          trackEvent("Seo Hero Trial Clicked", { place });
          setTrialOpen(true);
        }}
        mapHref={mapHref}
        onMap={() => trackEvent("Seo Hero Map Clicked", { place })}
      />
      </div>
      <ProTrialModal
        open={trialOpen}
        onOpenChange={setTrialOpen}
        feature="forecast-14d"
        from="seo-hero"
        spotName={spotName}
      />
    </>
  );
}
