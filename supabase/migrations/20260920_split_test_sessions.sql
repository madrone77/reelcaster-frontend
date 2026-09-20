-- Split tests: the denominator becomes SESSIONS, not renders.
--
-- split_test_events_daily counts renders. A reader who opens the spot sheet
-- four times is four exposures and one person, and the arm that makes a reader
-- reopen the sheet reads as the arm with the worse conversion rate. Every rate
-- on the admin page was per exposure and labelled so; the label was honest and
-- the number was still the wrong one to judge an arm on.
--
-- This table keys the same two counts by `rc_sess`, the rotating session id
-- paywall_events already carries (src/lib/paywall-session.ts: 30 minutes idle,
-- 6 hours absolute, random, in the privacy policy). One row per session per
-- arm per surface per day; the report counts DISTINCT sessions per arm, and a
-- session that saw the arm on two surfaces or two days is still one session.
-- The daily counter keeps running beside it, untouched, so the old columns
-- and the tests concluded on them read exactly as before.
--
-- A browser with cookies blocked has no rc_sess and lands only in the counter;
-- paywall_events shows that at 2 to 5 % of impressions, and it is the same on
-- every arm.
--
-- Migration CI is unauthorized; applied to the ReelCaster project via MCP
-- alongside this commit.

create table if not exists public.split_test_sessions (
  day         date not null,
  test_key    text not null,
  variant     text not null,
  surface     text not null default '',
  currency    text not null default '',
  device      text not null default '',
  session_id  text not null,
  exposures   bigint not null default 0,
  cta_clicks  bigint not null default 0,
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (day, test_key, variant, surface, session_id)
);

comment on table public.split_test_sessions is
  'Per-session per-arm exposure and CTA-click counts keyed by rc_sess. Distinct session_id per arm is the split-test denominator; the daily counter beside it counts renders.';

create index if not exists split_test_sessions_test_idx
  on public.split_test_sessions (test_key, day desc);

alter table public.split_test_sessions enable row level security;
-- No policies, matching split_test_events_daily: service role only.

-- Same shape as bump_split_test_counter, keyed by the session. Called beside
-- it from /api/split-tests/event, never instead of it.
create or replace function public.bump_split_test_session(
  p_day        date,
  p_test_key   text,
  p_variant    text,
  p_surface    text,
  p_currency   text,
  p_device     text,
  p_session_id text,
  p_kind       text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_session_id is null or p_session_id = '' then
    return;
  end if;
  insert into public.split_test_sessions as t (
    day, test_key, variant, surface, currency, device, session_id,
    exposures, cta_clicks
  ) values (
    p_day, p_test_key, p_variant, coalesce(p_surface, ''), coalesce(p_currency, ''),
    coalesce(p_device, ''), p_session_id,
    case when p_kind = 'exposure' then 1 else 0 end,
    case when p_kind = 'cta_click' then 1 else 0 end
  )
  on conflict (day, test_key, variant, surface, session_id)
  do update set
    exposures  = t.exposures  + case when p_kind = 'exposure'  then 1 else 0 end,
    cta_clicks = t.cta_clicks + case when p_kind = 'cta_click' then 1 else 0 end,
    updated_at = now();
end;
$$;

-- Same retention as paywall_events: a session id older than 180 days groups
-- nothing anyone still asks about.
create or replace function public.prune_split_test_sessions()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  delete from public.split_test_sessions where day < current_date - 180;
  get diagnostics n = row_count;
  return n;
end;
$$;
