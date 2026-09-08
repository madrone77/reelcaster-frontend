/**
 * What the small wall on /explore says, per thing the reader reached for.
 *
 * A TITLE AND NOTHING ELSE. No body line, no tier, no price, no mention of a
 * free account, of Pro, or of a trial — Casey's call (2026-09-08). The modal
 * this feeds is two buttons under one line: Join now, Sign in. What the plans
 * are and what they cost is the NEXT screen's job
 * (components/paywall/plan-choice-modal), and asking that question one screen
 * early is what made the old wall feel like a checkout you did not open.
 *
 * THE TITLE IS THEIR ACTION, not our offer. It finishes the sentence the tap
 * started: they pressed the star, so the modal says "Save this spot", not "Go
 * Pro". A wall that renames what you were doing reads as a different thing
 * being sold to you, which is exactly what the full modal did and what this
 * exists to stop.
 *
 * There is consequently nothing here that can go stale against a limit or a
 * price, which is the other half of why the body line left: it had to name
 * the forecast horizon and the saved-spot cap to be honest, and a sentence
 * carrying a number is a sentence that quietly rots.
 */

import type { NagFeatureId } from "@/lib/plan-features";

/**
 * Which prompt to show.
 *
 * Mostly the feature id the wall already reports under, so the copy and the
 * counter agree on what was hit. `spot-views` is the exception: the ad
 * frame's third-spot-open wall reports as `forecast-14d` (the thing it sells)
 * but the reader was opening spots, not reading a fortnight, so it needs a
 * title of its own. The reporting id is untouched; only the words differ.
 */
export type JoinPromptKey = NagFeatureId | "spot-views";

/**
 * Every wall /explore can raise. Keyed loosely rather than as a total
 * Record<JoinPromptKey, …> because the walls off this surface — support,
 * remove-ads, the retired whole-map ask — have no prompt here and should not
 * be given invented copy to satisfy a type. `joinPromptFor` falls back.
 */
const TITLES: Partial<Record<JoinPromptKey, string>> = {
  /** The ad frame's third spot open. They are browsing, so: more browsing. */
  "spot-views": "See more spots",
  /** Days 3 to 7. */
  "forecast-week": "See the week ahead",
  /** Days 8 to 14. Same reach, further out; the tiles do not read as two
   *  different products and the title should not either. */
  "forecast-14d": "See further ahead",
  "favorite-spots": "Save this spot",
  "catch-reports": "See what anglers are catching",
  alerts: "Get an alert on this spot",
  "sms-alerts": "Get alerts by text",
  "custom-spots": "Add your own spot",
  "catch-log": "Log this catch",
};

/**
 * The fallback is deliberately the vaguest true thing rather than a guess at
 * what was blocked. A wall with no entry above is a wall this table has not
 * been taught, and naming the wrong feature is worse than naming none.
 */
const FALLBACK = "Join ReelCaster";

export function joinPromptFor(key: JoinPromptKey): string {
  return TITLES[key] ?? FALLBACK;
}
