'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SpeciesCardRow from '@/app/explore/spot/components/species-card-row';
import ScoreCard from '@/app/explore/spot/components/score-card';
import { bestWindow } from '@/app/explore/components/hourly-bars';
import { fmtPeak, zoneAbbrev, zonedHourToUtcIso } from '@/app/explore/lib/explore-data';
import { buildTerminalHours } from '@/app/explore/lib/terminal-hours';
import { useSpotClock } from '@/app/explore/lib/use-spot-clock';
import { formatHour12 } from '@/lib/time-format';
import type { SpotHeroFeed } from './spot-hero-feed';

/**
 * The map arrives as its own chunk, on demand.
 *
 * SpotMiniMap carries the MapLibre engine, about 260 KB compressed, and a
 * static import put that in the first load of every page drawing this phone,
 * reached or not. Loaded this way it ships only when the map is actually
 * rendered on the client: on the homepage that is when the slide first
 * shows, on /lp/<city>/5 when the phone comes near the viewport (deferMap).
 * Still server-rendered, so where the map renders at once its chrome is in
 * the HTML as before.
 */
const SpotMiniMap = dynamic(
  () => import('@/app/explore/spot/components/spot-mini-map'),
  { loading: () => <MapPlaceholder /> },
);

/** The map's box, empty: same size, same corner, none of the weight. */
function MapPlaceholder() {
  return <div aria-hidden className="h-full w-full rounded bg-rc-surface" />;
}

/**
 * The top of a real spot page, at true size, inside the device frame.
 *
 * This replaced a screenshot, and the reason is the reason the day chart below
 * it replaced one too. A screenshot is a picture of one afternoon: its score
 * was whatever the water held when somebody pressed the button, its regulation
 * was that week's, and the page it pictured kept moving without it. This is the
 * SAME SpeciesCardRow, ScoreCard and SpotMiniMap the spot page renders, on
 * today's real payload for one named mark, so it cannot show a screen we do not
 * ship or a number the product would not print.
 *
 * It is also live: tap a species card and every number under it changes, which
 * is what the "tap to switch species" line has always promised and what a still
 * could only assert.
 *
 * ── What is deliberately not here ────────────────────────────────────────
 *
 * The star, the home-spot button, the alert button and the share button. Every
 * one of them acts on an account, and this is a picture on a marketing page —
 * the same reason the ad frame of the real page drops them. What is left is the
 * page's argument: which mark, which species, what it scores, when to go, and
 * what the regulator says about it.
 *
 * ── Where it stops ───────────────────────────────────────────────────────
 *
 * At the bottom of the screen, mid-map, because that is where a phone stops. The
 * frame clips it. Nothing is scaled down to make the page fit the device: the
 * whole point is that these are 375px of real app, and a spot page is taller
 * than one screen.
 */
export default function SpotHeroPhone({
  feed,
  serverNowMs,
  deferMap = false,
}: {
  feed: SpotHeroFeed;
  /** The instant the server baked this HTML. See useSpotClock. */
  serverNowMs: number;
  /**
   * Hold the map until the phone is within a screen of the viewport.
   *
   * On /lp/<city>/5 this phone sits two screens down and its map is the
   * heaviest thing on the page: the engine, three GeoJSON files, the glyphs
   * and a dozen contour tiles, about a megabyte, downloaded at load for a
   * picture the reader has not scrolled to. Measured on a throttled phone it
   * doubled the page's bytes without moving its first paint. With this set
   * the map mounts when the phone comes within a viewport of view, which is
   * the same gate the homepage carousel puts on this slide. Off by default:
   * the homepage already gates the slide, and the capture route wants the
   * map at once.
   */
  deferMap?: boolean;
}) {
  const { hour: nowHour, at: nowAt } = useSpotClock(feed.tz, serverNowMs);

  const mapHost = useRef<HTMLDivElement>(null);
  const [mapWanted, setMapWanted] = useState(!deferMap);
  useEffect(() => {
    if (mapWanted) return;
    const el = mapHost.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setMapWanted(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setMapWanted(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [mapWanted]);

  /** The species the cards drive. Starts where the spot page starts. */
  const [selId, setSelId] = useState<string | null>(feed.selectedId);

  const selSpecies = feed.species.find((s) => s.id === selId) ?? null;
  const regulation = feed.regulations.find((r) => r.speciesId === selId) ?? null;

  const todayHours = useMemo(
    () => (selId ? (feed.scoresToday[selId] ?? null) : null),
    [feed.scoresToday, selId],
  );

  // Now, peak and window all come off the same day's grid, so the card cannot
  // disagree with itself — the spot page's own rule.
  const nowScore = todayHours?.[nowHour] ?? null;
  const { peakScore, peakHourNum } = useMemo(() => {
    let s: number | null = null;
    let h: number | null = null;
    (todayHours ?? []).forEach((v, i) => {
      if (v != null && (s == null || v > s)) {
        s = v;
        h = i;
      }
    });
    return { peakScore: s as number | null, peakHourNum: h as number | null };
  }, [todayHours]);

  // Memoized so the window tuple keeps its identity: an unstable array feeds
  // the components below on every render.
  const win = useMemo(() => bestWindow(todayHours ?? []), [todayHours]);

  const peakTidePhase = useMemo(() => {
    const trend =
      peakHourNum != null
        ? (feed.conditions[peakHourNum]?.tideTrend ?? null)
        : null;
    return trend === 'rising'
      ? 'Tide flooding'
      : trend === 'falling'
        ? 'Tide ebbing'
        : null;
  }, [feed.conditions, peakHourNum]);

  // Wind and gust for the map's hour bar, which only appears once a reader
  // turns a flow field on. `current` stays null: the real page fetches the
  // predicted series after mount, and a homepage should not make that call to
  // label an hour bar nobody has opened. The bar handles the absence.
  const terminalHours = useMemo(
    () => buildTerminalHours(feed.conditions, todayHours ?? []),
    [feed.conditions, todayHours],
  );

  const tzAbbrev = useMemo(
    () => zoneAbbrev(feed.tz, nowAt),
    [feed.tz, nowAt],
  );

  // A picture of a phone does not scroll, so the hour the map draws is the
  // live one. Scrubbing lives on the phone below this one.
  const timeIso = feed.iso
    ? zonedHourToUtcIso(feed.iso, nowHour, feed.tz)
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-rc-panel text-rc-ink">
      <div className="space-y-5 px-4 pt-4">
        {/* Identity. The area label is jurisdictional, not cosmetic — BC's
            PFMA 10 and Washington's Marine Area 10 are different water — and
            it comes from the payload's own agency, resolved server-side. */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {feed.regAreaCode && (
              <span className="inline-flex items-center rounded-full bg-rc-surface px-2 py-0.5 font-rc-mono text-[10px] font-semibold tracking-[0.06em] text-rc-ink-mute uppercase">
                {feed.regulator.areaLabel} {feed.regAreaCode}
              </span>
            )}
            {regulation && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-[0.06em] uppercase ${
                  regulation.status === 'Open'
                    ? 'bg-rc-brand-soft text-rc-brand'
                    : (REG_PILL[regulation.status] ??
                      'bg-rc-surface text-rc-ink-mute')
                }`}
              >
                {selSpecies?.name} &middot; {regulation.status}
              </span>
            )}
          </div>
          <h2 className="rc-title-lg mt-3 min-w-0 text-3xl">{feed.spot.name}</h2>
          <p className="mt-1.5 font-rc-mono text-xs text-rc-ink-mute">
            {`${Math.abs(feed.spot.lat).toFixed(2)}°${
              feed.spot.lat >= 0 ? 'N' : 'S'
            } · ${Math.abs(feed.spot.lng).toFixed(2)}°${
              feed.spot.lng >= 0 ? 'E' : 'W'
            }`}
          </p>
        </div>

        {/* The switcher, and it really switches. */}
        {feed.species.length > 1 && (
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <div className="rc-label text-[9px]">Species</div>
              <div className="font-rc-mono text-[10px] text-rc-ink-mute italic">
                tap to switch species
              </div>
            </div>
            <SpeciesCardRow
              species={feed.species}
              scores={feed.topScoreToday}
              hourlyScoreGrid={gridOf(feed.scoresToday)}
              regulations={feed.regulations}
              selectedId={selId}
              onSelect={setSelId}
            />
          </div>
        )}

        <ScoreCard
          nowTime={`${formatHour12(nowHour)}${tzAbbrev ? ` ${tzAbbrev}` : ''}`}
          nowIsPeak={peakHourNum === nowHour}
          score={nowScore}
          peak={peakScore}
          peakTime={fmtPeak(peakHourNum)}
          windowLabel={win.label}
          windowPeak={peakScore}
          tidePhase={peakTidePhase}
          dfoArea={feed.regAreaCode}
          regulator={feed.regulator}
          speciesName={selSpecies?.name ?? null}
          regulation={regulation}
        />
      </div>

      {/* The water under the mark. `frame` pins it to the phone's own shape
          and takes away the fullscreen and the exit — see SpotMiniMap.

          It takes whatever screen is left, which on this device is a band
          about ninety pixels deep above the tab bar. That is not a compromise,
          it is the real page: a spot page is taller than a phone, the map
          starts near the fold, and what you see of it before scrolling is a
          strip of water with the mark's own puck in it. Giving the map a fixed
          height instead pushed the puck below the frame, so the one thing the
          band is for — this mark, on this water — was the part that got cut. */}
      <div ref={mapHost} className="mt-5 min-h-0 flex-1 px-4">
        {mapWanted ? (
          <SpotMiniMap
            frame
            spot={feed.spot}
            score={peakScore ?? nowScore}
            timeIso={timeIso}
            hours={{
              hour: nowHour,
              onSelectHour: () => {},
              nowHour,
              isToday: true,
              scrubbed: false,
              onNow: () => {},
              dayLabel: null,
              scores: todayHours,
              wind: terminalHours.wind,
              gust: terminalHours.gust,
              windDir: terminalHours.windDir,
              current: null,
              sun: feed.sun,
            }}
            />
        ) : (
          <MapPlaceholder />
        )}
      </div>
    </div>
  );
}

const REG_PILL: Record<string, string> = {
  Open: 'bg-rc-good-bg text-rc-good-ink',
  Release: 'bg-rc-fair-bg text-rc-fair-ink',
  Closed: 'bg-rc-poor-bg text-rc-poor-ink',
};

/**
 * SpeciesCardRow reads a [day][hour] grid because on the real page it is
 * handed the whole fortnight. The feed carries one day, so it is wrapped back
 * into the shape rather than the component being taught a second one.
 */
function gridOf(
  today: Record<string, (number | null)[]>,
): Record<string, (number | null)[][]> {
  const out: Record<string, (number | null)[][]> = {};
  for (const [id, hours] of Object.entries(today)) out[id] = [hours];
  return out;
}
