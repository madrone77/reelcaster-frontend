"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Lock } from "lucide-react";
import { speciesIllustration } from "@/lib/species-image";
import { formatHour12 } from "@/lib/time-format";
import type { QuizPick } from "./quiz-data";

/**
 * The result page's proof: the reader's fish, the water it is being caught
 * on right now, today's score there, and the fortnight with today open and
 * the other thirteen days behind Pro.
 *
 * Every claim is one the evidence made (./evidence.ts): "being caught here"
 * only when posts name this spot, "being kept across Marine Area N" only
 * when dockside checks counted that fish in that area, and a plain "best
 * rated today" otherwise. No counts and no sources, the same rule as the
 * "What's biting" line on spot pages.
 *
 * Locked days are plain grey padlocks, as everywhere in the product: no
 * colour on a day we are not showing, because a colour would be a score we
 * made up.
 */

// MapLibre is ~350 kB and only this card needs it, only after the quiz.
const MarketingMap = dynamic(() => import("@/app/(marketing)/components/marketing-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-rc-surface" />,
});

function tierOf(score: number): { word: string; pill: string; tile: string } {
  if (score >= 75)
    return { word: "GOOD", pill: "bg-rc-good-bg text-rc-good-ink", tile: "border-rc-good-border bg-rc-good-bg text-rc-good-ink" };
  if (score >= 55)
    return { word: "FAIR", pill: "bg-rc-fair-bg text-rc-fair-ink", tile: "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink" };
  return { word: "POOR", pill: "bg-rc-poor-bg text-rc-poor-ink", tile: "border-rc-rule bg-rc-poor-bg text-rc-poor-ink" };
}

function windowText(p: QuizPick): string | null {
  if (p.bestFrom < 0 || p.bestTo < 0) return null;
  if (p.bestFrom === p.bestTo) return `around ${formatHour12(p.bestFrom)}`;
  return `${formatHour12(p.bestFrom)} to ${formatHour12((p.bestTo + 1) % 24)}`;
}

function evidenceLine(p: QuizPick, species: string, cityName: string): string {
  switch (p.source) {
    case "reports":
      return `Anglers have been catching ${species} here this month.`;
    case "kept":
      return p.areaLabel
        ? `${species} are being kept across ${p.areaLabel} right now.`
        : `${species} are being kept in these waters right now.`;
    default:
      // No catch is claimed, and none is denied: a score is all we know here.
      return `Today's best-rated ${p.access === "shore" ? "shore spot" : "spot"} for ${species} near ${cityName}.`;
  }
}

function distanceLine(p: QuizPick, cityName: string, isUS: boolean): string | null {
  if (p.distanceKm < 20) return null;
  const d = isUS ? `${Math.round(p.distanceKm * 0.621)} miles` : `${p.distanceKm} km`;
  return p.source === "score"
    ? `About ${d} from ${cityName}.`
    : `About ${d} from ${cityName}. That's where they're being caught right now.`;
}

/** Fourteen days from today, in the reader's own calendar. */
function fortnight(): Array<{ dow: string; date: string }> {
  const out: Array<{ dow: string; date: string }> = [];
  const d = new Date();
  for (let i = 0; i < 14; i++) {
    out.push({
      dow: i === 0 ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }),
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export default function QuizSpotCard(props: {
  pick: QuizPick;
  speciesSlug: string;
  speciesName: string;
  cityName: string;
  isUS: boolean;
  /** Set when the reader fishes from shore and this fish is a boat fish here. */
  boatInstead: boolean;
}) {
  const { pick, speciesSlug, speciesName, cityName, isUS, boatInstead } = props;
  const plate = speciesIllustration(speciesSlug);
  const tier = tierOf(pick.score);
  const win = windowText(pick);
  const far = distanceLine(pick, cityName, isUS);
  const days = fortnight();

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-rc-rule bg-rc-panel shadow-sm">
      <div className="flex items-center gap-3 px-5 pt-5">
        {plate ? (
          <Image
            src={plate.src}
            width={plate.width}
            height={plate.height}
            alt={speciesName}
            sizes="160px"
            className="h-auto w-[132px] flex-none"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-rc-ink-mute">Your fish</p>
          <p className="text-2xl font-bold leading-tight text-rc-ink">{speciesName}</p>
        </div>
      </div>

      <p className="mt-4 px-5 text-xs font-semibold uppercase tracking-wider text-rc-ink-mute">
        {pick.source === "score" ? "Your best spot today" : `Where ${speciesName} are being caught`}
      </p>
      {boatInstead ? (
        <p className="mt-1 px-5 text-sm text-rc-ink-soft">
          {speciesName} aren&apos;t being caught from shore around {cityName}. Here&apos;s where the boats are getting them.
        </p>
      ) : null}

      <div className="relative mx-5 mt-3 h-[220px] overflow-hidden rounded-xl bg-rc-surface">
        <MarketingMap
          spots={[{ slug: pick.slug, name: pick.name, lat: pick.lat, lng: pick.lng, score: pick.score, scoresBySpecies: {} }]}
          center={{ lat: pick.lat, lng: pick.lng }}
          zoom={11}
          featuredSlug={pick.slug}
        />
      </div>

      <div className="px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight text-rc-ink">{pick.name}</h2>
            <p className="mt-0.5 text-sm text-rc-ink-mute">
              {pick.access === "shore" ? (pick.shoreKind ? `Shore · ${pick.shoreKind}` : "Shore") : "Boat"}
            </p>
          </div>
          <div className="flex flex-none flex-col items-center">
            {/* Out of 100, said out loud: a bare "87" reads as a random number
                to someone who has never seen the product. */}
            <span className="whitespace-nowrap font-bold tabular-nums text-rc-ink" aria-label={`${pick.score} out of 100`}>
              <span className="text-3xl">{pick.score}</span>
              <span className="text-base text-rc-ink-mute">/100</span>
            </span>
            <span className={"mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold " + tier.pill}>{tier.word}</span>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-rc-ink">{evidenceLine(pick, speciesName, cityName)}</p>
        {far ? <p className="mt-1 text-sm text-rc-ink-soft">{far}</p> : null}
        {win ? (
          <p className="mt-2 text-[15px] text-rc-ink">
            Best window today: <span className="font-semibold">{win}</span>
          </p>
        ) : null}

        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-rc-ink-mute">14-day forecast</p>
        <div className="-mx-5 mt-2 overflow-x-auto px-5 [scrollbar-width:none]">
          <ol className="flex w-max gap-1.5">
            {days.map((d, i) =>
              i === 0 ? (
                <li
                  key={i}
                  className={"flex h-[76px] w-[54px] flex-none flex-col items-center justify-center gap-0.5 rounded-lg border-2 " + tier.tile}
                >
                  <span className="text-[10px] font-bold uppercase">{d.dow}</span>
                  <span className="text-[10px]">{d.date}</span>
                  <span className="font-bold tabular-nums leading-none">
                    <span className="text-lg">{pick.score}</span>
                    <span className="text-[9px]">/100</span>
                  </span>
                </li>
              ) : (
                <li
                  key={i}
                  aria-label={`${d.dow} ${d.date}, locked`}
                  className="flex h-[76px] w-[54px] flex-none flex-col items-center justify-center gap-0.5 rounded-lg border border-rc-rule bg-rc-surface text-rc-ink-soft"
                >
                  <span className="text-[10px] font-semibold uppercase">{d.dow}</span>
                  <span className="text-[10px]">{d.date}</span>
                  <Lock className="h-4 w-4" aria-hidden />
                </li>
              ),
            )}
          </ol>
        </div>
        <p className="mt-2 text-sm text-rc-ink-mute">Today is free. The next 13 days unlock with Pro.</p>
      </div>
    </section>
  );
}
