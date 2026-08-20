// Naming the activity in page copy.
//
// BlueCaster decides the verb (crab is "crabbing", prawn is "prawning",
// everything else is "fishing") and hands back the species name with the gear
// noun already removed. These helpers are the presentation half: they only
// decide capitalisation and word order, so the taxonomy rule lives in one
// place upstream rather than being re-derived per surface.

import type { BlueCasterActivity } from "@/lib/bluecaster";

/** Headline form: "Chinook Salmon Fishing", "Dungeness Crabbing", "Prawning". */
export function activityTitle(activity: BlueCasterActivity): string {
  const verb = activity.verb.charAt(0).toUpperCase() + activity.verb.slice(1);
  return activity.subject ? `${activity.subject} ${verb}` : verb;
}

/** Inline form for links and lists: "Chinook Salmon fishing", "Dungeness crabbing". */
export function activityPhrase(activity: BlueCasterActivity): string {
  if (!activity.subject) {
    return activity.verb.charAt(0).toUpperCase() + activity.verb.slice(1);
  }
  return `${activity.subject} ${activity.verb}`;
}

/**
 * "How anglers fish it around Victoria" only works for finfish. Crab and
 * prawn are trap fisheries and the reader is not an angler at that moment.
 */
export function howHeading(activity: BlueCasterActivity, cityName: string): string {
  switch (activity.verb) {
    case "crabbing":
      return `How to crab around ${cityName}`;
    case "prawning":
      return `How to prawn around ${cityName}`;
    default:
      return `How anglers fish it around ${cityName}`;
  }
}

/** "Where to fish for chinook salmon" / "Where to crab" / "Where to prawn". */
export function whereHeading(
  activity: BlueCasterActivity,
  speciesName: string,
): string {
  switch (activity.verb) {
    case "crabbing":
      return "Where to crab";
    case "prawning":
      return "Where to prawn";
    default:
      return `Where to fish for ${speciesName.toLowerCase()}`;
  }
}
