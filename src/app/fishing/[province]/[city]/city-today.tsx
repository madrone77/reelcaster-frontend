"use client";

// "Today in <city>" — the verdict band, and the first thing on the page.
//
// ── Why two numbers ──────────────────────────────────────────────────────
//
// Peak is useless alone: since the midday rescale every species in a healthy
// day peaks 89 to 92, so "best today: 91" separates nothing. Window width is
// useless alone in the opposite direction, because a flat mediocre day is
// wide. So the verdict is the LEVEL (`day_avg`) and the headline number is the
// WIDTH (`good_hours`), and they are shown together.
//
// ── Why the headline is not the top score ────────────────────────────────
//
// `headline` comes from BlueCaster as the city's top-ranked roster target, not
// its best scorer, and this component must not re-sort. Ranking by score
// surfaces the flattest species rather than the best fishing: crab and
// bottomfish score off tidal current alone and hold an all-day plateau, while
// salmon spike around the exchange. Victoria today: crab 80 with 11 good
// hours, Chinook 74 with 3. A "best today" that sorted by score would headline
// crabbing in a Chinook town every day and be arithmetically correct.
//
// ── Why the forward line is a client upgrade ─────────────────────────────
//
// Everything about TODAY is public. Only the look ahead is gated, so the
// server renders this whole band at the anon horizon (which is what a crawler
// sees and what gets prerendered) and only the forward line re-fetches once
// entitlement resolves.

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BlueCasterCityToday } from "@/lib/bluecaster";
import { useAuth } from "@/contexts/auth-context";
import { formatHour12 } from "@/lib/time-format";

const VERDICT_COPY: Record<string, { label: string; tone: string }> = {
  excellent: {
    label: "Excellent",
    tone: "border-rc-good-border bg-rc-good-bg text-rc-good-ink",
  },
  good: {
    label: "Good",
    tone: "border-rc-good-border bg-rc-good-bg text-rc-good-ink",
  },
  fair: {
    label: "Fair",
    tone: "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink",
  },
  slow: {
    label: "Slow",
    tone: "border-rc-poor-border bg-rc-poor-bg text-rc-poor-ink",
  },
};

function windowLabel(w: { start_hour: number; end_hour: number } | null) {
  if (!w) return null;
  return `${formatHour12(w.start_hour)} to ${formatHour12(w.end_hour)}`;
}

export default function CityToday({
  initial,
  cityName,
  citySlug,
}: {
  initial: BlueCasterCityToday;
  cityName: string;
  citySlug: string;
}) {
  // Starts as the server's anon-horizon payload, so the band is complete in
  // the HTML and only sharpens for a reader entitled to more of it.
  const [today, setToday] = useState(initial);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    // Signed out is already what the server rendered.
    if (!userId) return;
    let cancelled = false;
    fetch(`/api/bluecaster/city-today?city=${encodeURIComponent(citySlug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((p: BlueCasterCityToday | null) => {
        if (!cancelled && p?.headline !== undefined) setToday(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [citySlug, userId]);

  const { headline, verdict, coverage, ahead } = today;
  if (!headline || !verdict) return null;

  const v = VERDICT_COPY[verdict] ?? VERDICT_COPY.fair;
  const win = windowLabel(headline.window);

  return (
    <section
      aria-labelledby="today"
      className="rounded-lg border border-rc-rule bg-rc-panel p-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="today" className="rc-label text-[9px] text-rc-ink-mute">
          Today in {cityName}
        </h2>
        <span
          className={`rounded-full border px-2.5 py-0.5 font-rc-mono text-[10px] ${v.tone}`}
        >
          {v.label}
        </span>
      </div>

      <p className="text-[19px] sm:text-[21px] font-semibold text-rc-ink mt-2 leading-snug">
        {/* Width first: it is the number that actually differentiates a day. */}
        {headline.good_hours} fishable hour
        {headline.good_hours === 1 ? "" : "s"} for {headline.species_name}
        {win ? `, best ${win}` : ""}
      </p>

      {headline.leading_spot && (
        <p className="text-[14px] text-rc-ink-soft mt-1.5">
          Leading at{" "}
          <Link
            href={`/explore/spot/${headline.leading_spot.slug}`}
            className="font-medium text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
          >
            {headline.leading_spot.name}
          </Link>
        </p>
      )}

      {/* Every scored species, so the reader picks rather than trusting one
          ranking. This is also where the flat species legitimately shine. */}
      {today.species.length > 1 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-rc-rule">
          {today.species.map((s) => (
            <li
              key={s.species_id}
              className="font-rc-mono text-[11px] text-rc-ink-mute"
            >
              <span className="text-rc-ink">{s.species_name}</span>{" "}
              {s.good_hours}h
              {s.window ? ` · ${windowLabel(s.window)}` : ""}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mt-3">
        {ahead.best ? (
          <p className="font-rc-mono text-[11px] text-rc-ink-soft">
            {/* Clamped to the reader's own horizon, so this never names a day
                the strip is drawing locked. */}
            Best of the next {ahead.horizon_days} days:{" "}
            <span className="text-rc-ink">
              {ahead.best.days_out === 1
                ? "tomorrow"
                : `in ${ahead.best.days_out} days`}
            </span>
            , {ahead.best.good_hours}h for {ahead.best.species_name}
          </p>
        ) : (
          <span />
        )}
        {coverage.member_spots > 0 && (
          <p className="font-rc-mono text-[10px] text-rc-ink-mute">
            {/* The denominator matters: "best in the city" over a third of it
                would overclaim. */}
            across {coverage.scored_spots} of {coverage.member_spots} spots
          </p>
        )}
      </div>
    </section>
  );
}
