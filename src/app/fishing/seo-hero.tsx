"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import AdHero from "./[country]/[state]/[city]/[spot]/ad-intro";

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
}) {
  const { user, loading } = useAuth();
  const [trialOpen, setTrialOpen] = useState(false);

  // Only a RESOLVED session hides it. While `loading` is true — which is the
  // server render and the first paint — the hero shows, so the crawler and
  // the anonymous reader get the same bytes.
  if (!enabled || (!loading && user)) return <>{children}</>;

  return (
    <>
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
        breakAfterVerdict
        onTrial={() => {
          trackEvent("Seo Hero Trial Clicked", { place });
          setTrialOpen(true);
        }}
        mapHref={mapHref}
        onMap={() => trackEvent("Seo Hero Map Clicked", { place })}
      />
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
