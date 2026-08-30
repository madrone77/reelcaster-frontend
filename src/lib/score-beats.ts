/**
 * Score-alert cadence: how often an angler hears from us, and about what.
 *
 * Split out of `custom-alert-engine` for the same reason `alert-channels` was:
 * these rules decide whether someone gets one message a week or one every
 * morning, they have been wrong in production twice, and the engine drags in
 * Supabase, Open-Meteo, CHS and a `server-only` import that makes it
 * untestable outside Next. Everything here is pure and synchronous, so
 * `score-beats.test.ts` can run it with no network and no clock of its own.
 *
 * The engine re-exports these, so nothing outside needs to know they moved.
 */

/** How far ahead an alert is allowed to look. */
export type LeadTimeMode = 'asap' | 'short' | 'day_of';

/**
 * `stand_down` was a third beat: the day we flagged fell apart, keep it
 * flexible. It was typed, templated and given a channel rule, but nothing ever
 * emitted it, so in practice we followed up only when the news was good. Rather
 * than finish it we dropped the promise: the heads-up no longer says we will
 * confirm, so there is nothing left to break. The database CHECK still admits
 * the value and old rows keep their meaning, we simply never write it.
 */
export type AlertBeat = 'heads_up' | 'confirm';

/**
 * How many days ahead each mode is willing to look.
 *
 * These live in code, not in the database, so they can be retuned against
 * measured forecast stability without a migration and without changing what an
 * angler's saved alert means. Six is a deliberate ceiling: past roughly a week
 * the weather models sit close to climatology, and an alert that is wrong a
 * third of the time trains people to ignore it.
 */
const LEAD_CAP_DAYS: Record<LeadTimeMode, number> = {
  asap: 6,
  short: 3,
  day_of: 0,
};

/**
 * At most one heads-up per alert per rolling week.
 *
 * The threshold alone cannot carry this. Scores live in roughly a 70 to 90
 * band since the 2026-08-03 rescale, so a 75 threshold matches nearly every
 * day: six of the eight live alerts had all seven days in the window
 * qualifying. An alert that fires on every qualifying day would have sent
 * seven messages in an afternoon.
 *
 * `cooldown_hours` used to hide this. It capped a day-of alert at one send per
 * 12 hours no matter how many days were good, so nobody noticed the threshold
 * had stopped discriminating. The create-alert dialog has been saying so all
 * along, in the "~ 7 days a week match this" line under the slider.
 */
const HEADS_UP_COOLDOWN_DAYS = 7;

// Morning window (spot-local) in which a score alert may go out.
//
// This used to run 6am to 9pm, which meant a message landed on whichever
// 30-minute tick first happened to qualify. An angler got a heads-up at 6am one
// day and 2pm the next, which reads as noise rather than as a briefing. Holding
// delivery to the early morning makes the alert a thing that arrives with
// coffee, before the day is committed, and it is what lets a user's alerts be
// batched: they are all evaluated inside the same short window.
//
// The window is wider than one tick on purpose. The evaluator is a GitHub
// Action, which is only roughly punctual, and a run that slips past a single
// 30-minute slot must not silently skip the day. The once-a-day check in the
// engine is what holds it to one message, not the narrowness of this window.
export const SCORE_ALERT_HOUR_START = 6;
export const SCORE_ALERT_HOUR_END = 9;

/** The spot-local hour of an instant, 0 to 23. */
export function hourInZone(at: Date, timezone = 'America/Vancouver'): number {
  const hh = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).format(at);
  // '24' can appear for midnight in some environments; normalize to 0.
  return Number(hh) % 24;
}

/** The spot-local calendar date of an instant, YYYY-MM-DD. */
export function localDateOf(at: Date, timezone = 'America/Vancouver'): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * The bit of an alert profile the cadence rules actually read.
 *
 * Structural rather than the full `AlertProfile`, so this module stays free of
 * the engine's imports. `AlertProfile` satisfies it.
 */
export interface ScoredAlertLike {
  score_threshold?: number | null;
  triggers: { fishing_score?: { min_score: number } };
  lead_time_mode?: LeadTimeMode | null;
}

/** One day of the spot outlook. */
export interface OutlookDayLike {
  date: string;
  dayIndex: number;
  peak: number;
}

export interface OutlookLike {
  days: OutlookDayLike[];
}

/** A message we want to send, before it has been claimed in the ledger. */
export interface ScoreBeatCandidate {
  beat: AlertBeat;
  targetDate: string;
  leadDays: number;
  score: number;
}

/** What we have already told this angler, read from the ledger. */
export interface NoticeState {
  /**
   * Fishing day (YYYY-MM-DD) → the spot-local date we sent its heads-up on.
   *
   * The send date is kept, not just the fact of a send, because a day we
   * flagged this morning must not also be confirmed this morning. See
   * `scoreBeatsFor`.
   */
  headsUpSentOn: Map<string, string>;
  /** When the most recent heads-up went out, for the weekly rate limit. */
  lastHeadsUpAt: Date | null;
}

export function scoreThresholdFor(profile: ScoredAlertLike): number {
  return profile.score_threshold ?? profile.triggers.fishing_score?.min_score ?? 75;
}

function leadModeFor(profile: ScoredAlertLike): LeadTimeMode {
  const mode = profile.lead_time_mode;
  return mode === 'asap' || mode === 'short' || mode === 'day_of' ? mode : 'asap';
}

/**
 * Work out which messages a score alert owes the angler.
 *
 * The alert answers one question: "is there a day worth taking off?" So it
 * speaks about the BEST day in the window, not about every day that clears the
 * bar. The threshold is a floor, not a trigger. That distinction is the whole
 * reason this is usable: with scores clustered between 70 and 90, "every day
 * over 75" is most of the calendar, while "the best day in your next week" is
 * exactly one day.
 *
 * Beats:
 *
 *   heads_up    the best qualifying day in the window, at most one a week
 *   confirm     a day we already flagged, now here or tomorrow, still good
 *
 * A confirm requires a prior heads-up on purpose. Without that condition, a
 * settled week would confirm today, then confirm tomorrow's today, and so on
 * forever, because each day is a fresh target_date the ledger has never seen.
 *
 * What comes back is a candidate list for ONE alert. It is not what the angler
 * receives: the caller pools every alert a user owns into a single daily
 * message. See `processScoreAlerts`.
 */
export function scoreBeatsFor(
  profile: ScoredAlertLike,
  outlook: OutlookLike,
  notices: NoticeState,
  now: Date = new Date(),
): ScoreBeatCandidate[] {
  // The quiet-hours gate is about when we SEND, not what we send about, so it
  // short-circuits everything. Nobody wants a text about next Saturday at 2am.
  //
  // Read off `now` rather than the wall clock. It used to call a zero-argument
  // helper that always read the real time, which quietly made the `now`
  // parameter a lie: no test could exercise the window it gates.
  const hour = hourInZone(now);
  if (hour < SCORE_ALERT_HOUR_START || hour >= SCORE_ALERT_HOUR_END) return [];

  const threshold = scoreThresholdFor(profile);
  const mode = leadModeFor(profile);
  const cap = LEAD_CAP_DAYS[mode];

  // day_of is the angler explicitly asking to be told on the morning itself.
  // It gets the legacy behaviour: today, if today is good. The per-date ledger
  // key holds it to one message a day.
  if (mode === 'day_of') {
    const today = outlook.days.find((d) => d.dayIndex === 0);
    if (!today || today.peak < threshold) return [];
    return [{ beat: 'confirm', targetDate: today.date, leadDays: 0, score: today.peak }];
  }

  const beats: ScoreBeatCandidate[] = [];

  // 1. Confirm a day we already promised, now that it is here or tomorrow.
  //
  // Not a day we flagged this same morning. When the best day in the window is
  // today or tomorrow, the heads-up claims it and, thirty minutes later, this
  // loop saw a flagged day at dayIndex <= 1 and confirmed it: two messages
  // about one day, half an hour apart, the second adding nothing to the first.
  // Requiring the heads-up to be from an earlier day fixes it without weakening
  // the guard that keeps confirms from running forever.
  const todayLocal = localDateOf(now);
  for (const day of outlook.days) {
    if (day.dayIndex > 1) continue;
    const flaggedOn = notices.headsUpSentOn.get(day.date);
    if (!flaggedOn) continue;
    if (flaggedOn >= todayLocal) continue;
    if (day.peak < threshold) continue;
    beats.push({
      beat: 'confirm',
      targetDate: day.date,
      leadDays: day.dayIndex,
      score: day.peak,
    });
  }

  // 2. Flag the best day in the window, if we have not spoken recently.
  const daysSinceHeadsUp = notices.lastHeadsUpAt
    ? (now.getTime() - notices.lastHeadsUpAt.getTime()) / 86_400_000
    : Infinity;

  if (daysSinceHeadsUp >= HEADS_UP_COOLDOWN_DAYS) {
    let best: OutlookDayLike | null = null;
    for (const day of outlook.days) {
      if (day.dayIndex > cap) continue;
      if (day.peak < threshold) continue;
      if (notices.headsUpSentOn.has(day.date)) continue;
      // Strictly greater, so ties go to the nearer day. A tie on score is not
      // really a tie: the closer day is the one you can still plan around.
      if (best === null || day.peak > best.peak) best = day;
    }

    if (best) {
      beats.push({
        beat: 'heads_up',
        targetDate: best.date,
        leadDays: best.dayIndex,
        score: best.peak,
      });
    }
  }

  return beats;
}
