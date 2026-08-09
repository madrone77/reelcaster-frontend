// Real tidal-current series helpers for the spot page.
//
// BlueCaster's /currents/point returns unsigned speed + a flow-toward bearing
// per hour. The spot page draws current as signed knots (+flood / −ebb), so we
// project each (u, v) sample onto the day's principal flow axis and orient the
// axis so that "positive" correlates with a rising tide (flood). This keeps the
// chart's sign convention honest at any spot without per-spot configuration.

import type { CurrentSample } from "@/lib/bluecaster-client";

/**
 * UTC epoch ms of local midnight for a `YYYY-MM-DD` date in an IANA zone.
 *
 * Returns NaN for an unparseable date rather than throwing: the
 * `formatToParts` below raises RangeError on a non-finite date, and an
 * exception here escapes into Next's root error boundary, which replaces the
 * whole page. Callers check with `Number.isFinite`.
 */
export function localDayStartUtcMs(iso: string, tz: string): number {
  const guess = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(guess)) return NaN;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const shownAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  // Zone offset at the guess instant; DST flips happen well after midnight,
  // so a single correction pass lands on true local midnight.
  return guess - (shownAsUtc - guess);
}

/**
 * Signed hourly current (kn, +flood −ebb) for one local day.
 *
 * `samples` are hourly from local midnight (index = local hour). The principal
 * flow axis comes from the speed-weighted covariance of (u, v); its flood
 * orientation from correlating the projection with the tide's rate of change.
 * Returns null per-hour where the sample is missing, or null overall if the
 * day is too sparse to orient.
 */
export function signCurrentSeries(
  samples: (CurrentSample | null)[],
  tide: (number | null)[],
): (number | null)[] | null {
  const pts = samples.slice(0, 24);
  const have = pts.filter((s): s is CurrentSample => s != null);
  if (have.length < 12) return null;

  // Principal axis of the (u, v) cloud via the doubled-angle mean — robust to
  // the flood/ebb sign flip because 2θ maps both directions onto one angle.
  let s2 = 0, c2 = 0;
  for (const s of have) {
    const w = Math.hypot(s.u, s.v);
    if (w === 0) continue;
    const th = Math.atan2(s.u, s.v); // bearing-style: 0 = north
    s2 += w * Math.sin(2 * th);
    c2 += w * Math.cos(2 * th);
  }
  if (s2 === 0 && c2 === 0) return null;
  const axis = Math.atan2(s2, c2) / 2;
  const ax = Math.sin(axis), ay = Math.cos(axis); // (east, north) unit vector

  const proj = pts.map((s) => (s == null ? null : s.u * ax + s.v * ay));

  // Orient: flood (+) should track a rising tide.
  let corr = 0;
  for (let i = 0; i < 24; i++) {
    const p = proj[i];
    const a = tide[Math.max(0, i - 1)];
    const b = tide[Math.min(23, i + 1)];
    if (p == null || a == null || b == null) continue;
    corr += p * (b - a);
  }
  const flip = corr < 0 ? -1 : 1;
  return proj.map((p) => (p == null ? null : Math.round(p * flip * 100) / 100));
}

/**
 * Next slack after `fromHour` as a fractional local hour, or null. Slack = the
 * signed series crossing zero (the turn), located by linear interpolation.
 */
export function nextSlackHour(
  signed: (number | null)[],
  fromHour: number,
): number | null {
  for (let i = Math.max(0, Math.floor(fromHour)); i < signed.length - 1; i++) {
    const a = signed[i], b = signed[i + 1];
    if (a == null || b == null) continue;
    if (a === 0) { if (i >= fromHour) return i; continue; }
    if (a * b < 0) {
      const cross = i + a / (a - b);
      if (cross >= fromHour) return cross;
    }
  }
  return null;
}

/** Smallest "nice" full-scale (kn) that contains the day's peak current. */
export function niceCurrentScale(signed: (number | null)[]): number {
  let peak = 0;
  for (const v of signed) if (v != null) peak = Math.max(peak, Math.abs(v));
  for (const s of [0.5, 1, 1.5, 2, 3, 4, 6, 8]) if (peak <= s) return s;
  return Math.ceil(peak);
}
