"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { PHONE_CSS } from "../../_city1/phone-css";
import AlertSmsPhone from "../../_city1/alert-sms-phone";
import { nextSundayFrom } from "../../_city1/alert-sms";
import type { ConditionsFeed } from "../../_city1/load-conditions";
import type { QuizSpotLive, QuizSpotRegs } from "@/app/api/lp/quiz-spot/route";
import type { LiveRegulation } from "@/lib/bluecaster/live-spot-types";
import { formatHour12 } from "@/lib/time-format";
import PhoneFrame from "@/app/(marketing)/components/phone-frame";
import type { Access, ShowcaseBlock } from "./persona";
import { KAYAK_REACH_KM, type QuizData, type QuizPick, type QuizPin } from "./quiz-data";

/**
 * The result page's showcase: the product, shown on the reader's own spot.
 *
 * Four screens, in the order ./persona.ts decided for this reader:
 *
 *   day    the spot's real day on the conditions phone, the same
 *          CurrentConditionsStrip and SpotTerminal the spot page renders,
 *          sweeping itself until the reader takes the cursor
 *   map    the best-scored spots for the reader's fish around the city, the
 *          pick featured, shore spots only for a shore reader
 *   regs   what is open at that spot and the limits, from the regulator
 *   alert  the lock screen with the text arriving, about this spot
 *
 * WHAT IS REAL. The day and the rules are fetched live for the picked spot
 * (/api/lp/quiz-spot) once the result is on screen. The map pins are today's
 * real scores, chosen on the server with the pick. The alert is a picture of
 * a message: the format is the engine's, the spot and fish are the reader's,
 * the score and hour are today's at that spot, and the caption says it is a
 * sample. Nothing here shows a number the product would not show.
 *
 * WHILE IT LOADS, AND IF IT FAILS. The day screen draws the 24 hourly scores
 * the page already holds as bars, so the block is never empty; the phone
 * replaces the bars when the feed arrives. The rules block shows a plain line
 * until the rows arrive, and stays plain if they never do.
 */

// MapLibre is ~350 kB and only the map needs it.
const MarketingMap = dynamic(() => import("@/app/(marketing)/components/marketing-map"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-rc-surface" />,
});
// The conditions phone pulls in the spot terminal and its chart; loaded when
// the feed is here rather than with the quiz.
const ConditionsPhone = dynamic(() => import("../../_city1/conditions-phone"), { ssr: false });

/** The device is drawn at 397 px and scaled down to the column, never up. */
const DEVICE_W = 397;

/**
 * A phone that fits its column.
 *
 * The conditions phone lays itself out at true size (its readouts are 12 px
 * mono and its chart cells 13 px wide, so shrinking the app itself costs the
 * picture its point), and 397 px does not fit a 343 px phone column. So the
 * device is drawn at true size out of flow and the whole thing is scaled to
 * the width the column has, the way /lp/<city>/5 does with a fixed .7. The
 * host states the scaled height, since a transform gives back no space.
 */
function ScaledPhone({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const body = bodyRef.current;
    if (!host || !body || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const s = Math.min(1, host.clientWidth / DEVICE_W);
      setScale(s);
      setHeight(body.offsetHeight * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    ro.observe(body);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="rcp relative w-full" style={{ height: height ?? undefined }}>
      <div
        ref={bodyRef}
        className="absolute left-1/2 top-0"
        style={{ width: DEVICE_W, transform: `translateX(-50%) scale(${scale})`, transformOrigin: "top center" }}
      >
        {children}
      </div>
    </div>
  );
}

function tierCls(score: number): string {
  if (score >= 75) return "bg-rc-good";
  if (score >= 55) return "bg-rc-fair";
  return "bg-rc-poor";
}

/** The day as bars, from the scores the page already holds. */
function HourBars({ pick }: { pick: QuizPick }) {
  const hours = pick.hours.length === 24 ? pick.hours : new Array<number>(24).fill(0);
  return (
    <div className="rounded-2xl border border-rc-rule bg-rc-panel p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold text-rc-ink">{pick.name}, today</p>
        <p className="text-xs text-rc-ink-mute">Score by hour</p>
      </div>
      <div className="mt-3 flex h-24 items-end gap-[3px]" aria-hidden>
        {hours.map((h, i) => {
          const on = i >= pick.bestFrom && i <= pick.bestTo && pick.bestFrom >= 0;
          return (
            <span
              key={i}
              className={(on ? tierCls(h) : "bg-rc-rule") + " flex-1 rounded-sm"}
              style={{ height: `${Math.max(h, 6)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-rc-ink-mute" aria-hidden>
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
      {pick.bestFrom >= 0 ? (
        <p className="mt-3 text-sm text-rc-ink">
          Best window: <span className="font-semibold">{windowText(pick)}</span>
        </p>
      ) : null}
    </div>
  );
}

function windowText(p: QuizPick): string {
  if (p.bestFrom === p.bestTo) return `around ${formatHour12(p.bestFrom)}`;
  return `${formatHour12(p.bestFrom)} to ${formatHour12((p.bestTo + 1) % 24)}`;
}

const STATUS_WORD: Record<LiveRegulation["status"], string> = {
  Open: "Open to keep",
  Release: "Catch and release",
  Closed: "Closed",
};
const STATUS_PILL: Record<LiveRegulation["status"], string> = {
  Open: "bg-rc-good-bg text-rc-good-ink",
  Release: "bg-rc-fair-bg text-rc-fair-ink",
  Closed: "bg-rc-poor-bg text-rc-poor-ink",
};

function cm(n: number | null): string | null {
  return n == null ? null : `${Math.round(n / 2.54)} in`;
}

/**
 * "Apr 30" for a YYYY-MM-DD still ahead of today, else null: a season bound
 * already behind us is a stale row, and printing it reads as a closure.
 */
function upcoming(iso: string | null): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getTime() < Date.now()) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * The rules at the spot, the reader's fish first and broken out, the rest as
 * one line each. Reference only, and it says so: the regulator is the
 * authority, as on every regulations panel in the product.
 */
function RegsPanel({ regs, speciesName, regulator, isUS }: { regs: QuizSpotRegs | null; speciesName: string; regulator: string; isUS: boolean }) {
  if (!regs || !regs.rows.length) {
    return (
      <div className="rounded-2xl border border-rc-rule bg-rc-panel p-5 text-[15px] text-rc-ink-soft">
        {regs ? `${regulator} has published no rules for this water yet.` : "Loading the rules for this water…"}
      </div>
    );
  }
  const [active, ...others] = regs.rows;
  const notLoaded = !!active.rulesNotLoaded;
  const size =
    active.sizeLimitCm != null
      ? isUS
        ? `${cm(active.sizeLimitCm)} minimum`
        : `${Math.round(active.sizeLimitCm)} cm minimum`
      : null;
  const areaWord = regs.agency === "WDFW" ? "Marine Area" : "Area";
  return (
    <div className="overflow-hidden rounded-2xl border border-rc-rule bg-rc-panel">
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-rc-ink-mute">
            {regs.areaCode ? `${areaWord} ${regs.areaCode}` : "This water"}
          </p>
          <p className="text-xl font-bold text-rc-ink">{active.speciesCommon || speciesName}</p>
        </div>
        {notLoaded ? (
          <span className="rounded-full bg-rc-surface px-2.5 py-1 text-xs font-bold text-rc-ink-soft">Rules not loaded yet</span>
        ) : (
          <span className={"rounded-full px-2.5 py-1 text-xs font-bold " + STATUS_PILL[active.status]}>{STATUS_WORD[active.status]}</span>
        )}
      </div>
      {!notLoaded ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 px-5 text-sm">
          <div>
            <dt className="text-xs text-rc-ink-mute">Daily limit</dt>
            <dd className="font-semibold text-rc-ink">
              {active.status === "Open" ? (active.dailyLimit != null ? active.dailyLimit : "See notes") : "0"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-rc-ink-mute">Size</dt>
            <dd className="font-semibold text-rc-ink">{size ?? "No size limit listed"}</dd>
          </div>
          {active.status === "Open" && upcoming(active.seasonCloseDate) ? (
            <div>
              <dt className="text-xs text-rc-ink-mute">Open until</dt>
              <dd className="font-semibold text-rc-ink">{upcoming(active.seasonCloseDate)}</dd>
            </div>
          ) : null}
          {active.status !== "Open" && upcoming(active.nextOpenDate) ? (
            <div>
              <dt className="text-xs text-rc-ink-mute">Reopens</dt>
              <dd className="font-semibold text-rc-ink">{upcoming(active.nextOpenDate)}</dd>
            </div>
          ) : null}
          {active.gearRestrictions ? (
            <div className="col-span-2">
              <dt className="text-xs text-rc-ink-mute">Gear</dt>
              <dd className="text-rc-ink">{active.gearRestrictions}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {others.length ? (
        <ul className="mt-4 divide-y divide-rc-rule-soft border-t border-rc-rule-soft">
          {others.slice(0, 5).map((r) => (
            <li key={r.speciesId ?? r.speciesCommon} className="flex items-center justify-between px-5 py-2 text-sm">
              <span className="text-rc-ink">{r.speciesCommon}</span>
              <span className={"rounded-full px-2 py-0.5 text-[11px] font-bold " + (r.rulesNotLoaded ? "bg-rc-surface text-rc-ink-soft" : STATUS_PILL[r.status])}>
                {r.rulesNotLoaded ? "Not loaded" : STATUS_WORD[r.status]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="px-5 pb-4 pt-3 text-xs text-rc-ink-mute">
        Reference only. {regulator} is the authority. Checked daily.
      </p>
    </div>
  );
}

/** The map's pin count line under it. */
function pinsLine(pins: QuizPin[], shore: boolean, species: string, cityName: string): string {
  const good = pins.filter((p) => p.score >= 75).length;
  const noun = shore ? "shore spots" : "spots";
  if (pins.length === 1) return `${pins[0].name} is scored for ${species} today, ${pins[0].score}/100.`;
  if (!pins.length) return `We score ${noun} for ${species} all around ${cityName}.`;
  return good
    ? `${pins.length} ${noun} scored for ${species} near ${cityName} today. ${good} of them read GOOD right now.`
    : `${pins.length} ${noun} scored for ${species} near ${cityName} today.`;
}

export default function QuizShowcase(props: {
  data: QuizData;
  blocks: ShowcaseBlock[];
  pick: QuizPick;
  pins: QuizPin[];
  speciesName: string;
  access: Access;
}) {
  const { data, blocks, pick, pins, speciesName, access } = props;
  const shore = access === "shore";
  const [live, setLive] = useState<QuizSpotLive | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLive(null);
    setFailed(false);
    const url = `/api/lp/quiz-spot?spot=${encodeURIComponent(pick.slug)}&species=${encodeURIComponent(pick.speciesId)}&region=${encodeURIComponent(data.provinceCode)}`;
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<QuizSpotLive>) : Promise.reject(new Error(String(r.status)))))
      .then((body) => {
        if (!cancelled) setLive(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pick.slug, pick.speciesId, data.provinceCode]);

  const feed: ConditionsFeed | null = live?.feed ?? null;
  // Shore readers see shore spots; a kayak sees only what is inside a
  // paddle; a boat sees its whole reach.
  const shownPins = shore
    ? pins.filter((p) => p.access === "shore")
    : access === "kayak"
      ? pins.filter((p) => p.distanceKm <= KAYAK_REACH_KM)
      : pins;
  const mapSpots = [
    ...shownPins.filter((p) => p.slug !== pick.slug),
    { slug: pick.slug, name: pick.name, lat: pick.lat, lng: pick.lng, score: pick.score, access: pick.access },
  ].map((p) => ({ slug: p.slug, name: p.name, lat: p.lat, lng: p.lng, score: p.score, scoresBySpecies: {} }));

  // The alert is about this spot at today's peak. The day is the coming
  // Sunday, at least two days out, as the landing pages do it.
  const peakHour = pick.bestFrom >= 0 ? pick.bestFrom : Math.max(0, pick.hours.indexOf(Math.max(...pick.hours)));
  const when = nextSundayFrom(Date.now(), data.tz);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PHONE_CSS }} />
      {blocks.map((b, i) => (
        <section key={b.id} className="mt-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-rc-brand">
            {i + 1} of {blocks.length} · {b.kicker}
          </p>
          <h2 className="mt-1 text-[24px] font-bold leading-tight text-rc-ink">{b.headline}</h2>
          <p className="mt-2 text-[15px] leading-snug text-rc-ink-soft">{b.lede}</p>

          <div className="mt-4">
            {b.id === "day" ? (
              feed ? (
                <ScaledPhone>
                  <ConditionsPhone feed={feed} serverNowMs={Date.now()} />
                </ScaledPhone>
              ) : (
                <HourBars pick={pick} />
              )
            ) : null}

            {b.id === "map" ? (
              <>
                {/* The map on the app's own phone, app bar and tab bar
                    included, as the landing pages and the homepage show it:
                    a map in a plain box is a website, the bar is what says
                    this is the app you carry to the ramp. */}
                <PhoneFrame
                  width="w-[min(397px,100%)]"
                  label={`The ReelCaster map on a phone showing the spots scored for ${speciesName} around ${data.cityName}, with ${pick.name} selected.`}
                >
                  <MarketingMap
                    spots={mapSpots}
                    center={{ lat: pick.lat, lng: pick.lng }}
                    zoom={shore ? 10 : access === "kayak" ? 10.5 : 9}
                    featuredSlug={pick.slug}
                  />
                </PhoneFrame>
                <p className="mt-3 text-center text-sm text-rc-ink-soft">{pinsLine(shownPins, shore, speciesName, data.cityName)}</p>
              </>
            ) : null}

            {b.id === "regs" ? (
              <RegsPanel regs={failed ? { rows: [], areaCode: null, agency: null, syncedAt: null } : live?.regs ?? null} speciesName={speciesName} regulator={data.regulator} isUS={data.isUS} />
            ) : null}

            {b.id === "alert" ? (
              <>
                <ScaledPhone>
                  <AlertSmsPhone
                    parts={{ species: speciesName, spot: pick.name, score: pick.score, hour: peakHour }}
                    when={when}
                    timeLabel="6:04"
                  />
                </ScaledPhone>
                <p className="mt-3 text-center text-xs text-rc-ink-mute">
                  A sample. Yours reads {pick.name}&apos;s own numbers on the day. Text alerts are part of Pro.
                </p>
              </>
            ) : null}
          </div>

          {b.id === "day" && !feed && !failed ? (
            <p className="mt-2 text-xs text-rc-ink-mute">Loading the live screen…</p>
          ) : null}
        </section>
      ))}

      <section className="mt-10 rounded-2xl border border-rc-rule bg-rc-surface p-5">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-rc-ink-mute" aria-hidden />
          <p className="text-sm font-semibold text-rc-ink">Today is free. Your plan unlocks the rest.</p>
        </div>
        <p className="mt-2 text-sm text-rc-ink-soft">
          Every screen above is today at {pick.name}. Pro adds the next 13 days at every spot, text alerts, and the rules
          beside every score, for 7 days free.
        </p>
      </section>
    </>
  );
}
