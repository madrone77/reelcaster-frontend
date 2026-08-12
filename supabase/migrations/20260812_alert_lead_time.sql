-- Alert lead time: tell anglers about a good day early enough to plan for it.
--
-- Score alerts could only ever fire on the day itself. Not by configuration:
-- the engine read `topScoreTodayBySpecies` off the spot-page API, which is
-- today's peak and nothing else, so no threshold value could produce lead time.
-- A great Saturday was announced on Saturday morning, by which point the day
-- off, the boat, and the bait were all unbookable.
--
-- The fix reads the 14-day score grid bluecaster already serves and delivers in
-- beats: a heads-up when a qualifying day first appears in the window, then a
-- confirm (or a stand-down) the morning before, once the forecast has firmed up.
--
-- This migration is additive. It adds the lead-time preference and the ledger
-- that makes repeat sends impossible. See docs/ALERT_LEAD_TIME_SPEC.md in the
-- bluecaster repo for the full design.

-- ============================================================
-- 1. user_alert_profiles.lead_time_mode
-- ============================================================

-- How far ahead a score alert is allowed to fire. Deliberately NOT a number of
-- days: a free field pushes a forecast-skill question onto the angler, who will
-- reasonably pick 14 and then find the app is wrong a lot. The day caps live in
-- engine code so they can be tuned against measured forecast stability without
-- a migration and without silently changing what a saved alert means.
--
--   asap    heads-up up to 6 days out, then confirm the morning before
--   short   heads-up up to 3 days out, then confirm the morning before
--   day_of  the legacy behaviour: one message on the morning itself
--
-- Existing rows take the DEFAULT, so every alert already out there moves to
-- `asap`. That is intentional. Day-of is the complaint this work exists to fix,
-- and the confirm beat means nobody acts on a stale early call. Anyone who
-- wants the old behaviour can pick "Morning of" in the create dialog.
alter table public.user_alert_profiles
  add column if not exists lead_time_mode text not null default 'asap';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_alert_profiles_lead_time_mode_check'
  ) then
    alter table public.user_alert_profiles
      add constraint user_alert_profiles_lead_time_mode_check
      check (lead_time_mode in ('asap', 'short', 'day_of'));
  end if;
end $$;

comment on column public.user_alert_profiles.lead_time_mode is
  'How far ahead a score alert fires. asap = up to 6 days out with a confirm beat; short = up to 3 days; day_of = legacy single morning-of message. Day caps live in engine code, not here.';

-- `cooldown_hours` no longer applies to score alerts. It is still the dedupe
-- for the composite (Open-Meteo trigger) path, so the column stays.
comment on column public.user_alert_profiles.cooldown_hours is
  'Minimum hours between sends. Applies to composite alerts only. Score alerts dedupe per target day via alert_day_notices instead.';

-- ============================================================
-- 2. alert_day_notices
-- ============================================================

-- One row per (alert, fishing day, beat) that we have sent or tried to send.
--
-- This table IS the deduplication. The old mechanism was `cooldown_hours`
-- measured against a wall clock, which works when an alert is about right now
-- and fails completely when it is about a day six days away: the same Saturday
-- would re-qualify on every 30-minute tick and re-alert for a solid week.
-- Keying on the day being described instead of the moment of sending is the
-- whole difference.
--
-- Not folded into `alert_history`: that table records composite-trigger fires
-- (which triggers matched, a conditions snapshot) and has no concept of a day
-- in the future. Overloading it would mean a nullable target_date whose absence
-- silently meant "old style", which is the kind of thing that reads fine for a
-- month and then costs an afternoon.
create table if not exists public.alert_day_notices (
  id uuid primary key default gen_random_uuid(),
  alert_profile_id uuid not null references public.user_alert_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The fishing day being described, in the SPOT's local date, not UTC and not
  -- the user's timezone. An alert is about a place, and "Saturday" has to mean
  -- Saturday where the boat goes in.
  target_date date not null,

  -- heads_up    first sighting of a qualifying day, sent early, explicitly
  --             caveated because the forecast can still move
  -- confirm     the morning before: it held, go
  -- stand_down  the morning before: it fell apart, keep the day flexible
  --
  -- confirm and stand_down are mutually exclusive for a given day. Exactly one
  -- of them sends, so a qualifying day produces at most two messages.
  beat text not null check (beat in ('heads_up', 'confirm', 'stand_down')),

  -- What we told them, kept so a "why did I get this?" question is answerable
  -- and so forecast drift between beats can be measured later.
  score_at_send numeric,
  lead_days int,

  channels_sent text[] not null default '{}',
  notification_sent boolean not null default false,
  notification_error text,

  created_at timestamptz not null default now(),
  sent_at timestamptz,

  -- The constraint that does the work. Rows are inserted BEFORE the send is
  -- attempted, so a second worker (or the next tick, or a retry after a
  -- timeout) hits this and skips instead of sending twice. That makes delivery
  -- at-most-once: a dropped message is a better failure than a duplicate text
  -- at six in the morning.
  --
  -- A full unique constraint rather than a partial index, deliberately: partial
  -- unique indexes cannot be used as a PostgREST on_conflict target, so an
  -- upsert against one silently writes nothing.
  constraint alert_day_notices_profile_date_beat_unique
    unique (alert_profile_id, target_date, beat)
);

comment on table public.alert_day_notices is
  'Ledger of score-alert messages, one row per (alert, fishing day, beat). The unique constraint is the dedupe: insert first, then send, then stamp sent_at. Replaces cooldown_hours for score alerts.';
comment on column public.alert_day_notices.target_date is
  'The fishing day being described, in the spot local date. Not the send date and not UTC.';
comment on column public.alert_day_notices.lead_days is
  'target_date minus the send date, in days. 0 means sent on the day itself.';

-- The engine's hot read is "what have I already sent for this alert, for the
-- days currently in the forecast window", which is a profile plus a date range.
create index if not exists idx_alert_day_notices_profile_date
  on public.alert_day_notices (alert_profile_id, target_date);

-- Covers both the user_id foreign key and the RLS predicate below, which would
-- otherwise sequential-scan the table on every read of a user's own notices.
create index if not exists idx_alert_day_notices_user
  on public.alert_day_notices (user_id);

-- ============================================================
-- 3. RLS
-- ============================================================

-- Every write comes from the alert cron holding the service role key, which
-- bypasses RLS. These policies exist because the anon key ships to the browser.
--
-- Read-own is granted so /alerts can show an alert's recent sends without a
-- bespoke endpoint. Nothing else is: a client that could insert here could
-- suppress its own alerts by pre-claiming the unique constraint, and a client
-- that could delete could make the same alert fire repeatedly.
alter table public.alert_day_notices enable row level security;

-- auth.uid() is wrapped in a subquery deliberately. Called bare it is
-- re-evaluated once per row; wrapped, the planner runs it a single time as an
-- InitPlan. Same result, and the difference grows with the table.
drop policy if exists "Users read own alert notices" on public.alert_day_notices;
create policy "Users read own alert notices"
  on public.alert_day_notices for select
  using ((select auth.uid()) = user_id);
