"use client";

import Link from "next/link";
import { Heart, ChevronRight, MapPin } from "lucide-react";
import ExploreTopBar from "@/app/explore/components/explore-top-bar";
import { useSavedSpots } from "@/app/explore/lib/use-favorite";
import { PAGE_MEASURE, READING_MEASURE } from "@/app/components/layout/page-measure";

// "victoria-waterfront-ad3f9b" → "Victoria Waterfront" (strip the id suffix,
// title-case the slug words).
function prettify(slug: string): string {
  return slug
    .replace(/-[0-9a-f]{5,}$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Saved spots — the localStorage favourites (rc-fav:<slug>) surfaced as a list,
 * so the mobile "Favorites" tab has a home. Client-only (reads localStorage);
 * v1 links each saved slug to its spot page. Can be enriched with live scores
 * later off the same map/spots data Explore uses.
 */
export default function FavoritesPage() {
  // Straight off the account. `null` while the first read is in flight, so the
  // "no saved spots yet" copy can't flash at someone who has plenty.
  const { slugs: saved, ready } = useSavedSpots();
  const slugs = ready
    ? [...saved].sort((a, b) => prettify(a).localeCompare(prettify(b)))
    : null;

  return (
    // This page used to render a bespoke <header> and no top bar at all, so it
    // was the one signed-in surface you could land on with no way back into the
    // app. It now wears the same chrome as every other one; the heart/kicker
    // block that used to live in that header is just the page's own heading.
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className={`${PAGE_MEASURE} py-8`}>
          <div className={READING_MEASURE}>
            <div className="mb-6">
              <div className="flex items-center gap-2 text-rc-brand mb-2">
                <Heart className="w-5 h-5 fill-current" />
                <span className="rc-label text-[10px]">Your spots</span>
              </div>
              <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">
                Saved spots
              </h1>
            </div>

            {slugs === null ? (
              <div className="space-y-2.5">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded border border-rc-rule bg-rc-surface animate-pulse" />
                ))}
              </div>
            ) : slugs.length === 0 ? (
              <div className="rounded border border-rc-rule bg-rc-panel p-8 text-center">
                <Heart className="w-8 h-8 text-rc-ink-mute mx-auto mb-3" />
                <p className="text-base font-semibold text-rc-ink mb-1">
                  No saved spots yet
                </p>
                <p className="text-sm text-rc-ink-soft mb-5">
                  Tap the heart on any spot to save it here for quick access.
                </p>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded bg-rc-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-rc-brand-hover transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  Explore the map
                </Link>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {slugs.map((slug) => (
                  <li key={slug}>
                    <Link
                      href={`/explore/spot/${slug}`}
                      className="flex items-center gap-3 rounded border border-rc-rule bg-rc-panel px-4 py-3.5 hover:border-rc-brand/40 transition-colors"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft text-rc-brand">
                        <MapPin className="w-4 h-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-rc-ink truncate">
                          {prettify(slug)}
                        </span>
                        <span className="block font-rc-mono text-[11px] text-rc-ink-mute">
                          Saved spot
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-rc-ink-mute shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
