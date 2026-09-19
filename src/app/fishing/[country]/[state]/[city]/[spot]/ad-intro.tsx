"use client";

import type { ReactNode } from "react";
import { bitingLine, type Biting } from "@/lib/lead-species";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/pricing";
import { speciesIllustration } from "@/lib/species-image";
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
 * The drawing for the fish the page is about, when there is one.
 *
 * Was eight navy engravings matched by regex against the keyword name. Now the
 * shared colour plates, found by species slug — see lib/species-image.ts. The
 * slug settles what the keyword name could not: "Halibut" is Pacific Halibut
 * here and California Halibut in San Diego, and each has its own plate instead
 * of the old table's hand-written exclusion. Coverage went from 8 fish to every
 * species we score, and a species with no plate still draws nothing rather
 * than the wrong fish.
 *
 * The plates face left, where the engravings were mirrored to face right at
 * the phone. Casey chose the drawings as they are (2026-09-15).
 */

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
  fishSlug,
  score,
  windowLabel,
  tidePhase,
  reel,
  breakAfterVerdict = false,
  biting = null,
  onTrial,
  mapHref,
  onMap,
  verdictText,
  whenText,
  explainerText,
  footnoteText,
}: {
  pills: ReactNode;
  /** The H1: "Active Pass Chinook Fishing Report", or the spot's own. */
  title: string;
  updatedLabel: string;
  spotName: string;
  /** Keyword name of the selected fish, "Chinook". */
  fish: string | null;
  /** Slug of that same fish, "chinook-salmon", which finds its drawing. */
  fishSlug: string | null;
  /** Today's best score for that fish. Only its tier is said out loud. */
  score: number | null;
  /** "7 AM-11 AM". */
  windowLabel: string | null;
  /** "Tide flooding". */
  tidePhase: string | null;
  reel: ReactNode;
  /**
   * Put the best-window sentence on its own line under the verdict.
   *
   * Opt-in rather than the default because the paid hero's wording has been
   * settled over several passes and this must not quietly re-flow it.
   */
  breakAfterVerdict?: boolean;
  /**
   * "What's biting now around Victoria: Coho", when the lead fish was picked
   * from catches rather than the fixed order. Null hides the line. See
   * lib/lead-species.ts.
   */
  biting?: Biting | null;
  onTrial: () => void;
  /** Explore, framed and opened on this spot. Null renders the trial button
   *  alone; nobody passes null today (`ad_hero_map_button_v1` tried it and
   *  the control won on trials, 2026-09-19). */
  mapHref: string | null;
  onMap?: () => void;
  /**
   * Wording overrides for a page that is not about one spot. The city ad page
   * names the mark its answer is read from ("Chinook fishing at Constance
   * Bank, the most-fished mark near Victoria, looks good today."), counts the
   * city's spots in the explainer, and sells alerts for every spot near the
   * city. Omitted, the spot page's own wording is built from `spotName`.
   */
  verdictText?: string | null;
  whenText?: string | null;
  explainerText?: string;
  footnoteText?: string;
}) {
  const plate = speciesIllustration(fishSlug);
  const tier = tierFor(score);
  // Roster names are stored as written by whoever added the fish, and a few
  // are lower case ("bluefin tuna"); this one starts a sentence.
  const fishName = fish ? fish.charAt(0).toUpperCase() + fish.slice(1) : null;
  const subject = `${fishName ?? "Fishing"}${fishName ? " fishing" : ""} at ${spotName}`;
  const verdict =
    verdictText !== undefined
      ? verdictText
      : tier === "none"
        ? null
        : `${subject} ${VERDICT[tier]}.`;
  const when = whenText !== undefined
    ? whenText
    : windowLabel
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
        {biting && (
          <p
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-rc-good-bg px-3 py-1.5 text-[14px] font-semibold text-rc-good-ink lg:text-[15px]"
            data-testid="ad-hero-biting"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-rc-good" aria-hidden />
            {bitingLine(biting)}
          </p>
        )}

        {(verdict || when) && (
          <p className="mt-5 text-pretty text-[20px] leading-snug text-rc-ink lg:text-[24px]">
            {verdict && (
              <strong className={`font-bold ${tier === "good" ? "text-rc-good" : "text-rc-ink"}`}>
                {verdict}
              </strong>
            )}
            {/* A hard break rather than a second <p>: the two sentences are one
                thought and share the paragraph's leading, so a paragraph gap
                here would read as a change of subject. */}
            {breakAfterVerdict && verdict && when ? <br /> : " "}
            {when}
          </p>
        )}
        <p className="mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-rc-ink-soft lg:text-[17px]">
          {explainerText ??
            `ReelCaster scores every hour at ${spotName} from 0 to 100, reading the tide, current, wind and weather${
              fish ? ` for ${fish}` : ""
            }. The higher the score, the better your odds. Green means go.`}
        </p>
        {/* The picture and the two asks sit centred under the copy, on the
            paragraph's own measure, so they read as one block. */}
        <div className="flex max-w-xl flex-col items-center text-center">
          {plate && (
            <Image
              src={plate.src}
              width={plate.width}
              height={plate.height}
              alt={fishName ?? ""}
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
            {mapHref && (
              <Link
                href={mapHref}
                onClick={onMap}
                className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-rc-brand bg-white px-4 py-3.5 text-[16px] font-semibold text-rc-brand transition-colors hover:bg-rc-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand sm:flex-none sm:px-7 sm:text-[17px]"
              >
                Explore the map
              </Link>
            )}
          </div>
          <p className="mt-3 text-[13px] text-rc-ink-mute">
            {footnoteText ??
              `Pro is free for ${TRIAL_DAYS} days: all 14 days, full catch reports and text alerts for ${spotName}.`}
          </p>
        </div>
      </div>

      {reel}
    </div>
  );
}
