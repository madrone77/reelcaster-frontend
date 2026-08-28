-- Weekend Bite Alert subscribers.
--
-- These are ANONYMOUS leads, not users. Somebody who arrives on a city page
-- from an ad and hands over an address has no auth.users row and may never
-- get one, so this table cannot key on user_id and cannot live behind RLS
-- that assumes a session. Every read and write goes through the service role
-- in a route that owns its own validation.
--
-- Confirmed-only sending is enforced by the digest query, not by a trigger:
-- an unconfirmed row is a real thing we want to keep (it tells us the form
-- converted even when the confirmation did not) and deleting it would hide
-- that.

create table if not exists public.weekend_alert_subscribers (
  id uuid primary key default gen_random_uuid(),

  -- Which city's digest this is for. Slug rather than an id because the
  -- cities table lives in the OTHER Supabase project (bluecaster) and a
  -- foreign key cannot cross that boundary.
  city_slug text not null,
  province_code text not null,

  channel text not null check (channel in ('email', 'sms')),
  email text,
  phone text,

  -- The species chip the reader had selected when they signed up, if any.
  -- Used to lead the digest with the fish they came for.
  species_slug text,

  -- Double opt-in. Nothing is ever sent to a row with a null confirmed_at.
  confirm_token text not null,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,

  unsubscribed_at timestamptz,
  unsubscribe_token text not null,
  last_sent_at timestamptz,

  -- Where the lead came from: the ?source= on the landing URL.
  source text,
  user_agent text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A row is one channel or the other, never both and never neither.
  constraint weekend_alert_channel_value check (
    (channel = 'email' and email is not null and phone is null) or
    (channel = 'sms'   and phone is not null and email is null)
  )
);

-- One subscription per address per city. Case-folded on email because
-- Casey@ and casey@ are the same inbox and would otherwise both receive the
-- Thursday send.
create unique index if not exists weekend_alert_email_city_uniq
  on public.weekend_alert_subscribers (city_slug, lower(email))
  where email is not null;

create unique index if not exists weekend_alert_phone_city_uniq
  on public.weekend_alert_subscribers (city_slug, phone)
  where phone is not null;

-- The digest's own lookup: confirmed, not unsubscribed, for one city.
create index if not exists weekend_alert_due_idx
  on public.weekend_alert_subscribers (city_slug, confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;

create index if not exists weekend_alert_confirm_token_idx
  on public.weekend_alert_subscribers (confirm_token);

create index if not exists weekend_alert_unsubscribe_token_idx
  on public.weekend_alert_subscribers (unsubscribe_token);

-- No policies are granted: every access path is the service role. RLS is
-- still enabled so that an anon key leaking cannot enumerate the list.
alter table public.weekend_alert_subscribers enable row level security;

comment on table public.weekend_alert_subscribers is
  'Anonymous Weekend Bite Alert leads captured on public city pages. Double opt-in; the Thursday digest sends only to confirmed_at is not null and unsubscribed_at is null.';
