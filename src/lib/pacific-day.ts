// The day bucket every counter stamps.
//
// WHY THIS EXISTS. The counters here write rows into daily rollup tables:
// `traffic_events_daily`, `campaign_events_daily`, `paywall_impressions` and
// the split-test counter. Each row is (day, dimensions, count), which means
// the day is chosen once, at write time, and can never be revisited. There are
// no event timestamps in the row to re-derive it from.
//
// The day used to be `new Date().toISOString().slice(0, 10)`, the UTC one. Our
// readers are all in one place and it is not UTC: the admin reports are read
// from BC, the customers are on the Pacific coast, and the ad platforms we
// reconcile against report on the advertiser's local day. On a UTC day the
// hours from 5pm Pacific onward belong to tomorrow, so an evening in the boat
// showed up as the next morning's traffic and every "today" was part
// yesterday's afternoon and part a day that had not happened.
//
// WHY THE ZONE IS NAMED HERE AND NOT SET ON THE DEPLOYMENT. Vercel runs these
// in UTC and that is the right default for everything else in the codebase
// that does date arithmetic. Only the bucket moves.

const PT = "America/Los_Angeles";

// Built once. Constructing a DateTimeFormat is the expensive part, and the
// middleware path runs on every document request.
const DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: PT,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The Pacific calendar day, as "YYYY-MM-DD".
 *
 * Assembled from parts rather than trusting a locale to emit ISO order, and
 * wrapped: this runs in edge middleware, where a throw is not a wrong number
 * on a chart but a 500 on a page view. Every runtime we deploy to carries the
 * time zone data this needs, so the fallback should never fire. If it ever
 * does, a UTC bucket is the old behaviour rather than a broken request.
 */
export function pacificDay(now: Date = new Date()): string {
  try {
    const parts = DAY.formatToParts(now);
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === t)?.value ?? "";
    const [y, m, d] = [get("year"), get("month"), get("day")];
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // fall through
  }
  return now.toISOString().slice(0, 10);
}
