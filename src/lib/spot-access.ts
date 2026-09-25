/**
 * Boat or shore: how an angler reaches a spot.
 *
 * BlueCaster sends it as `access` on both the map payload and the spot page.
 * Spots from before that field shipped fall back to `spotType`, because the
 * shore kinds (pier, jetty...) and the boat seabed shapes (pinnacle,
 * drop_off...) never share a value, so the kind alone says which it is.
 */

export type SpotAccess = "boat" | "shore";

/** Explore's Boat / Shore switch. "all" shows both. */
export type AccessFilter = "all" | SpotAccess;

const SHORE_TYPE_LABEL: Record<string, string> = {
  pier: "Pier",
  jetty: "Jetty",
  beach: "Beach",
  breakwater: "Breakwater",
  river_mouth: "River mouth",
  rock_outcrop: "Rocky shore",
  public_dock: "Public dock",
};

export function spotAccessOf(
  access: string | null | undefined,
  spotType: string | null | undefined,
): SpotAccess {
  if (access === "shore" || access === "boat") return access;
  return spotType && spotType in SHORE_TYPE_LABEL ? "shore" : "boat";
}

/** "Pier", "Beach"... for a shore spot; null when there is no kind to name. */
export function shoreTypeLabel(spotType: string | null | undefined): string | null {
  return (spotType && SHORE_TYPE_LABEL[spotType]) || null;
}

/** The spot page pill: "Boat", or "Shore spot · Pier". */
export function accessBadgeLabel(access: SpotAccess, spotType: string | null | undefined): string {
  if (access === "boat") return "Boat";
  const kind = shoreTypeLabel(spotType);
  return kind ? `Shore spot · ${kind}` : "Shore spot";
}

const STORAGE_KEY = "rc:spotAccess";

/**
 * The angler's last Boat / Shore pick. localStorage, not the session view
 * memory: which kind of fishing you do is a standing preference, not where you
 * left the map. Guarded because iOS "Block All Cookies" throws on access.
 */
export function readAccessFilter(): AccessFilter {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "boat" || v === "shore" ? v : "all";
  } catch {
    return "all";
  }
}

export function writeAccessFilter(v: AccessFilter): void {
  try {
    if (v === "all") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* storage unavailable: the pick lasts this visit only */
  }
}
