"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/pricing";
import { tierFor } from "@/app/explore/lib/explore-data";

/**
 * The top of the spot page on the ad frame: the search, answered, beside the
 * product running on that spot.
 *
 * Replaces the plain identity header only under `?ad=`. A paid click arrives
 * having typed something like "active pass chinook", so the headline is that
 * search (the page's H1, already worded from `&species=` / `&topic=`), and the
 * first sentence under it answers it in words rather than numbers. A bare
 * "83" means nothing to someone who has never seen the product; "looks good
 * today, best from 7 AM to 11 AM" does. The next sentence then says what the
 * numbers they are about to see are, before the phone shows them.
 *
 * The reel is rendered on the server (ad/ad-reel.tsx) and handed in, so the
 * product/public page never pays for it.
 */

/**
 * The engraving for the fish the page is about, when there is one.
 *
 * Cut from two generated navy plates (ink only, transparent ground, so it
 * sits on any panel), one per fish BC pages carry. Two of the plate's labels
 * are wrong and were ignored: its "Dungeness Crab" panel is the black rockfish
 * again, and its "Spot Prawn & Sablefish" panel holds the crab, the prawn,
 * the sablefish and an unlabelled salmon that is not used. Every fish (and the
 * prawn) is mirrored where needed so its head points right, toward the phone
 * beside the copy; the crab faces the reader. Matched loosely on
 * the species name so "Chinook Salmon", "King" and "Spring" all find the same
 * fish. Anything else (sockeye, tuna, California halibut) draws no picture
 * rather than the wrong one.
 */
const ENGRAVINGS: Array<{ match: RegExp; src: string; w: number; h: number; alt: string }> = [
  { match: /chinook|king|spring|tyee/i, src: "/marketing/species/chinook-engraving-navy-v2.webp", w: 1100, h: 471, alt: "Chinook salmon" },
  { match: /coho|silver/i, src: "/marketing/species/coho-engraving-navy-v2.webp", w: 843, h: 349, alt: "Coho salmon" },
  // "Halibut" alone: California Halibut is a different fish and draws nothing.
  { match: /^halibut$/i, src: "/marketing/species/halibut-engraving-navy-v2.webp", w: 844, h: 465, alt: "Pacific halibut" },
  { match: /lingcod/i, src: "/marketing/species/lingcod-engraving-navy-v2.webp", w: 849, h: 306, alt: "Lingcod" },
  { match: /rockfish/i, src: "/marketing/species/rockfish-engraving-navy-v2.webp", w: 954, h: 503, alt: "Rockfish" },
  { match: /crab/i, src: "/marketing/species/crab-engraving-navy-v2.webp", w: 602, h: 288, alt: "Dungeness crab" },
  { match: /prawn|shrimp/i, src: "/marketing/species/prawn-engraving-navy-v2.webp", w: 602, h: 253, alt: "Spot prawn" },
  { match: /sablefish|black ?cod/i, src: "/marketing/species/sablefish-engraving-navy-v2.webp", w: 689, h: 250, alt: "Sablefish" },
];

/**
 * The phone column's width on desktop. Exported because the top bar centres
 * its Try Pro free button over this same column (ExploreTopBar ctaOverColumn).
 * The grid class below spells it as a literal: Tailwind cannot see a class
 * built from a template.
 */
export const AD_HERO_REEL_COL = 380;

const VERDICT = {
  good: "looks good today",
  fair: "is fair today",
  poor: "is slow today",
} as const;

export default function AdHero({
  pills,
  title,
  updatedLabel,
  spotName,
  fish,
  score,
  windowLabel,
  tidePhase,
  reel,
  onTrial,
  mapHref,
  onMap,
}: {
  pills: ReactNode;
  /** The H1: "Active Pass Chinook Fishing Report", or the spot's own. */
  title: string;
  updatedLabel: string;
  spotName: string;
  /** Keyword name of the selected fish, "Chinook". */
  fish: string | null;
  /** Today's best score for that fish. Only its tier is said out loud. */
  score: number | null;
  /** "7 AM-11 AM". */
  windowLabel: string | null;
  /** "Tide flooding". */
  tidePhase: string | null;
  reel: ReactNode;
  onTrial: () => void;
  /** Explore, framed and opened on this spot. */
  mapHref: string;
  onMap: () => void;
}) {
  const engraving = fish ? ENGRAVINGS.find((e) => e.match.test(fish)) : undefined;
  const tier = tierFor(score);
  // Roster names are stored as written by whoever added the fish, and a few
  // are lower case ("bluefin tuna"); this one starts a sentence.
  const fishName = fish ? fish.charAt(0).toUpperCase() + fish.slice(1) : null;
  const subject = `${fishName ?? "Fishing"}${fishName ? " fishing" : ""} at ${spotName}`;
  const verdict = tier === "none" ? null : `${subject} ${VERDICT[tier]}.`;
  const when = windowLabel
    ? `The best time to go is ${windowLabel.replace("-", " to ")}${
        tidePhase ? `, with the ${tidePhase.toLowerCase()}` : ""
      }.`
    : null;

  return (
    <div
      className={`grid gap-8 ${reel ? "lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-12" : ""}`}
      data-testid="ad-hero"
    >
      <div>
        {pills}
        <h1 className="mt-4 text-balance text-[34px] font-black leading-[1.05] tracking-[-0.02em] text-rc-ink lg:text-[52px]">
          {title}
        </h1>
        <p className="mt-2 font-rc-mono text-xs text-rc-ink-mute">{updatedLabel}</p>

        {(verdict || when) && (
          <p className="mt-5 text-pretty text-[20px] leading-snug text-rc-ink lg:text-[24px]">
            {verdict && (
              <strong className={`font-bold ${tier === "good" ? "text-rc-good" : "text-rc-ink"}`}>
                {verdict}
              </strong>
            )}{" "}
            {when}
          </p>
        )}
        <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-rc-ink-soft lg:text-[17px]">
          ReelCaster scores every hour at {spotName} from 0 to 100, reading the tide, current, wind
          and weather{fish ? ` for ${fish}` : ""}. The higher the score, the better your odds. Green
          means go.
        </p>
        {/* The picture and the two asks sit centred under the copy, on the
            paragraph's own measure, so they read as one block. */}
        <div className="flex max-w-xl flex-col items-center text-center">
          {engraving && (
            <Image
              src={engraving.src}
              width={engraving.w}
              height={engraving.h}
              alt={engraving.alt}
              sizes="(min-width: 1024px) 400px, 72vw"
              className="mt-5 h-auto w-[72%] max-w-[400px] select-none"
              data-testid="ad-hero-fish"
            />
          )}

          {/* Two asks, side by side: the trial first and filled, the map
              beside it outlined. The map link carries `?ad=`, so it stays
              inside the frame like "Back to map" does. */}
          <div className="mt-7 flex w-full justify-center gap-3">
            <button
              type="button"
              onClick={onTrial}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-rc-brand bg-rc-brand px-4 py-3.5 text-[16px] font-semibold text-white shadow-sm transition-colors hover:border-rc-brand-hover hover:bg-rc-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand sm:flex-none sm:px-7 sm:text-[17px]"
            >
              Try Pro free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <Link
              href={mapHref}
              onClick={onMap}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-rc-brand bg-white px-4 py-3.5 text-[16px] font-semibold text-rc-brand transition-colors hover:bg-rc-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand sm:flex-none sm:px-7 sm:text-[17px]"
            >
              Explore the map
            </Link>
          </div>
          <p className="mt-3 text-[13px] text-rc-ink-mute">
            Pro is free for {TRIAL_DAYS} days: all 14 days, full catch reports and text alerts for {spotName}.
          </p>
        </div>
      </div>

      {reel}
    </div>
  );
}
