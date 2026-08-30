/**
 * Run with: npx tsx src/lib/score-beats.test.ts
 *
 * Guards the two rules that decide how often an angler hears from us. Both were
 * broken in production and both failed silently, because a too-frequent alert
 * looks exactly like a working alert from inside the code: every send was
 * individually legitimate.
 *
 * `scoreBeatsFor` is pure, so none of this needs Supabase, Twilio or a
 * forecast.
 */

import assert from 'node:assert/strict';
import {
  scoreBeatsFor,
  type ScoredAlertLike,
  type OutlookLike,
  type NoticeState,
} from './score-beats';

/** 7am in Vancouver, inside the morning send window, on Sat 2026-08-29. */
const MORNING = new Date('2026-08-29T14:00:00Z');
/** 11pm in Vancouver: outside the window, nothing may send. */
const NIGHT = new Date('2026-08-30T06:00:00Z');

function profile(over: Partial<ScoredAlertLike> = {}): ScoredAlertLike {
  return { triggers: {}, score_threshold: 75, lead_time_mode: 'asap', ...over };
}

/** Days from 2026-08-29 with the given peaks, dayIndex 0 first. */
function outlook(peaks: number[]): OutlookLike {
  return {
    days: peaks.map((peak, dayIndex) => {
      const d = new Date('2026-08-29T00:00:00Z');
      d.setUTCDate(d.getUTCDate() + dayIndex);
      return { date: d.toISOString().slice(0, 10), dayIndex, peak };
    }),
  };
}

function noticeState(over: Partial<NoticeState> = {}): NoticeState {
  return { headsUpSentOn: new Map(), lastHeadsUpAt: null, ...over };
}

// ---------------------------------------------------------------------------
// The threshold is a floor, not a trigger.
// ---------------------------------------------------------------------------

// A settled week over the threshold is one heads-up about the best day, not
// seven messages. This is the rule the whole design rests on.
{
  const beats = scoreBeatsFor(profile(), outlook([78, 80, 91, 82, 79, 77, 76]), noticeState(), MORNING);
  assert.equal(beats.length, 1);
  assert.equal(beats[0].beat, 'heads_up');
  assert.equal(beats[0].targetDate, '2026-08-31', 'flags the 91, not the first day over 75');
}

// Nothing clears the bar: silence.
{
  const beats = scoreBeatsFor(profile(), outlook([60, 62, 71, 58]), noticeState(), MORNING);
  assert.equal(beats.length, 0);
}

// ---------------------------------------------------------------------------
// The weekly cap. `lastHeadsUpAt` used to be read from rows filtered to
// `target_date >= today`, so a flagged day sliding into the past erased the
// evidence and lifted the cap. One live alert sent 8 heads-ups in 18 days.
// ---------------------------------------------------------------------------

// Spoke two days ago about a day that has since passed. Still inside the week,
// so we say nothing, even though a better day is now in the window.
{
  const beats = scoreBeatsFor(
    profile(),
    outlook([78, 80, 95]),
    noticeState({ lastHeadsUpAt: new Date('2026-08-27T14:00:00Z') }),
    MORNING,
  );
  assert.equal(beats.length, 0, 'a passed flagged day must still hold back the weekly heads-up');
}

// Eight days ago is outside the week. Speak again.
{
  const beats = scoreBeatsFor(
    profile(),
    outlook([78, 80, 95]),
    noticeState({ lastHeadsUpAt: new Date('2026-08-21T14:00:00Z') }),
    MORNING,
  );
  assert.equal(beats.length, 1);
  assert.equal(beats[0].beat, 'heads_up');
}

// ---------------------------------------------------------------------------
// A day flagged this morning must not also be confirmed this morning. When the
// best day was today or tomorrow the heads-up claimed it and the next 30-minute
// tick confirmed it: two messages about one day, half an hour apart.
// ---------------------------------------------------------------------------

{
  const beats = scoreBeatsFor(
    profile(),
    outlook([88, 80, 79]),
    noticeState({
      headsUpSentOn: new Map([['2026-08-29', '2026-08-29']]),
      lastHeadsUpAt: MORNING,
    }),
    MORNING,
  );
  assert.equal(beats.length, 0, 'no confirm for a day flagged the same morning');
}

// Flagged on an earlier day, now here and still good: confirm.
{
  const beats = scoreBeatsFor(
    profile(),
    outlook([88, 80, 79]),
    noticeState({
      headsUpSentOn: new Map([['2026-08-29', '2026-08-26']]),
      lastHeadsUpAt: new Date('2026-08-26T14:00:00Z'),
    }),
    MORNING,
  );
  assert.equal(beats.length, 1);
  assert.equal(beats[0].beat, 'confirm');
  assert.equal(beats[0].targetDate, '2026-08-29');
}

// A day we never flagged is never confirmed. Without this a settled week would
// confirm today, then tomorrow's today, forever.
{
  const beats = scoreBeatsFor(
    profile(),
    outlook([88, 80, 79]),
    noticeState({ lastHeadsUpAt: MORNING }),
    MORNING,
  );
  assert.equal(beats.length, 0);
}

// A flagged day that fell below the bar says nothing. We used to have a
// stand_down beat for this and never sent it; now the heads-up does not promise
// a follow-up, so silence is honest rather than a broken promise.
{
  const beats = scoreBeatsFor(
    profile(),
    outlook([61, 80, 79]),
    noticeState({
      headsUpSentOn: new Map([['2026-08-29', '2026-08-26']]),
      lastHeadsUpAt: new Date('2026-08-26T14:00:00Z'),
    }),
    MORNING,
  );
  assert.equal(beats.length, 0);
}

// ---------------------------------------------------------------------------
// Delivery window and lead caps.
// ---------------------------------------------------------------------------

// Outside the morning window nothing goes out, however good the day is.
{
  const beats = scoreBeatsFor(profile(), outlook([99, 99, 99]), noticeState(), NIGHT);
  assert.equal(beats.length, 0);
}

// `short` will not look past 3 days, so a great day 5 out is not yet news.
{
  const beats = scoreBeatsFor(
    profile({ lead_time_mode: 'short' }),
    outlook([70, 70, 70, 70, 70, 96]),
    noticeState(),
    MORNING,
  );
  assert.equal(beats.length, 0);
}

// `day_of` is the angler asking to be told on the morning itself.
{
  const beats = scoreBeatsFor(
    profile({ lead_time_mode: 'day_of' }),
    outlook([88, 95]),
    noticeState(),
    MORNING,
  );
  assert.equal(beats.length, 1);
  assert.equal(beats[0].targetDate, '2026-08-29');
  assert.equal(beats[0].leadDays, 0);
}

console.log('score-beats: ok');
