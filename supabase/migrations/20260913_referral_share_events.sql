-- One row per tap on the referral share controls.
--
-- Give a month, get a month counted friends who joined, and bluecaster reads
-- visits to /r/<code> off the page-view counter. Neither says whether a member
-- tried to share and nobody opened it. The taps went to Mixpanel only, which
-- the admin cannot read, so they are recorded here too.
--
-- Kinds:
--   open     the nag was tapped and the share modal opened
--   copy     Copy your link
--   share    Share, which opens the phone's share sheet
--   shared   the share sheet closed by sending, not by cancelling
--   dismiss  the nag's X
--
-- Surfaces: spot (banner on a spot page), dashboard (line under home city),
-- account (the card on /settings/account).
--
-- Written only by POST /api/referrals/event with the service role, for a
-- signed-in account. RLS on, no policies: nothing client-side reads or writes.
-- `day` is the Pacific day, the same day every other admin counter uses.

create table if not exists public.referral_share_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('open', 'copy', 'share', 'shared', 'dismiss')),
  surface text not null check (surface in ('spot', 'dashboard', 'account')),
  device text not null default ''
);

create index if not exists referral_share_events_day_idx
  on public.referral_share_events (day);

alter table public.referral_share_events enable row level security;

revoke all on public.referral_share_events from anon, authenticated;

comment on table public.referral_share_events is
  'Taps on the referral share controls (open, copy, share, shared, dismiss) by surface. Written by /api/referrals/event; read by the bluecaster admin.';
