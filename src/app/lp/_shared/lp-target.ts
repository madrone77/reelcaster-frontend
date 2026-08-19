/**
 * Species-and-city copy for /lp/4.
 *
 * /lp/2 and /lp/3 sell the product to a city. /lp/4 sells one species in one
 * city, because that is how the ads are bought: an ad set for chinook out of
 * Victoria should not land on a page that could have been written for anyone.
 *
 * Every angle keeps its own pitch, so the angle test still runs inside this
 * variant. Only the words that can carry a species or a city change, and the
 * feature stack, the CTA, and the body are untouched.
 *
 * Species names read as proper nouns in a headline and as plain nouns in a
 * sentence, so the templates use `Species` in the first position and `species`
 * in the second. Getting that backwards is what makes generated copy read as
 * generated.
 *
 * If the requested species does not resolve, or resolves to something this
 * city cannot score, the page never gets here: it renders the untargeted
 * angle, and the only species it names is the one on the card.
 */

import type { Angle } from "./lp-angles";

export interface LpTargeting {
  /** Display species, e.g. "Chinook Salmon". */
  species: string;
  /** Display city, e.g. "Victoria". */
  city: string;
}

/** The fields an angle is allowed to rewrite when it is targeted. */
type TargetedCopy = Pick<Angle, "eyebrow" | "headline" | "subhead" | "closer" | "title">;

const TARGETED: Record<string, (t: LpTargeting & { lower: string }) => TargetedCopy> = {
  window: ({ species, city, lower }) => ({
    eyebrow: `${species} · ${city}`,
    headline: { lead: `${species} in ${city}.`, accent: "Know the exact hours." },
    subhead: `Tides, current, wind, and pressure, combined into one 0–100 score for every ${lower} spot around ${city}, updated through the day.`,
    closer: `The next ${lower} window in ${city} is coming. Know when.`,
    title: `${species} in ${city}: know the exact hours`,
  }),
  wasted: ({ species, city, lower }) => ({
    eyebrow: `${species} · ${city}`,
    headline: { lead: "Stop burning Saturdays", accent: `on a dead ${city} tide.` },
    subhead: `Most ${lower} trips fail before the boat leaves the ramp. One score tells you whether today is worth the fuel, and which day this week actually is.`,
    closer: "Your next day off is too expensive to guess with.",
    title: `Stop burning Saturdays on a dead ${city} tide`,
  }),
  local: ({ species, city, lower }) => ({
    eyebrow: `${species} · ${city}`,
    headline: { lead: `Twenty years of ${city} knowledge,`, accent: "on your phone." },
    subhead: `The people who limit out on ${lower} are reading tide, current, and season. ReelCaster reads all of it for every spot around ${city}, every hour.`,
    closer: `Fish ${city} like you have been here thirty years.`,
    title: `Twenty years of ${city} knowledge, on your phone`,
  }),
  alerts: ({ species, city, lower }) => ({
    eyebrow: `${species} · ${city}`,
    headline: { lead: "Get a text", accent: `when the ${lower} bite turns on.` },
    subhead: `Set your ${city} spot and your threshold. We watch tide, weather, and water around the clock and message you when your window opens.`,
    closer: `${city} will turn on this week. Be the one who knows.`,
    title: `Get a text when the ${lower} bite turns on`,
  }),
};

/**
 * Rewrite an angle for a species and a city.
 *
 * A null targeting returns the angle untouched, which is the fallback path and
 * has to stay a no-op: /lp/4 with nothing to target is /lp/2 with a different
 * attribution tag, and that is a fair thing to serve.
 *
 * An angle with no template gets the eyebrow and nothing else. A new angle
 * should ship with a template, and until it does it is better for the page to
 * be quietly generic than for it to claim something nobody wrote.
 */
export function targetAngle(angle: Angle, targeting: LpTargeting | null): Angle {
  if (!targeting) return angle;
  const lower = targeting.species.toLowerCase();
  const build = TARGETED[angle.id];
  if (!build) return { ...angle, eyebrow: `${targeting.species} · ${targeting.city}` };
  return { ...angle, ...build({ ...targeting, lower }) };
}

/** The line under the subhead, which names the species as well as the city. */
export function targetedLocality(targeting: LpTargeting): string {
  return `Every ${targeting.species.toLowerCase()} spot around ${targeting.city}, scored hour by hour.`;
}
