import { formatTime12 } from "@/lib/time-format";

/**
 * The line a landing page owes the reader when its numbers are not today's.
 *
 * These pages used to answer 404 when the live forecast generation had no
 * scores for the city, which on 2026-09-01 took three of them off the air
 * under paid traffic. They now fall back to the newest generation that does
 * have scores. That is only defensible if the page says so: the strips and the
 * hero figure look identical whichever generation they came from, so without
 * this line the page is quietly claiming a freshness it does not have, on the
 * one page whose whole argument is that it knows today's water.
 *
 * Two states, because they are genuinely different promises:
 *
 *   stale  Real scores, computed for this date, from an earlier run. The
 *          reader can act on them; they may just have missed a weather
 *          update. We date them so "how old" is the reader's call, not ours.
 *
 *   none   No scores for this city at all. Nothing on the page quotes a
 *          number, and the honest thing is to point at the live map rather
 *          than imply the figures above are merely old.
 *
 * Deliberately quiet and at the foot of the page. It is a disclosure, not a
 * warning: a banner at the top of an ad landing page would cost more
 * conversions than the staleness it describes.
 */
export function LpDataNote({
  hasScores,
  stale,
  scoredAt,
  cityName,
}: {
  hasScores: boolean;
  stale: boolean;
  scoredAt: string | null;
  cityName: string;
}) {
  if (hasScores && !stale) return null;

  if (!hasScores) {
    return (
      <p className="datanote">
        Some data may not be live. Today&rsquo;s scores for {cityName} are still
        being worked out. The live map has the latest we have.
      </p>
    );
  }

  return (
    <p className="datanote">
      Some data may not be live.
      {scoredAt ? ` These scores were worked out at ${formatScoredAt(scoredAt)}.` : ""}{" "}
      The live map is always current.
    </p>
  );
}

/**
 * "4:03 PM on 1 September", in the city's own timezone rather than the
 * reader's.
 *
 * Pacific is right for every city these pages serve, and it is the timezone
 * every other clock on the page already uses. Rendering the reader's local
 * time instead would put a Toronto visitor's 7 PM against a hero window
 * labelled in Pacific, which reads as the page contradicting itself.
 */
function formatScoredAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // formatTime12 rather than toLocaleTimeString, because en-CA renders "9:03
  // a.m." and every other clock on this page is formatTime12's "9:03 AM".
  // Two spellings of the same thing on one page reads as two authors.
  const parts = new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "America/Vancouver",
  }).formatToParts(d);
  const at = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? NaN);
  const hour = at("hour");
  const minute = at("minute");
  if (Number.isNaN(hour) || Number.isNaN(minute)) return "";
  const day = d.toLocaleDateString("en-CA", {
    day: "numeric",
    month: "long",
    timeZone: "America/Vancouver",
  });
  return `${formatTime12(hour, minute)} on ${day}`;
}
