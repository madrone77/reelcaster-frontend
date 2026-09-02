/**
 * The alert text the phone in the alerts band shows.
 *
 * WHICH REAL MESSAGE THIS IS
 *
 * The lead-time heads-up, not the day-of alert. ReelCaster sends both, and the
 * heads-up is the one worth showing: a text that says "6am" and nothing else
 * is only useful to somebody already awake, while "6am this Sunday" is a plan.
 * It is also the thing the band's headline promises -- you do not miss a day
 * you were told about on Tuesday.
 *
 * `format` mirrors the multi-day branch of `smsFor()` in
 * src/lib/email-templates/score-alert.ts, down to the closing "Forecast can
 * still move." -- which earns its place: it is what makes an early number
 * read as a plan rather than a promise.
 *
 * ⚠ ONE PART OF THIS IS AHEAD OF THE PRODUCT: the hour.
 * `ScoreAlertItem` carries spot, species, targetDate, leadDays and score, and
 * no peak hour at all, so the real heads-up cannot say "at 7am" yet. Every
 * other word here is the engine's own. Closing the gap is a field on
 * ScoreAlertItem and one interpolation in smsFor(); until then this page is
 * showing an alert one field better than the one that sends. Do not widen
 * that gap, and delete this warning when it closes.
 *
 * WHY THE NUMBERS ARE CONFIGURED AND THE DAY IS NOT
 *
 * Unlike the conditions phone, which renders the real components on the real
 * payload, this is a picture of a message: the score and the hour are frozen
 * when the page is built, written down per city and read as copy. The DAY is
 * computed, because a landing page that runs for months would otherwise be
 * advertising a Sunday that has already been and gone.
 */

/** The written-down half: what the alert is about. */
export interface AlertSmsParts {
  /** Species display name, as the alert would print it. */
  species: string;
  /** Mark name, spelled as `fishing_spots.name` spells it. */
  spot: string;
  /** 0-100. */
  score: number;
  /** Local hour, 0-23. */
  hour: number;
}

/** The computed half: when it is about, and when it arrived. */
export interface AlertSmsWhen {
  /** The fishing day, "Sun Sep 6" — formatDay()'s shape in score-alert.ts. */
  day: string;
  /** Days from arrival to the fishing day. Always >= 2 here. */
  leadDays: number;
  /** The lock screen's own date, "Tuesday, September 1". */
  arrivedOn: string;
}

/**
 * "7am" / "12pm" — the alert's hour format, which drops the space and the
 * minutes. Mirrors custom-alert.ts:
 *   toLocaleTimeString('en-US', {hour:'numeric', hour12:true})
 *     .toLowerCase().replace(' ', '')
 */
function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}${hour < 12 ? "am" : "pm"}`;
}

/** "3 days out". Mirrors leadPhrase() in score-alert.ts. */
function leadPhrase(leadDays: number): string {
  if (leadDays === 0) return "today";
  if (leadDays === 1) return "tomorrow";
  return `${leadDays} days out`;
}

/**
 * `Sun Sep 6 looks strong for Chinook at The Bell Buoy: 82 at 6am, 5 days
 * out. Forecast can still move.`
 */
export function formatAlertSms(p: AlertSmsParts, w: AlertSmsWhen): string {
  const text =
    `${w.day} looks strong for ${p.species} at ${p.spot}: ` +
    `${p.score} at ${hourLabel(p.hour)}, ${leadPhrase(w.leadDays)}. ` +
    `Forecast can still move.`;
  // The real one truncates at 160 because that is one SMS segment. Kept so a
  // long spot name fails here the same way it would fail in an inbox.
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/**
 * The next Sunday worth a heads-up, in the mark's own timezone.
 *
 * Computed rather than written down so the band cannot go stale: a landing
 * page runs for months and a frozen "Sun Sep 6" is wrong from the 7th on.
 *
 * At least two days out, always. Inside that the real engine switches to its
 * "Tomorrow is your best day" wording, which is a different sentence, and a
 * picture of one message should not silently become a picture of another. So
 * a Saturday reader is shown the Sunday after next rather than tomorrow.
 *
 * Called on the SERVER and passed down, like serverNowMs: the page is cached,
 * so a date read during a client render would disagree with the HTML.
 */
export function nextSundayFrom(nowMs: number, tz: string): AlertSmsWhen {
  const parts = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(d);

  const now = new Date(nowMs);
  // 0 = Sunday, in the mark's timezone rather than the server's.
  const weekday = new Date(parts(now, { year: "numeric", month: "numeric", day: "numeric" })).getDay();
  let leadDays = (7 - weekday) % 7;
  while (leadDays < 2) leadDays += 7;

  const target = new Date(nowMs + leadDays * 86_400_000);
  return {
    day: parts(target, { weekday: "short", month: "short", day: "numeric" }),
    leadDays,
    arrivedOn: parts(now, { weekday: "long", month: "long", day: "numeric" }),
  };
}
