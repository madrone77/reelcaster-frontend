import {
  loadSpotHeroFeed,
  type SpotHeroFeed,
} from "@/app/(marketing)/components/spot-hero-feed";
import type { City1Mark } from "./city1-city";

/** Letters only, so "Chinook" matches "Chinook Salmon". Same rule as load-conditions.ts. */
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/**
 * The top of one real spot page, for the rendered WHERE / WHAT / WHEN phone
 * on /lp/<city>/5.
 *
 * The homepage's own loader (spot-hero-feed.ts), with one thing on top: the
 * species the card opens on. The homepage opens on the spot's best-scoring
 * species today, which is the spot page's own rule. This picture is about a
 * NAMED mark for a NAMED fish (City1City.pictureMark), so the "What?" callout
 * should land on that fish's card when it is scored there today. When it is
 * not, the homepage's pick stands rather than the screen opening on an empty
 * card, and the reader can still tap across.
 *
 * Returns null on any thin payload, as the homepage loader does. This is the
 * second picture on a landing page: a mark whose payload came back short
 * should cost the phone, not the page -- the still is there to fall back to.
 */
export async function loadPictureFeed(
  mark: City1Mark,
  provinceCode: string,
): Promise<SpotHeroFeed | null> {
  const feed = await loadSpotHeroFeed(mark.slug, provinceCode);
  if (!feed) return null;

  const named = feed.species.find((s) =>
    norm(s.name).includes(norm(mark.species)),
  );
  const scored =
    named != null &&
    (feed.scoresToday[named.id]?.some(
      (v) => typeof v === "number" && Number.isFinite(v),
    ) ??
      false);

  return scored && named ? { ...feed, selectedId: named.id } : feed;
}
