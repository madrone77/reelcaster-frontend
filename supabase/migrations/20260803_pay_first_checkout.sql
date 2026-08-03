-- Pay-first checkout: buy Pro without signing up first.
--
-- These two objects already existed in the production database with no
-- migration file and no code referencing them. This file makes the repo match
-- what is deployed (idempotent, so it is a no-op there) and documents what
-- they are for, now that the pay-first flow actually uses them:
--
--   * checkout_claims — the sign-in handoff is one-time. A row means that
--     Checkout Session has already been exchanged for a login, so a session id
--     sitting in browser history or a shared URL can't mint a second one.
--
--   * user_settings.created_via_checkout — true only when the account was
--     brought into existence BY a purchase. That is the flag that decides
--     whether /api/stripe/claim may sign the buyer in from the success URL at
--     all: if the email already had an account, completing a checkout for it is
--     not proof of owning the inbox, so that path emails a link instead.

create table if not exists public.checkout_claims (
  session_id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  claimed_at timestamptz not null default now()
);

-- Service-role only: written by the claim route, never read by a client. RLS
-- on with no policies denies anon and authenticated outright.
alter table public.checkout_claims enable row level security;

comment on table public.checkout_claims is
  'One-time-use ledger for exchanging a Stripe checkout session_id for a sign-in link. A row here means that session has already been redeemed.';

alter table public.user_settings
  add column if not exists created_via_checkout boolean not null default false;

comment on column public.user_settings.created_via_checkout is
  'True when this account was provisioned by a Stripe checkout rather than a signup. Gates the success-page sign-in handoff.';
