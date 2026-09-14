import type { LiveRegulation, RegStatus } from "@/lib/bluecaster/live-spot-types";
import type { Regulator } from "@/lib/regions";

/**
 * A regulation row nobody has read yet.
 *
 * When BlueCaster finds no rule for a species in a spot's area it writes a
 * placeholder that keeps `status: "Closed"`, so nothing scores it as open.
 * That is the safe answer for scoring and the wrong one for a reader: "Closed"
 * is a legal claim no regulator made. Since bluecaster #442 the payload flags
 * those rows with `rulesNotLoaded` and names the regulator to check, and every
 * surface that prints a rule reads the flag through here before it reads
 * `status`.
 *
 * Only an explicit `true` counts. An older payload has no flag at all, and it
 * must render exactly as it did: a real closure stays "Closed".
 */
export function isRulesNotLoaded(
  r: Pick<LiveRegulation, "rulesNotLoaded"> | null | undefined,
): boolean {
  return r?.rulesNotLoaded === true;
}

export const RULES_NOT_LOADED_LABEL = "Rules not loaded yet";

/** Neutral chrome for the unknown state. Never the closed red: nothing is
 *  known to be shut. Written out whole so Tailwind sees every class. */
export const RULES_NOT_LOADED_PILL = "bg-rc-surface text-rc-ink-soft";
export const RULES_NOT_LOADED_TEXT = "text-rc-ink-soft";

/** The kind of state a row is in, for picking words and colours. */
export type RegDisplayKind = "open" | "release" | "closed" | "unknown";

export function regDisplayKind(
  r: Pick<LiveRegulation, "status" | "rulesNotLoaded">,
): RegDisplayKind {
  if (isRulesNotLoaded(r)) return "unknown";
  const byStatus: Record<RegStatus, RegDisplayKind> = {
    Open: "open",
    Release: "release",
    Closed: "closed",
  };
  // An unmapped status falls to "open", which is what every surface did with
  // one before: no closure word, no closure colour.
  return byStatus[r.status] ?? "open";
}

// Hosts of the four regulators' own sites, so a link the payload hands us is
// named for the agency it actually points at. A spot's city can sit across a
// border from its water, and the payload's URL is the better evidence.
const REGULATOR_NAME_BY_HOST: Array<[RegExp, string]> = [
  [/(^|\.)wildlife\.ca\.gov$/i, "CDFW"],
  [/(^|\.)dfg\.ca\.gov$/i, "CDFW"],
  [/(^|\.)myodfw\.com$/i, "ODFW"],
  [/(^|\.)dfw\.state\.or\.us$/i, "ODFW"],
  [/(^|\.)wdfw\.wa\.gov$/i, "WDFW"],
  [/(^|\.)dfo-mpo\.gc\.ca$/i, "DFO"],
];

function nameForUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return REGULATOR_NAME_BY_HOST.find(([re]) => re.test(host))?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * "Check CDFW" and where it goes. The payload's `regulatorUrl` wins; a row
 * without one falls back to the regulator the page already resolved for the
 * spot (see `regulatorFrom` / `regulatorFor`).
 */
export function regulatorCheckLink(
  r: Pick<LiveRegulation, "regulatorUrl">,
  fallback: Regulator,
): { label: string; url: string } {
  const url = r.regulatorUrl?.trim() || fallback.url;
  const name = (r.regulatorUrl && nameForUrl(r.regulatorUrl)) || fallback.name;
  return { label: `Check ${name}`, url };
}

/**
 * The word a species card shows in place of its score, or null when retention
 * is open and the score should show. "Closed" and "Non-retention" are exactly
 * what the card said before the flag existed.
 */
export function speciesCardRegLabel(
  r: Pick<LiveRegulation, "status" | "rulesNotLoaded">,
): string | null {
  switch (regDisplayKind(r)) {
    case "unknown":
      return RULES_NOT_LOADED_LABEL;
    case "closed":
      return "Closed";
    case "release":
      return "Non-retention";
    default:
      return null;
  }
}
