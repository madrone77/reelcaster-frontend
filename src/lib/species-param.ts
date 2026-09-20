import type { LiveSpecies } from "@/lib/bluecaster/live-spot-types";

/**
 * `&species=` on an ad URL: the fish the search keyword named.
 *
 * A Google ad group for "active pass chinook" carries `&species=chinook`, and
 * the ad spot page opens on that fish: its card first, its name in the title,
 * the best window and the chart explainer written about it.
 *
 * Typed by hand into an ad platform, so it matches loosely. "chinook",
 * "chinook-salmon" and "Chinook Salmon" all find the spot's Chinook row, and
 * "halibut" finds "pacific-halibut". A word that matches nothing on this
 * spot's roster returns null and the page opens as it would without it, the
 * same as a stale species on a shared link.
 */
/**
 * What anglers call a fish, mapped to the word its slug uses. Puget Sound says
 * Kings and the Strait of Georgia says Springs, and both are the slug's
 * "chinook"; a keyword written the way the water talks has to land on the
 * same row. Plurals included, because ad groups are named the way people
 * search ("kings", "silvers").
 */
const ALIASES: Record<string, string> = {
  king: "chinook",
  kings: "chinook",
  spring: "chinook",
  springs: "chinook",
  tyee: "chinook",
  silver: "coho",
  silvers: "coho",
  ling: "lingcod",
  lings: "lingcod",
  humpy: "pink",
  humpies: "pink",
  pinks: "pink",
};

export function matchSpeciesParam<T extends Pick<LiveSpecies, "slug" | "rank">>(
  raw: string | null | undefined,
  species: T[],
): T | null {
  const want = (raw ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!want) return null;
  const byRank = [...species].sort((a, b) => a.rank - b.rank);
  const exact = byRank.find((s) => s.slug === want);
  if (exact) return exact;
  // Every word of the param has to be a word of the slug: "chinook" finds
  // "chinook-salmon", "salmon" finds the spot's best-ranked salmon.
  const words = want
    .split("-")
    .filter(Boolean)
    .map((w) => ALIASES[w] ?? w);
  return (
    byRank.find((s) => {
      const slugWords = s.slug.toLowerCase().split("-");
      return words.every((w) => slugWords.includes(w));
    }) ?? null
  );
}

/**
 * The name an angler searches with: "Chinook", not "Chinook Salmon";
 * "Rockfish", not "Rockfish (Aggregate)".
 */
export function speciesKeywordName(name: string): string {
  return (
    name
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s+salmon$/i, "")
      .replace(/^pacific\s+/i, "")
      .trim() || name
  );
}
