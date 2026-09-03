"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useId, useState } from "react";
import { Wind } from "lucide-react";
import { tierFor, TIER_TEXT } from "../../lib/explore-data";
import { useFavorite } from "../../lib/use-favorite";
import { useSubscription } from "@/hooks/use-subscription";
import HourlyBars from "../../components/hourly-bars";
import { regulatorFrom, type Regulator } from "@/lib/regions";
import type {
  NearbySpotCard,
  SeasonState,
} from "@/lib/bluecaster/live-spot-types";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

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

/** `/explore/spot/<slug>` → `<slug>` so the star keys the same store as the
 *  spot page's own favourite. Falls back to the id when there's no href. */
function slugOf(n: NearbySpotCard): string {
  return n.href?.split("/").filter(Boolean).pop() ?? n.id;
}

/**
 * The Explore map's pin, in brand blue and without a score: the same pill and
 * tail `lib/score-puck.ts` rasterises for MapLibre (30×24 body, 7px corners,
 * 12×8 tail, 2px white ring, soft drop shadow), drawn here as SVG so it can sit
 * over an `<img>`. It carries no number because the card already states the
 * score beside the name — a second, smaller one on the pin would be the same
 * fact twice, and the map's own pucks say "selected" in exactly this blue.
 *
 * The tail tip is at (21, 38) of a 42×44 box, and the still is centred on the
 * spot, so the caller places the tip on the image centre.
 */
const PIN_PATH =
  "M13 6H29A7 7 0 0 1 36 13V23A7 7 0 0 1 29 30H27L21 38L15 30H13A7 7 0 0 1 6 23V13A7 7 0 0 1 13 6Z";

function CardPin() {
  // Four cards share a page; SVG paint servers are looked up by document id.
  const id = useId();
  const fill = `${id}-fill`;
  const sheen = `${id}-sheen`;
  const shadow = `${id}-shadow`;
  const clip = `${id}-clip`;
  return (
    <svg
      viewBox="0 0 42 44"
      width="42"
      height="44"
      aria-hidden
      className="pointer-events-none"
    >
      <defs>
        <linearGradient id={fill} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#4C66E6" />
          <stop offset="1" stopColor="#1F40E0" />
        </linearGradient>
        <linearGradient id={sheen} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={shadow} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.45" />
        </filter>
        <clipPath id={clip}>
          <path d={PIN_PATH} />
        </clipPath>
      </defs>
      <path
        d={PIN_PATH}
        fill={`url(#${fill})`}
        stroke="#fff"
        strokeWidth="2"
        strokeLinejoin="round"
        filter={`url(#${shadow})`}
      />
      <rect x="6" y="6" width="30" height="15" fill={`url(#${sheen})`} clipPath={`url(#${clip})`} />
    </svg>
  );
}

function NearbyCard({
  n,
  fallback,
  tz,
}: {
  n: NearbySpotCard;
  /** Used only when the card carries no agency of its own — the viewed spot's
   *  regulator, which is the best guess a payload predating `areaAgency`
   *  allows. */
  fallback: Regulator;
  tz: string;
}) {
  // Labelled from THIS card's agency, never the viewed spot's. See the
  // component docstring below.
  const regulator = n.areaAgency
    ? regulatorFrom({ agency: n.areaAgency })
    : fallback;
  const [fav, toggle] = useFavorite(slugOf(n));
  const { isPaid } = useSubscription();
  const [favUpgradeOpen, setFavUpgradeOpen] = useState(false);
  // One-shot "pop" when saving, not on un-save or load — the rail card's star.
  const [popping, setPopping] = useState(false);
  const top = n.species[0];
  const tier = tierFor(top?.score ?? null);
  // No badge at all when the spot has no abundance curve for its top species —
  // an empty "—" chip reads as a rating rather than as an absence.
  const season = n.seasonState === "nodata" ? null : SEASON[n.seasonState] ?? null;
  const verdict = n.intel ? VERDICT[n.intel.verdict] : null;

  // The whole card is a link, so the star has to both stop the navigation
  // (preventDefault, which next/link honours) and keep the click to itself.
  //
  // This used to drop the toggle's result on the floor. A signed-out tap and a
  // free account at its cap both resolve without writing, and with nothing
  // reacting to that the star simply did not work for exactly the viewers it
  // was there to sell to. Same treatment as the rail card and the page's own
  // star now: both refusals open the trial modal, which sells to a free account
  // and offers registration to an anonymous one off the tier it detects.
  const onStar = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const res = await toggle({ isPaid, spotId: n.id });
    if (res === "signed-out" || res === "at-cap") {
      setFavUpgradeOpen(true);
      return;
    }
    if (res === "saved") {
      setPopping(true);
      window.setTimeout(() => setPopping(false), 600);
    }
  };

  const body = (
    <div className="flex h-full flex-col overflow-hidden rounded border border-rc-rule bg-rc-panel transition-colors group-hover:border-rc-brand/40">
      {/* Satellite band — a real picture of this spot's water at z=12, not the
          shared chart texture that used to sit here. Served through
          /api/bluecaster/map/spot-thumb, which holds the Google key and caches
          per spot (coordinates never move). The surface tint stays underneath
          as the backdrop while it loads, and if imagery is unavailable.

          `pin=0`: the still comes back without Google's teardrop and the
          product's own pin is drawn over it (CardPin), tip on the centre. */}
      <div className="relative h-24 bg-rc-surface">
        <img
          src={`/api/bluecaster/map/spot-thumb?spot=${n.id}&z=12&size=card&pin=0`}
          alt=""
          aria-hidden
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[38px]">
          <CardPin />
        </span>
        {/* Bottom-left, clear of the pin in the centre and the star top-right. */}
        {verdict && (
          <span
            className={`absolute bottom-2.5 left-2.5 px-2 py-1 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.06em] ${verdict.cls}`}
          >
            {verdict.label}
            {n.intel ? ` · ${n.intel.count} fresh` : ""}
          </span>
        )}
        <button
          type="button"
          onClick={onStar}
          aria-pressed={fav}
          aria-label={fav ? "Remove from favorites" : "Add to favorites"}
          className="group/fav absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded bg-rc-panel/90 transition-colors hover:bg-rc-panel"
        >
          {/* Same star as the Explore rail card's favourite (spot-card.tsx) —
              one favourite glyph across the product, gold when saved. A square
              tile, not a disc: nothing else in the product is round, and a
              five-point star's visual centre sits below its box centre, so it
              never looked centred in a circle. Nudged 1px down for the same
              reason. */}
          <svg
            viewBox="0 0 42 40"
            aria-hidden
            className={`w-[16px] h-[15px] translate-y-px origin-center transition-[fill] duration-200 ${
              fav
                ? "fill-rc-badge"
                : "fill-rc-ink-mute group-hover/fav:fill-rc-badge"
            } ${popping ? "animate-fav-pop" : ""}`}
          >
            <path d="M21,34 L10.4346982,39.5545079 C8.47875732,40.5828068 7.19697214,39.6450119 7.56952871,37.4728404 L9.5873218,25.7082039 L1.03981311,17.3764421 C-0.542576313,15.8339937 -0.0467737017,14.3251489 2.13421047,14.0082334 L13.946577,12.2917961 L19.2292279,1.58797623 C20.2071983,-0.393608322 21.7954064,-0.388330682 22.7707721,1.58797623 L28.053423,12.2917961 L39.8657895,14.0082334 C42.0525979,14.3259953 42.5383619,15.8381017 40.9601869,17.3764421 L32.4126782,25.7082039 L34.4304713,37.4728404 C34.8040228,39.6508126 33.5160333,40.5800681 31.5653018,39.5545079 L21,34 Z" />
          </svg>
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
          {season && (
            <span
              className={`shrink-0 px-2 py-0.5 rounded font-rc-mono text-[10px] font-bold uppercase tracking-[0.06em] ${season.cls}`}
            >
              {season.label}
            </span>
          )}
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

        {/* The drawer's 24-hour chart, compact and read-only: one bar per
            hour, the best window solid, the current hour marked, an hour axis
            under it. This was the rail card's 12-bucket sparkline, which is
            drawn for an 80px slot beside the KPI columns; given this card's
            full width its twelve bars stretched into squat blocks that looked
            like no other chart on the page. */}
        <div className="mt-3">
          <HourlyBars hours={n.scoreNext24h} tz={tz} hideLabel dense />
        </div>

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

  return (
    <>
      {n.href ? (
        <Link href={n.href} className="group block h-full">
          {body}
        </Link>
      ) : (
        <div className="h-full">{body}</div>
      )}
      <ProTrialModal
        open={favUpgradeOpen}
        onOpenChange={setFavUpgradeOpen}
        feature="favorite-spots"
        from="spot-page-nearby"
        spotName={n.name}
      />
    </>
  );
}

/**
 * "Nearby Spots" — richer neighbour cards driven entirely by the spot payload's
 * `nearbySpots`: intel verdict + fresh-catch count, top species and its
 * tier-coloured score, season state, bite window, the per-species score
 * breakdown, and current wind + next tides. Header links back to the map.
 *
 * Each card names its area under its OWN agency (`NearbySpotCard.areaAgency`),
 * not the viewed spot's. This used to label the whole rail from the viewed
 * spot on the grounds that neighbours are "within easy run" — but easy run
 * from the San Juans crosses into BC. East Point (Saturna Island)'s four
 * neighbours are three WDFW Area 7 marks and one DFO 18-5, so a single label
 * for the rail is wrong for whichever half sits over the line, in whichever
 * direction the reader is looking from.
 *
 * `regulator` remains the fallback for a card with no agency — a payload
 * predating the field, where the viewed spot is the best guess available.
 */
export default function NeighbourSpots({
  spots,
  regulator,
  tz,
}: {
  spots: NearbySpotCard[];
  /** The viewed spot's authority — the fallback vocabulary for a card that
   *  carries no agency of its own. */
  regulator: Regulator;
  /** The viewed spot's timezone. Neighbours are within easy run, so it is
   *  theirs too; it places the "now" marker on each card's hour chart. */
  tz: string;
}) {
  if (spots.length === 0) return null;
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
          <NearbyCard key={n.id} n={n} fallback={regulator} tz={tz} />
        ))}
      </div>
    </div>
  );
}
