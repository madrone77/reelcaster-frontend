-- In-app nudges: the rotating ask at the top of a spot page, and the star
-- ratings its feedback nudge collects.
--
-- The spot page banner shows one nudge per page view, picked at random from
-- the ones this account is still eligible for:
--   share     share with a friend, get a free month (opens the referral modal)
--   catch     log a catch at this spot (opens the spot's Log catch dialog)
--   feedback  how would you rate ReelCaster? (1 to 5 stars, then a note)
--
-- nudge_events kinds:
--   shown    the banner rendered with this nudge (once per page view)
--   open     the nudge was tapped (modal or dialog opened)
--   dismiss  the X, which retires the nudge on the account
--   rate     a star was tapped (feedback only; `rating` set)
--   done     the thing was done: link copied or shared, catch saved,
--            feedback note submitted
--
-- Both tables are written only by the /api/nudges routes with the service
-- role, for a signed-in account. RLS on, no policies. `day` is the Pacific day.

create table if not exists public.nudge_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  nudge text not null check (nudge in ('share', 'catch', 'feedback')),
  kind text not null check (kind in ('shown', 'open', 'dismiss', 'rate', 'done')),
  surface text not null check (surface in ('spot')),
  spot_slug text,
  rating smallint check (rating between 1 and 5),
  device text not null default ''
);

create index if not exists nudge_events_day_idx on public.nudge_events (day);

alter table public.nudge_events enable row level security;
revoke all on public.nudge_events from anon, authenticated;

comment on table public.nudge_events is
  'In-app nudge funnel (shown, open, dismiss, rate, done) per nudge and surface. Written by /api/nudges/event; read by the bluecaster admin.';

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  note text check (char_length(note) <= 2000),
  surface text not null check (surface in ('spot')),
  spot_slug text,
  device text not null default ''
);

create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from anon, authenticated;

comment on table public.app_feedback is
  'Star rating (1-5) and optional note from the in-app feedback nudge. Written by /api/nudges/feedback; read by the bluecaster admin.';
