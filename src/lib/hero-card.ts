/**
 * The homepage hero's score card, as data.
 *
 * The card ships with a hardcoded Constance Bank demo in the static HTML (see
 * the note in src/app/(marketing)/components/hero-score-card.tsx) and swaps to
 * the visitor's own water after hydration. This module is the contract between
 * the route that resolves that water and the component that draws it.
 *
 * It is a NARROWING of `LpCard`, not a second builder. The landing pages
 * already solved this exact problem — "a Seattle ad landing on a Victoria spot
 * is worse than no card at all" — and solved it with a ranking rule worth
 * inheriting: target species first, then the busiest mark, then the
 * best-scoring one. A homepage that picked its representative spot differently
 * would be a second answer to a question already answered, and the two would
 * drift the first time either was tuned.
 *
 * What is dropped in the narrowing is everything the hero does not draw
 * (`provinceCode`, `windowNote`, `species` on its own). What is added is
 * nothing: every field below comes straight off the LpCard.
 */

import type { Tier } from "@/app/explore/lib/explore-data";
import type { LpCard } from "@/app/lp/_shared/lp-spot";

export interface HeroCard {
  /** The mono chip over the spot name, e.g. "CHINOOK · SEATTLE". The city is
   *  in it on purpose: the whole point of the swap is that a visitor sees
   *  their own water named. */
  eyebrow: string;
  spotName: string;
  /** 0–100. */
  score: number;
  tier: Tier;
  /** "GOOD" · "FAIR" · "POOR", or "" when the day has no usable score. */
  tagWord: string;
  /** 24 bar heights, 0–100, midnight → midnight. */
  hours: number[];
  /** Inclusive bar indices to paint as the best window. -1/-2 = none. */
  bestFrom: number;
  bestTo: number;
  /** "5 PM-8 PM", or null when the day has no usable peak. */
  windowTime: string | null;
  /** "Late flood", or null. Never a generic stand-in. */
  tidePhase: string | null;
  freshCatches: number;
  freshWindowDays: number;
}

export interface HeroCardPayload {
  located: boolean;
  card?: HeroCard;
}

/** Not-located is one shape, built in one place, so callers can't diverge. */
export const NOT_LOCATED: HeroCardPayload = { located: false };

export function heroCardFromLp(card: LpCard): HeroCard {
  return {
    eyebrow: card.meta,
    spotName: card.spotName,
    score: card.score,
    tier: card.tier,
    tagWord: card.tagWord,
    hours: card.hours,
    bestFrom: card.bestFrom,
    bestTo: card.bestTo,
    windowTime: card.windowTime,
    tidePhase: card.tidePhase,
    freshCatches: card.freshCatches,
    freshWindowDays: card.freshWindowDays,
  };
}
