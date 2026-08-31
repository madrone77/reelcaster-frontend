/**
 * Run with: npx tsx src/lib/pacific-day.test.ts
 *
 * Every case is an instant chosen to sit on the wrong side of a boundary if
 * the bucket were UTC. That is the only way this function can be wrong: it is
 * a one-line format, and what it is worth is entirely in which day it picks
 * for an evening, a new year and the two Sundays the offset moves.
 */

import assert from 'node:assert/strict';
import { pacificDay } from './pacific-day';

const day = (iso: string) => pacificDay(new Date(iso));

// ── The whole point: an evening is not tomorrow ──────────────────────
// 7pm on the 30th, in summer. UTC has already rolled over; Pacific has not.
assert.equal(day('2026-08-31T02:00:00Z'), '2026-08-30');
// 6pm on the 14th, in winter, when the offset is an hour bigger.
assert.equal(day('2026-01-15T02:00:00Z'), '2026-01-14');
// Midday is midday in both, and must not move.
assert.equal(day('2026-08-30T19:00:00Z'), '2026-08-30');

// ── Midnight, from either side ───────────────────────────────────────
assert.equal(day('2026-01-01T07:59:00Z'), '2025-12-31'); // 11:59pm PST
assert.equal(day('2026-01-01T08:00:00Z'), '2026-01-01'); // 12:00am PST

// ── The two Sundays the offset moves ─────────────────────────────────
// Spring forward 2026 is March 8, at 2am Pacific / 10am UTC. Both sides of it
// are still the 8th; an off-by-one-hour bug shows up as the 7th.
assert.equal(day('2026-03-08T09:59:00Z'), '2026-03-08');
assert.equal(day('2026-03-08T10:01:00Z'), '2026-03-08');
// Fall back 2026 is November 1, at 2am Pacific / 9am UTC.
assert.equal(day('2026-11-01T08:59:00Z'), '2026-11-01');
assert.equal(day('2026-11-01T09:01:00Z'), '2026-11-01');
// And the evening before each still belongs to the day before.
assert.equal(day('2026-03-08T06:00:00Z'), '2026-03-07'); // 10pm PST Mar 7
assert.equal(day('2026-11-01T05:00:00Z'), '2026-10-31'); // 10pm PDT Oct 31

// ── Shape ────────────────────────────────────────────────────────────
assert.match(pacificDay(new Date()), /^\d{4}-\d{2}-\d{2}$/);

console.log('pacific-day: all assertions passed');
