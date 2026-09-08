/**
 * What the small wall on /explore says, per thing the reader reached for.
 *
 * The full <ProTrialModal> answers every wall with the same screen: a
 * headline about Pro, a fourteen-row plan matrix and a card form. That is
 * the right answer to "start free trial" and the wrong one to "I tapped a
 * star". This table is the other answer — one line naming what they reached
 * for, one line saying honestly what an account does about it.
 *
 * TWO RULES, and they are the whole reason this is a table rather than a
 * template:
 *
 * 1. THE TITLE IS THEIR ACTION, not our offer. It finishes the sentence the
 *    tap started: they pressed the star, so the modal says "Save this spot",
 *    not "Go Pro". A wall that renames what you were doing reads as a
 *    different thing being sold to you, which is what the big modal already
 *    does and what this exists to stop.
 *
 * 2. THE BODY NEVER OVERSELLS. Most of these walls are Pro-only, and an
 *    account does NOT open them. So the body says what the account really
 *    does — keeps your spots, opens the week, gets one email alert — and
 *    then names Pro for the part an account does not reach. A gate that
 *    promises the blocked thing unlocks is worse than one that asks twice:
 *    the next screen disproves it. The depth gate on this same surface has
 *    the same rule written on it for the same reason.
 *
 * The offer of Pro is still here, at the foot of the modal, as one quiet
 * line that opens the full modal. This does not replace that pitch; it stops
 * the pitch being the first thing every tap gets.
 *
 * Limits come from the plan matrix, never typed in — the horizon and the
 * saved-spot cap both move, and a number written into a sentence here is a
 * number that goes stale silently.
 */

import { FREE_FORECAST_DAYS } from "@/lib/forecast-horizon";
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

export interface JoinPrompt {
  /** Finishes the tap. Sentence case, no period. */
  title: string;
  /** One line. What an account really does here, and where Pro starts. */
  body: string;
}

/**
 * Every wall /explore can raise. Keyed loosely rather than as a total
 * Record<JoinPromptKey, …> because the walls off this surface — support,
 * remove-ads, the retired whole-map ask — have no prompt here and should not
 * be given invented copy to satisfy a type. `joinPromptFor` falls back.
 */
const PROMPTS: Partial<Record<JoinPromptKey, JoinPrompt>> = {
  // The ad frame's third spot open. They are browsing the map, so the offer
  // is more map. Nothing about Pro: this wall stands between a visitor and
  // the thing the ad promised, and the cheapest way past it really is an
  // account.
  "spot-views": {
    title: "See more spots",
    body: "Join now to keep opening spots on the map. It is free and takes a moment.",
  },
  // Days 3 to 7. The one wall on this list an account genuinely opens, so
  // the body is a flat promise with no Pro clause after it.
  "forecast-week": {
    title: "See the week ahead",
    body: `A free account opens the next ${FREE_FORECAST_DAYS} days at every spot.`,
  },
  // Days 8 to 14. An account gets them most of the way there and no further,
  // and the sentence says so in that order: what they get, then where it
  // stops.
  "forecast-14d": {
    title: "See further ahead",
    body: `A free account opens the next ${FREE_FORECAST_DAYS} days. The full two weeks comes with Pro.`,
  },
  "favorite-spots": {
    title: "Save this spot",
    body: "A free account keeps a spot waiting for you. Pro saves as many as you like.",
  },
  "catch-reports": {
    title: "See what anglers are catching",
    body: "Join now to keep your spots and the week ahead. Catch reports come with Pro.",
  },
  // Only ever raised for a signed-in free angler who has used their alert
  // (see create-alert-dialog), so the body speaks to someone who already has
  // the account. The modal drops the join buttons for that reader anyway.
  alerts: {
    title: "Get an alert on this spot",
    body: "A free account keeps one email alert. Pro alerts every spot you fish, by email or text.",
  },
  "sms-alerts": {
    title: "Get alerts by text",
    body: "A free account keeps one email alert. Text alerts come with Pro.",
  },
  "custom-spots": {
    title: "Add your own spot",
    body: "Join now to keep your spots and the week ahead. Scoring a spot of your own comes with Pro.",
  },
  "catch-log": {
    title: "Log this catch",
    body: "A free account keeps your catch log, photos and all.",
  },
};

/**
 * The fallback is deliberately the vaguest true thing rather than a guess at
 * what was blocked. A wall with no entry above is a wall this table has not
 * been taught, and naming the wrong feature is worse than naming none.
 */
const FALLBACK: JoinPrompt = {
  title: "Join ReelCaster",
  body: "A free account keeps your spots and opens the week ahead.",
};

export function joinPromptFor(key: JoinPromptKey): JoinPrompt {
  return PROMPTS[key] ?? FALLBACK;
}
