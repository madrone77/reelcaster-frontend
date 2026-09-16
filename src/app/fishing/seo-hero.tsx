"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import { ANON_FORECAST_DAYS } from "@/lib/forecast-horizon";
import AdHero from "./[country]/[state]/[city]/[spot]/ad-intro";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

/**
 * What Pro adds, in the column the paid hero gives to its phone reel.
 *
 * Three lines, each one a thing the reader can see is missing from the page
 * they are on right now — the forecast strip below stops at day
 * ANON_FORECAST_DAYS, the reports band is locked, and there is no alert. That
 * is the whole argument for the panel sitting here rather than on /plans:
 * it names what the evidence underneath it is already withholding.
 *
 * ⚠️ Never "unlimited alerts". The real cap is 10 (/api/alerts), and the tier
 * matrix has said so since 2026-07-22.
 */
const PRO_POINTS = [
  `All 14 days, not ${ANON_FORECAST_DAYS}`,
  "Every catch report",
  "Text alerts when it turns green",
];

function ProAside({ spotName }: { spotName: string }) {
  return (
    <aside className="rounded-xl border border-rc-line-strong bg-rc-surface/60 p-5">
      <p className="font-rc-mono text-[11px] uppercase tracking-[0.08em] text-rc-ink-mute">
        With Pro
      </p>
      <ul className="mt-3 space-y-2.5">
        {PRO_POINTS.map((point) => (
          <li key={point} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-rc-good"
              aria-hidden
            />
            <span className="text-[15px] leading-snug text-rc-ink">
              {point}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-rc-line pt-3 text-[13px] leading-relaxed text-rc-ink-mute">
        Everything above is live for {spotName}. Pro unlocks the rest.
      </p>
    </aside>
  );
}

/**
 * The landing hero at the top of a public fishing page.
 *
 * Wraps the header the page would otherwise render: pass that header as
 * children and this swaps itself in front of it, so neither caller has to
 * write its identity block twice or hoist it out of the tree.
 *
 * Same component the `?ad=` frame uses (ad-intro.tsx), with two differences
 * that matter and one that does not:
 *
 * • No reel. The four-phone carousel is a paid-click asset that loads a
 *   second spot payload to draw itself; `AdHero` already drops to a single
 *   column when `reel` is null, so this needs no layout of its own.
 * • No frame. `ad` is not set, so nothing else on the page changes: the nav,
 *   the footer, the breadcrumb, every outbound link, the locked-day rules and
 *   the metadata are the public page's own. This is additive.
 * • The map link is the product's, not `withAdParams(...)`. There is no frame
 *   to keep the reader inside.
 *
 * WHY THE SIGNED-IN CHECK IS HERE AND NOT ON THE SERVER. supabase-js keeps the
 * session in localStorage, so no request carries it and the edge cannot know
 * (this is the same constraint that made FE #559 client-side). The default is
 * therefore SHOW: the server renders the hero, and a signed-in reader swaps it
 * back for the ordinary header once auth resolves.
 *
 * That default is deliberate and load-bearing for search. The static HTML is
 * identical for a crawler and for an anonymous reader, so there is no
 * cloaking and no layout shift for either. The swap costs a member one
 * reflow on their own pages, which is the right place to spend it: a
 * subscriber must not be sold a trial they already have.
 */
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
}: {
  /** Off outside the markets in lib/seo-hero.ts, where this renders nothing
   *  of its own and the page's own header stands. */
  enabled: boolean;
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
        /* The paid hero's phone column. See the note above. */
        reel={null}
        /* ...and what stands there instead, so the column is not empty at
           desktop width. Below `lg` it stacks under the buttons. */
        aside={<ProAside spotName={spotName} />}
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
