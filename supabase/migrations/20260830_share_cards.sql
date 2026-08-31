-- One frozen fishing-day snapshot per share, addressed by its own URL.
--
-- WHY EVERY SHARE NEEDS ITS OWN URL. Facebook, iMessage and every other
-- unfurler cache one scrape per URL and never re-poll it. That is the reason
-- the spot page's own card (explore/spot/[slug]/opengraph-image.tsx) is
-- deliberately evergreen and carries no score: bake today's number into a
-- stable URL and it freezes at whatever it was the first time anyone shared
-- the page, so a 90 keeps advertising a day that blew out a week ago.
--
-- A share card cannot be evergreen — a number and a date are the whole point —
-- so instead of making the content change under a fixed URL, each share gets a
-- fixed content at a NEW URL. /s/<token> is immutable by construction, which
-- makes aggressive caching correct rather than a lie, and hands us per-share
-- attribution for nothing.
--
-- WHY THE DISPLAY STRINGS ARE STORED, NOT THE NUMBERS. tide/wind/current are
-- written here already formatted ("Flood 9.1 ft", "8 kt SW", "1.4 kt"). The
-- card is frozen, so re-deriving those at render time is the one thing that
-- could make an old card disagree with itself — a units change, a formatting
-- fix, or a rounding tweak would silently rewrite history on cards already sent.
-- Feet and the 12-hour clock are settled at mint time and never again.
--
-- ONE CARD PER ALERT PER DAY. The unique index below is what makes the sharer's
-- modal open once per alert rather than on every arrival: the second visit
-- finds the existing token instead of minting a new one. Postgres treats NULLs
-- as distinct in a unique index, so spot-page shares (alert_profile_id IS NULL)
-- are unconstrained and a person can share the same spot as often as they like.
-- Deliberately NOT a partial index, which PostgREST cannot use as an
-- on_conflict target.

create table if not exists public.share_cards (
  token text primary key,

  created_at timestamptz not null default now(),
  -- Nulled rather than cascaded: a deleted account must not break links its
  -- owner already sent to other people.
  created_by uuid references auth.users(id) on delete set null,
  -- Denormalised at mint time for the "Dave shared this with you" line. Roughly
  -- one account in four has no name on it, and the recipient modal drops the
  -- line entirely rather than degrading to "Someone".
  sharer_name text,

  source text not null check (source in ('alert', 'spot')),
  alert_profile_id uuid references public.user_alert_profiles(id) on delete set null,

  spot_slug text not null,
  spot_name text not null,
  species_name text,

  -- The fishing day this card is about, in the spot's own timezone.
  target_date date not null,
  tz text not null,
  window_start_hour smallint,
  window_end_hour smallint,

  score smallint not null,
  tier text not null check (tier in ('good', 'fair', 'poor')),

  tide text,
  wind text,
  current text,

  -- 14 daily peak scores, the card's bar chart. Nulls are unscored days.
  series jsonb not null,
  -- Which bar to highlight, 0-13.
  series_day_index smallint not null,

  -- Funnel. shared_at is set when the sharer actually sends, which is a
  -- different and much smaller number than cards minted.
  shared_at timestamptz,
  opened_count integer not null default 0,
  first_opened_at timestamptz,
  last_opened_at timestamptz
);

create unique index if not exists share_cards_alert_day_uniq
  on public.share_cards (alert_profile_id, target_date);

create index if not exists share_cards_created_by_idx
  on public.share_cards (created_by, created_at desc);

create index if not exists share_cards_created_at_idx
  on public.share_cards (created_at desc);

-- No policies on purpose. Every read and write goes through a server route
-- holding the service role, which does its own validation: the token IS the
-- credential, and anon must never be able to enumerate the table.
alter table public.share_cards enable row level security;

comment on table public.share_cards is
  'Frozen fishing-day snapshots behind /s/<token> share links. Immutable after insert except the funnel counters.';

-- Atomic open counter.
--
-- PostgREST cannot express `opened_count = opened_count + 1`, and a
-- read-then-write from the route would lose counts the moment a link is opened
-- by several people at once, which is exactly what a share link is for.
create or replace function public.share_card_opened(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.share_cards
     set opened_count   = opened_count + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at  = now()
   where token = p_token;
$$;

revoke all on function public.share_card_opened(text) from public, anon, authenticated;

-- The BlueCaster species id behind the card's display name.
--
-- The card stores "Chinook" (already stripped of "Salmon" for card length), and
-- the spot page selects a species by ID. Matching back by display name would be
-- guesswork, so a recipient landing from a share opened on whatever species the
-- page defaulted to — a different fish from the one they were invited about.
alter table public.share_cards add column if not exists species_id text;

comment on column public.share_cards.species_id is
  'BlueCaster species id, so /s/<token> can select the species the card names.';
