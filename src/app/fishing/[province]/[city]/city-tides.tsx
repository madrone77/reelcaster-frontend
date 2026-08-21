"use client";

// Today's tides for a city.
//
// "Victoria tide times" is one of the most-searched things an angler types,
// and this page is the natural place to answer it. It is also the input every
// other number here depends on, so putting it on the page makes the rest of
// the page legible rather than just adding a utility.
//
// The station is NAMED, always. A city has no tide station of its own, so this
// is the one most of its spots read, and for an outlying city that is a real
// distance away: Cowichan's spots read Victoria Harbour. Printing "Tides" with
// no attribution would quietly imply a local gauge that does not exist.
//
// Client-side because the series is a live read and the page is prerendered;
// the section simply does not appear until it resolves, which is the same
// additive contract the rest of the live band uses.

import { useEffect, useState } from "react";
import type { StationConditions } from "@/lib/bluecaster/station-types";
import { fetchStationConditions } from "@/lib/bluecaster-client";
import { formatHour12 } from "@/lib/time-format";
import { SectionHeading } from "./[species]/guide-sections";

/** Metres to feet. BC and Washington anglers read tides in feet. */
function feet(m: number): string {
  return `${(m * 3.28084).toFixed(1)} ft`;
}

function localHourMinute(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  // formatHour12 owns the house clock format, so the label reads the same way
  // it does on every other surface.
  return `${formatHour12(hour).replace(/\s?(am|pm)/i, "")}:${minute}${
    hour >= 12 ? " PM" : " AM"
  }`;
}

function localDate(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
}

export default function CityTides({
  station,
  tz,
  date,
  cityName,
}: {
  station: { sid: string; source: "chs" | "noaa"; name: string } | null;
  tz: string;
  /** The city's local date, so "today" means the same thing as the band above. */
  date: string;
  cityName: string;
}) {
  const [data, setData] = useState<StationConditions | null>(null);

  useEffect(() => {
    if (!station) return;
    let cancelled = false;
    fetchStationConditions(station.source, station.sid)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [station]);

  if (!station || !data) return null;

  // The series runs from six hours back to thirty ahead, so it has to be
  // windowed to the city's own day rather than taken whole.
  const todays = data.extremes.filter((e) => localDate(e.time_utc, tz) === date);
  if (!todays.length) return null;

  return (
    <section className="space-y-3">
      <SectionHeading id="tides">Tides in {cityName} today</SectionHeading>

      <div className="rounded-lg border border-rc-rule bg-rc-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="rc-label text-[9px] text-rc-ink-mute">
            {station.name}
          </div>
          {data.now && (
            <div className="font-rc-mono text-[11px] text-rc-ink-soft">
              Now {feet(data.now.height_m)}
            </div>
          )}
        </div>

        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          {todays.map((e) => (
            <li
              key={e.time_utc}
              className="rounded border border-rc-rule px-3 py-2"
            >
              <div className="rc-label text-[9px] text-rc-ink-mute">
                {e.kind === "high" ? "High" : "Low"}
              </div>
              <div className="text-[15px] font-semibold text-rc-ink mt-0.5">
                {localHourMinute(e.time_utc, tz)}
              </div>
              <div className="font-rc-mono text-[11px] text-rc-ink-soft">
                {feet(e.height_m)}
              </div>
            </li>
          ))}
        </ul>

        <p className="font-rc-mono text-[10px] text-rc-ink-mute mt-3">
          Predictions from {station.name}, the station most spots around{" "}
          {cityName} are read against.
        </p>
      </div>
    </section>
  );
}
