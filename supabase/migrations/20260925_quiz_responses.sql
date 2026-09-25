-- One row per quiz taken on /lp/q/<city>: every answer, the persona they
-- added up to, how far they got, and whether the trial followed.
--
-- WHY A LOG AND NOT A COUNTER. campaign_events_daily counts hits and button
-- presses by dimension and deliberately keeps no visitor. That is right for a
-- landing page, where the question is "does this page work". The quiz asks
-- six questions of every reader, and the question here is different: which
-- answers go together, which answers finish the quiz, which answers buy. A
-- counter per answer cannot say that a shore reader who picked "not sure
-- what's open" converts and one who picked "wrong day" does not, because it
-- has thrown the pairing away. So this keeps one row per quiz.
--
-- WHAT IDENTIFIES A ROW. `quiz_id` is a random id the browser makes for the
-- tab and forgets when the tab closes. It is not a user, not a device, and
-- it is joined to nothing until the reader starts a trial, when the same id
-- rides to Stripe in the rc_quiz cookie (src/lib/acquisition-metadata.ts)
-- and comes back on the subscription's metadata. No email, no click id, no
-- IP lives here. Device, OS and coarse location come from request headers
-- exactly as they do for the counter.
--
-- Migration CI is unauthorized, so merging this file does not apply it.
-- Applied to the ReelCaster project via MCP alongside this commit.

create table if not exists public.quiz_responses (
  id            bigint generated always as identity primary key,
  quiz_id       text        not null unique,
  landing       text        not null default 'lpq',
  city          text        not null,

  -- Answers. Null until that question is answered; the vocabulary is the
  -- quiz's own (src/app/lp/q/_quiz/persona.ts). `species` is a slug or 'any'.
  experience    text,
  access        text,
  species       text,
  frequency     text,
  pain          text,
  planning      text,

  -- Highest question answered, 1..6. Drop-off reads off this.
  last_step     integer     not null default 0,
  persona       text,
  completed_at  timestamptz,
  -- The email form was submitted (the press that goes to Stripe).
  cta_at        timestamptz,
  -- Set by the Stripe webhook when a trial with this quiz id starts.
  converted_at  timestamptz,
  stripe_subscription_id text,

  -- The campaign that sent the visit, as the counter records it.
  utm_source    text        not null default '',
  utm_medium    text        not null default '',
  utm_campaign  text        not null default '',
  click_type    text        not null default '',
  -- Split-test arms in force on the visit (rc_lp cookie), e.g. seattle_city_quiz.
  split_tests   jsonb       not null default '{}'::jsonb,

  device        text        not null default '',
  os            text        not null default '',
  geo_country   text        not null default '',
  geo_region    text        not null default '',
  geo_city      text        not null default '',

  started_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.quiz_responses is
  'One row per /lp/q quiz: every answer, the persona, how far the reader got, and whether a trial followed. quiz_id is a per-tab random id, joined to a subscription only through Stripe metadata.';

create index if not exists quiz_responses_started_idx
  on public.quiz_responses (started_at desc);
create index if not exists quiz_responses_city_idx
  on public.quiz_responses (city, started_at desc);

alter table public.quiz_responses enable row level security;
-- No policies: the service role is the only reader and writer, as for
-- marketing_conversions. Nothing here is for the anon key.
