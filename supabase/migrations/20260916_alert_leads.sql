-- Alert leads: a score alert for someone with no account.
--
-- The spot page's "Create alert" used to open the Pro trial modal for a
-- signed-out visitor, so the only way to be told a spot was fishing well was
-- to make an account or start a trial first. This lets a visitor leave a name
-- and an email instead. The alert only runs once they click the confirm link,
-- so every row that sends is a confirmed, interested person.
--
-- Deliberately NOT a user_alert_profiles row. That table, and the
-- alert_day_notices ledger under it, are keyed to auth.users, and a lead has
-- no account. A lead is one alert per email address; a second spot or species
-- needs an account, which is where the normal tier rules take over. When the
-- address later signs up, /api/welcome moves the confirmed lead onto the new
-- account as an ordinary score alert and stamps claimed_user_id, which stops
-- the lead sender.

create table if not exists public.alert_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  -- Always stored lower-cased and trimmed, so the unique constraint below is
  -- the one-alert-per-address rule.
  email text not null check (char_length(email) between 3 and 320),

  spot_slug text not null,
  spot_name text not null,
  -- Copied onto user_alert_profiles when the lead is claimed.
  spot_lat double precision,
  spot_lng double precision,
  target_species text,
  score_threshold int not null check (score_threshold between 0 and 100),
  lead_time_mode text not null default 'asap'
    check (lead_time_mode in ('asap', 'short', 'day_of')),

  -- Carried in the confirm and unsubscribe links. Grants nothing beyond
  -- switching this one alert on or off.
  token uuid not null default gen_random_uuid() unique,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,

  claimed_user_id uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,

  -- Where the visitor was when they asked, for the funnel report.
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint alert_leads_email_unique unique (email)
);

comment on table public.alert_leads is
  'Score alerts for signed-out visitors: name + email, one alert per address, sends only after confirmed_at. Moved onto the account by /api/welcome when the address signs up (claimed_user_id).';

-- The sender's hot read: confirmed, live, unclaimed.
create index if not exists idx_alert_leads_sendable
  on public.alert_leads (confirmed_at)
  where unsubscribed_at is null and claimed_user_id is null;

create index if not exists idx_alert_leads_claimed_user
  on public.alert_leads (claimed_user_id);

-- The lead twin of alert_day_notices, with the same insert-then-send dedupe.
create table if not exists public.alert_lead_notices (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.alert_leads(id) on delete cascade,
  target_date date not null,
  beat text not null check (beat in ('heads_up', 'confirm', 'stand_down')),
  score_at_send numeric,
  lead_days int,
  notification_sent boolean not null default false,
  notification_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint alert_lead_notices_lead_date_beat_unique
    unique (lead_id, target_date, beat)
);

comment on table public.alert_lead_notices is
  'Ledger of lead score-alert emails, one row per (lead, fishing day, beat). Same insert-first dedupe as alert_day_notices.';

-- Service role only. No policies: the browser never reads or writes these.
alter table public.alert_leads enable row level security;
alter table public.alert_lead_notices enable row level security;
