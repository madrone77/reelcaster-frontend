-- Conversions worth reporting back to whoever sold us the click.
--
-- Two events, which is the whole point of the 7-day trial being annual-only:
--
--   trial_start  a card is on file and the free week has begun. Value 0.
--   purchase     the first real payment landed, a week later. Value is the
--                actual amount Stripe charged.
--
-- Those are seven days apart, and that gap is exactly why this table exists.
-- By the time the money arrives the browser is long gone: no pixel can fire,
-- no cookie is readable, and the only thing still tying the payment to the ad
-- is the click id carried through Stripe metadata into this row. Client-side
-- conversion tracking cannot report a trial conversion at all.
--
-- Renewals are deliberately absent. A second annual payment is retention, not
-- acquisition, and uploading it as a conversion would tell Google the same ad
-- bought the same customer twice. The unique constraint below IS that rule:
-- the first paid invoice inserts, every later one conflicts and is ignored.
--
-- Idempotency matters more here than anywhere else in the app. Stripe
-- redelivers webhooks freely, and several event types can describe the same
-- state change, so without the constraint a retry books the same revenue again
-- and re-uploads the same conversion to the ad network.
--
-- Migration CI has been unauthorized for a while, so merging this file does not
-- apply it. Applied to the ReelCaster project via MCP alongside this commit.

create table if not exists public.marketing_conversions (
  id                     bigint generated always as identity primary key,

  -- Null until the pay-first anon flow provisions an account. The conversion
  -- is still real and still uploadable without it.
  user_id                uuid,
  event_type             text        not null check (event_type in ('trial_start', 'purchase')),
  occurred_at            timestamptz not null,

  -- Money comes from Stripe and only from Stripe. Never from a client, never
  -- from a list price constant that could drift from what was charged.
  value_cents            integer     not null default 0,
  currency               text        not null default 'cad',

  stripe_subscription_id text        not null,
  stripe_invoice_id      text,

  -- Which touch is being credited, and everything needed to report it.
  attribution_model      text,
  click_id               text,
  click_type             text,
  utm_source             text,
  utm_medium             text,
  utm_campaign           text,
  utm_content            text,
  utm_term               text,
  landing_path           text,
  entry_path             text,
  params                 jsonb,

  -- Upload state. One network per row: a visit is one click, so there is only
  -- ever one place to report it back to.
  upload_status          text        not null default 'pending'
                           check (upload_status in ('pending', 'sent', 'skipped', 'failed')),
  upload_network         text,
  upload_attempts        integer     not null default 0,
  upload_last_error      text,
  uploaded_at            timestamptz,

  created_at             timestamptz not null default now(),

  constraint marketing_conversions_once unique (stripe_subscription_id, event_type)
);

comment on table public.marketing_conversions is
  'Trial starts and first payments, with the ad click that earned them. Source of truth for CAC, and the queue for uploading conversions back to Google and Meta.';
comment on constraint marketing_conversions_once on public.marketing_conversions is
  'Idempotency. Stripe redelivers webhooks and several event types describe the same change; without this a retry double-books revenue and re-uploads the conversion. Also what makes renewals no-ops.';
comment on column public.marketing_conversions.upload_status is
  'pending = not yet sent. skipped = nothing to send to (no click id, or the network is not configured), which is a resting state and not a failure.';

-- The dashboard reads by time; the uploader reads only what is still pending.
create index if not exists marketing_conversions_time_idx
  on public.marketing_conversions (occurred_at desc);
create index if not exists marketing_conversions_pending_idx
  on public.marketing_conversions (occurred_at)
  where upload_status = 'pending';

alter table public.marketing_conversions enable row level security;
-- No policies, matching paywall_impressions: the service role bypasses RLS and
-- is the only intended reader or writer. Click ids are personal data and the
-- anon key must never be able to read them.
