"use client";

import Link from "next/link";
import { Heart, Wind } from "lucide-react";
import { tierFor, TIER_TEXT } from "../../lib/explore-data";
import { useFavorite } from "../../lib/use-favorite";
import { regulatorFor, type Regulator } from "@/lib/regions";
import type {
  NearbySpotCard,
  SeasonState,
} from "@/lib/bluecaster/live-spot-types";

// Solid intel badge — mirrors the verdict colours used on the Explore rail.
const VERDICT: Record<
  NonNullable<NearbySpotCard["intel"]>["verdict"],
  { label: string; cls: string }
> = {
  strong: { label: "STRONG BITE", cls: "bg-rc-good text-white" },
  mixed: { label: "MIXED", cls: "bg-rc-fair text-white" },
  slow: { label: "SLOW", cls: "bg-rc-ink-mute text-white" },
};

// Soft-tint season badge, same vocabulary as SeasonalityStrip / SpotProfile.
const SEASON: Record<SeasonState, { label: string; cls: string }> = {
  peak: { label: "PEAK SEASON", cls: "bg-rc-good-bg text-rc-good-ink" },
  shoulder: { label: "SHOULDER SEASON", cls: "bg-rc-fair-bg text-rc-fair-ink" },
  off: { label: "OFF SEASON", cls: "bg-rc-surface text-rc-ink-mute" },
  closed: { label: "CLOSED", cls: "bg-rc-poor-bg text-rc-poor-ink" },
  nodata: { label: "—", cls: "bg-rc-surface text-rc-ink-mute" },
};

/** `/explore/spot/<slug>` → `<slug>` so the heart keys the same store as the
 *  spot page's own favourite. Falls back to the id when there's no href. */
function slugOf(n: NearbySpotCard): string {
  return n.href?.split("/").filter(Boolean).pop() ?? n.id;
}

function NearbyCard({ n, regulator }: { n: NearbySpotCard; regulator: Regulator }) {
  const [fav, toggle] = useFavorite(slugOf(n));
  const top = n.species[0];
  const tier = tierFor(top?.score ?? null);
  const season = SEASON[n.seasonState] ?? SEASON.nodata;
  const verdict = n.intel ? VERDICT[n.intel.verdict] : null;

  const body = (
    <div className="flex h-full flex-col overflow-hidden rounded border border-rc-rule bg-rc-panel transition-colors group-hover:border-rc-brand/40">
      {/* Decorative relief band — nearbySpots carry no coords, so this is a
          consistent chart texture, not a per-spot map. */}
      <div className="relative h-24 bg-rc-surface">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "url(/landing/chart-illustration.svg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden
        />
        {verdict && (
          <span
            className={`absolute top-2.5 left-2.5 px-2 py-1 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.06em] ${verdict.cls}`}
          >
            {verdict.label}
            {n.intel ? ` · ${n.intel.count} fresh` : ""}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            toggle();
          }}
          aria-pressed={fav}
          aria-label={fav ? "Remove favourite" : "Save spot"}
          className="absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-rc-panel/90 text-rc-ink-soft hover:text-rc-brand transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${fav ? "fill-rc-brand text-rc-brand" : ""}`}
          />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-base font-bold text-rc-ink truncate">
              {n.name}
            </div>
            <div className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
              {n.dfoArea ? `${regulator.areaLabel} ${n.dfoArea}` : "—"}
            </div>
          </div>
          <div
            className={`text-3xl font-bold leading-none tracking-[-0.03em] shrink-0 ${TIER_TEXT[tier]}`}
          >
            {top ? Math.round(top.score) : "—"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-3">
          <span className="text-sm text-rc-ink-soft truncate">
            <span className="text-rc-ink-mute">Top: </span>
            <span className="font-semibold text-rc-ink">
              {n.scoreTopSpeciesName || top?.name || "—"}
            </span>
          </span>
          <span
            className={`shrink-0 px-2 py-0.5 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.06em] ${season.cls}`}
          >
            {season.label}
          </span>
        </div>

        {n.biteWindow && (
          <div className="font-rc-mono text-[11px] text-rc-ink-soft mt-2">
            <span className="text-rc-ink-mute">Bite: </span>
            <span className="font-semibold text-rc-good-ink">{n.biteWindow}</span>
          </div>
        )}

        {n.species.length > 0 && (
          <div className="font-rc-mono text-[11px] text-rc-ink-soft mt-2 truncate">
            {n.species.slice(0, 3).map((s, i) => (
              <span key={s.name}>
                {i > 0 && <span className="text-rc-ink-mute"> · </span>}
                {s.name}{" "}
                <span className={`font-bold ${TIER_TEXT[tierFor(s.score)]}`}>
                  {Math.round(s.score)}
                </span>
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 border-t border-rc-rule-soft pt-3 mt-3">
          <span className="flex items-center gap-1.5 font-rc-mono text-[11px] text-rc-ink-soft">
            <Wind className="w-3.5 h-3.5 text-rc-ink-mute" />
            {n.windKt} kt {n.windDir}
          </span>
          <div className="text-right font-rc-mono text-[10px] text-rc-ink-mute leading-tight">
            <div>
              H {n.tide.nextHigh.time} · {n.tide.nextHigh.heightM.toFixed(1)} m
            </div>
            <div>
              L {n.tide.nextLow.time} · {n.tide.nextLow.heightM.toFixed(1)} m
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return n.href ? (
    <Link href={n.href} className="group block h-full">
      {body}
    </Link>
  ) : (
    <div className="h-full">{body}</div>
  );
}

/**
 * "Nearby Spots" — richer neighbour cards driven entirely by the spot payload's
 * `nearbySpots`: intel verdict + fresh-catch count, top species and its
 * tier-coloured score, season state, bite window, the per-species score
 * breakdown, and current wind + next tides. Header links back to the map.
 *
 * `region` is the *viewed* spot's province/state, and it labels every card's
 * area number. `NearbySpotCard` carries no region of its own, so a neighbour
 * across a jurisdiction line would be mislabelled — acceptable here because
 * these are "within easy run" of the viewed spot, and far better than the
 * hardcoded "DFO area" this replaced, which called Puget Sound water a DFO
 * area. Give the card its own region if cross-border neighbours ever ship.
 */
export default function NeighbourSpots({
  spots,
  region,
}: {
  spots: NearbySpotCard[];
  /** Province/state of the spot being viewed — picks the area vocabulary. */
  region: string | null;
}) {
  if (spots.length === 0) return null;
  const regulator = regulatorFor(region);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-rc-ink">Nearby Spots</h3>
        <Link
          href="/explore"
          className="font-rc-mono text-[11px] font-semibold text-rc-brand hover:underline shrink-0"
        >
          View all on map →
        </Link>
      </div>
      <p className="text-sm text-rc-ink-soft mt-0.5">
        Other productive spots within easy run
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {spots.slice(0, 4).map((n) => (
          <NearbyCard key={n.id} n={n} regulator={regulator} />
        ))}
      </div>
    </div>
  );
}
