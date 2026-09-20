/**
 * `&topic=` on an ad URL: what the search keyword asked about.
 *
 * "active pass tides" and "active pass fishing report" land on the same spot
 * page, but a searcher who typed "tides" wants the tide before anything else.
 * The topic sets the title, puts a short answer to that question at the top,
 * and words the chart explainer around it. Combines with `&species=`.
 *
 * Typed by hand into an ad platform, so it takes the keyword's own word
 * ("tide", "current", "wind", "bite", "spots"). Anything else is no topic.
 */
export type LandingTopic = "tides" | "currents" | "weather" | "report" | "forecast" | "map";

const ALIASES: Record<string, LandingTopic> = {
  tide: "tides",
  tides: "tides",
  current: "currents",
  currents: "currents",
  wind: "weather",
  winds: "weather",
  weather: "weather",
  report: "report",
  reports: "report",
  "fishing-report": "report",
  bite: "report",
  forecast: "forecast",
  conditions: "forecast",
  map: "map",
  spots: "map",
};

export function parseTopic(raw: string | null | undefined): LandingTopic | null {
  const v = (raw ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  return ALIASES[v] ?? null;
}

/** The h1 and <title> for an ad landing. `fish` is the keyword name ("Chinook"). */
export function landingTitle(spot: string, fish: string | null, topic: LandingTopic | null): string {
  const forFishing = fish ? `for ${fish} Fishing` : "for Fishing";
  switch (topic) {
    case "tides":
      return `${spot} Tides ${forFishing}`;
    case "currents":
      return `${spot} Currents ${forFishing}`;
    case "weather":
      return `${spot} Wind & Weather ${forFishing}`;
    case "forecast":
      return `${spot}${fish ? ` ${fish}` : ""} Fishing Forecast`;
    case "map":
      return `${spot}${fish ? ` ${fish}` : ""} Fishing Map`;
    case "report":
    default:
      return `${spot}${fish ? ` ${fish}` : ""} Fishing Report`;
  }
}

/** Three short lines for the card over the 24-hour chart. */
export function chartExplainerLines(fish: string, topic: LandingTopic | null): string[] {
  switch (topic) {
    case "tides":
      return ["Blue line = tide height.", "H and L = high and low tide.", `Tap any hour to see the ${fish} score.`];
    case "currents":
      return ["Above the middle line = flood.", "Below = ebb. SLACK = the turn.", `Tap any hour to see the ${fish} score.`];
    case "weather":
      return ["Bars = wind. Ticks = gusts.", "Sea state = how rough it is.", `Tap any hour to see the ${fish} score.`];
    default:
      return [`Green = good ${fish} fishing.`, "Red = slow.", "Tap any hour to see conditions."];
  }
}
