-- Live split testing: a registry of running tests, a counter of who saw which
-- arm, and a stamp on the conversion that says which arm bought.
--
-- WHY A REGISTRY RATHER THAN A FEATURE FLAG PER TEST. A flag answers "which
-- arm is this visitor in" and nothing else. The question that actually gets
-- asked is "is this test working", and answering it needs the arms, their
-- exposure counts, and the conversions attributable to each, in one place,
-- for tests that are not all about the same thing. The first three kinds are
-- a landing page, a payment price, and a modal; `surface_kind` is open text
-- precisely because that list is not finished.
--
-- THREE TABLES, THREE JOBS:
--   split_tests             what is being tested, and whether it is running
--   split_test_variants     the arms, their weights, and what each one serves
--   split_test_events_daily how many people saw each arm (counter, not a log)
-- and one column, marketing_conversions.split_tests, which is the join that
-- makes the whole thing readable: exposures on one side, sales on the other.
--
-- STILL NOT AN EVENT LOG. Same trade as campaign_events_daily and
-- paywall_impressions: no visitor id, no user id, nothing finer than the day.
-- The cost is real and worth stating, because for a split test it bites
-- harder than it does for a campaign counter: unique visitors per arm cannot
-- be derived, so the denominator is exposures, not people, and anyone who
-- opens the paywall modal three times is three exposures. Every rate computed
-- from this table is per-exposure and must be labelled that way. What it buys
-- is the same thing it always buys: a table with nothing in it to leak.
--
-- Arm membership itself lives in a cookie on the visitor (`rc_split`), which
-- holds arm names and no identifier — "price_annual_v2:b" and nothing more.
-- That is what makes the assignment sticky without issuing anyone an id.
--
-- Migration CI has been unauthorized for a while, so merging this file does
-- not apply it. Applied to the ReelCaster project via MCP alongside this
-- commit.

-- ── The tests ────────────────────────────────────────────────────────────

create table if not exists public.split_tests (
  -- Stable key, used in the cookie, in Stripe metadata, and as the grouping
  -- column in every report. Renaming the display name must never orphan the
  -- history, which is why the name is a separate column.
  key            text primary key,

  name           text not null,

  -- What kind of thing is being varied. 'landing', 'payment', 'modal' today.
  -- Deliberately NOT a check constraint or an enum: the whole design premise
  -- is that the fourth kind arrives without a migration. The admin page
  -- title-cases anything it does not recognise rather than dropping the row.
  surface_kind   text not null,

  -- draft   built, not serving. Every visitor gets the control.
  -- running  assigning and serving.
  -- paused   assignments stand, no new ones, still serving what was assigned.
  -- concluded finished; kept for the record, everyone back on the control.
  status         text not null default 'draft'
                 check (status in ('draft', 'running', 'paused', 'concluded')),

  -- What this test is trying to find out, in a sentence. Read on the report,
  -- because a number without the question it answers is how a test gets
  -- misread three weeks later.
  hypothesis     text not null default '',

  -- Which number decides it. 'paid_conversion' | 'trial_start' | 'cta_click'.
  primary_metric text not null default 'paid_conversion',

  -- Whether the arms mean different things in different currencies, and so
  -- must never be read blended. True for the annual price test: CAD moves
  -- 33 → 45 (+36%) while USD moves 33 → 39 (+18%), so one pooled conversion
  -- rate would let a shift in the BC/Seattle traffic mix read as a price
  -- effect. See the note on the seeded row at the bottom of this file.
  split_by_currency boolean not null default false,

  started_at     timestamptz,
  stopped_at     timestamptz,

  -- Set when a test is concluded, so the record says what was decided and not
  -- merely that it stopped.
  winner         text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.split_tests is
  'Registry of live split tests. A test is a row, not a deploy; status gates whether anyone is assigned to it.';
comment on column public.split_tests.surface_kind is
  'landing | payment | modal, and whatever comes next. Open text on purpose.';
comment on column public.split_tests.split_by_currency is
  'When true the report never pools currencies: the arms are different sized changes in each.';

-- ── The arms ─────────────────────────────────────────────────────────────

create table if not exists public.split_test_variants (
  test_key    text not null references public.split_tests (key) on delete cascade,

  -- 'a', 'b', 'c'. Short because it rides in a cookie and in Stripe metadata.
  variant     text not null,

  label       text not null,

  -- Relative weight, not a percentage: weights are summed and each arm gets
  -- its share. Two arms at 50 and a three-arm test at 34/33/33 both work
  -- without anyone having to make the column add to 100.
  weight      integer not null default 50 check (weight >= 0),

  -- The arm that represents "what we do today". Exactly one per test.
  is_control  boolean not null default false,

  -- What this arm actually serves. Shape depends on surface_kind:
  --   payment  { "price_env": "STRIPE_ANNUAL_PRICE_ID_B",
  --              "cents": { "cad": 4500, "usd": 3900 } }
  --   landing  { "path": "/lp/6" }
  --   modal    { "copy_key": "urgency" }
  --
  -- ⚠ For a payment arm the Stripe price ID is NOT stored here. `price_env`
  -- names the environment variable holding it, so serving a new price takes
  -- both a running row AND a deliberate env var on the Vercel project. Two
  -- locks, either of which alone keeps every visitor on the control price.
  -- A price id in this column would be one forgotten UPDATE away from
  -- charging real money at an amount nobody chose.
  --
  -- `cents` is what the SITE DISPLAYS. The checkout route verifies it against
  -- the real Stripe price before it will use the arm (see resolvePricing in
  -- src/lib/pricing.ts): showing $39 and charging $45 is the one failure in
  -- this whole system that cannot be walked back with an apology.
  config      jsonb not null default '{}',

  created_at  timestamptz not null default now(),

  primary key (test_key, variant)
);

comment on column public.split_test_variants.config is
  'What the arm serves. For payment arms, price_env names the env var holding the Stripe price id; the id itself is never stored here.';
comment on column public.split_test_variants.weight is
  'Relative share, not a percentage. Weights are summed at assignment time.';

-- One control per test, enforced rather than trusted: the control is the
-- fallback every degraded path lands on, and two of them makes that fallback
-- a coin toss.
create unique index if not exists split_test_variants_one_control
  on public.split_test_variants (test_key)
  where is_control;

-- ── Who saw what ─────────────────────────────────────────────────────────

create table if not exists public.split_test_events_daily (
  day         date not null,

  test_key    text not null,
  variant     text not null,

  -- Where the arm was seen: 'plans', 'checkout', 'modal', 'lp6'. An arm shown
  -- in three places has three rows, because "the modal converts and the plans
  -- page does not" is the second question every test raises.
  surface     text not null default '',

  -- Which currency the visitor was being quoted. Empty for tests where price
  -- is not what varies. Not merely a dimension for the price test: it is the
  -- axis the arms differ along, so a report that drops it is wrong rather
  -- than coarse.
  currency    text not null default '',

  geo_country text not null default '',
  geo_region  text not null default '',
  device      text not null default '',

  -- Deliberately narrower than campaign_events_daily: no geo_city, no os.
  -- This table is written on every price render rather than once per landing,
  -- so it sees far more traffic, and a split test is read by arm and market,
  -- never by city and operating system.

  exposures   bigint not null default 0,
  cta_clicks  bigint not null default 0,

  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (day, test_key, variant, surface, currency, geo_country, geo_region, device)
);

comment on table public.split_test_events_daily is
  'Daily per-arm exposure and CTA-click counters. No visitor id: rates from this table are per exposure, never per person.';

create index if not exists split_test_events_daily_day_idx
  on public.split_test_events_daily (day desc);

create index if not exists split_test_events_daily_test_idx
  on public.split_test_events_daily (test_key, day desc);

alter table public.split_tests enable row level security;
alter table public.split_test_variants enable row level security;
alter table public.split_test_events_daily enable row level security;
-- No policies, matching campaign_events_daily and marketing_conversions: the
-- service role bypasses RLS and is the only intended reader or writer.

-- ── The join: which arm bought ───────────────────────────────────────────

-- jsonb rather than two columns, because a visitor can be in several tests at
-- once and a conversion belongs to every arm that was in play when it
-- happened. { "price_annual_v2": "b", "modal_copy_v1": "a" }.
--
-- Written by the Stripe webhook from subscription metadata, which is the only
-- carrier that survives the round trip out to Stripe's hosted checkout and
-- back for a buyer who does not yet have an account.
alter table public.marketing_conversions
  add column if not exists split_tests jsonb not null default '{}'::jsonb;

comment on column public.marketing_conversions.split_tests is
  'Arm memberships at the moment of conversion, test key → variant. Empty for conversions with no test running.';

create index if not exists marketing_conversions_split_tests_idx
  on public.marketing_conversions using gin (split_tests);

-- ── Counting ─────────────────────────────────────────────────────────────

/**
 * Add one to an arm's bucket, creating it if this is the first of its kind
 * today.
 *
 * security definer for the same reason bump_campaign_counter is: it is the
 * only supported way in, and it is what guarantees an exposure row and a
 * click row describing the same visit land on the same key. A rate whose
 * numerator and denominator can land on different keys is not a rate.
 */
create or replace function public.bump_split_test_counter(
  p_day         date,
  p_test_key    text,
  p_variant     text,
  p_surface     text,
  p_currency    text,
  p_geo_country text,
  p_geo_region  text,
  p_device      text,
  p_kind        text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.split_test_events_daily as t (
    day, test_key, variant, surface, currency,
    geo_country, geo_region, device,
    exposures, cta_clicks
  ) values (
    p_day, p_test_key, p_variant, coalesce(p_surface, ''), coalesce(p_currency, ''),
    coalesce(p_geo_country, ''), coalesce(p_geo_region, ''), coalesce(p_device, ''),
    case when p_kind = 'exposure' then 1 else 0 end,
    case when p_kind = 'cta_click' then 1 else 0 end
  )
  on conflict (day, test_key, variant, surface, currency, geo_country, geo_region, device)
  do update set
    exposures  = t.exposures  + case when p_kind = 'exposure'  then 1 else 0 end,
    cta_clicks = t.cta_clicks + case when p_kind = 'cta_click' then 1 else 0 end,
    updated_at = now();
end;
$$;

-- ── Reading ──────────────────────────────────────────────────────────────

/**
 * Exposures and clicks per arm, aggregated in Postgres.
 *
 * Aggregated here rather than in the dashboard because PostgREST silently
 * truncates at 1000 rows, and a counter keyed on eight columns crosses that
 * long before the numbers get interesting. A dashboard that summed a
 * truncated page would report a confident wrong answer.
 */
create or replace function public.split_test_exposures(p_since date)
returns table (
  test_key   text,
  variant    text,
  currency   text,
  surface    text,
  exposures  bigint,
  cta_clicks bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.test_key,
    e.variant,
    e.currency,
    e.surface,
    sum(e.exposures)::bigint,
    sum(e.cta_clicks)::bigint
  from public.split_test_events_daily e
  where e.day >= p_since
  group by e.test_key, e.variant, e.currency, e.surface
$$;

/**
 * Conversions per arm, from the stamp the webhook left on each one.
 *
 * The lateral unnest is what lets one conversion count for every test it was
 * exposed to: a sale made while two tests were running is a row for each,
 * which is correct — both arms were in play and both want credit or blame.
 *
 * `currency` comes off the conversion itself, not off the exposure, because
 * it is what the customer was actually charged in.
 */
create or replace function public.split_test_conversions(p_since date)
returns table (
  test_key     text,
  variant      text,
  currency     text,
  event_type   text,
  conversions  bigint,
  value_cents  bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.key,
    s.value,
    coalesce(mc.currency, ''),
    mc.event_type,
    count(*)::bigint,
    coalesce(sum(mc.value_cents), 0)::bigint
  from public.marketing_conversions mc
  cross join lateral jsonb_each_text(mc.split_tests) as s(key, value)
  where mc.occurred_at >= p_since
  group by s.key, s.value, coalesce(mc.currency, ''), mc.event_type
$$;

-- ── The first test, seeded as draft ──────────────────────────────────────

-- Status is 'draft' and STAYS draft until someone decides to price at this.
-- Draft means every visitor is served the control, so this row changes
-- nothing customer-facing by existing.
--
-- Arm b's Stripe price (live mode, created 2026-08-30, lookup key
-- pro_annual_v2) is CA$45.00 / US$39.00 yearly on the existing ReelCaster Pro
-- product. Its id belongs in STRIPE_ANNUAL_PRICE_ID_B on the Vercel project
-- when the test is meant to run, and nowhere else.
insert into public.split_tests (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'price_annual_v2',
  'Annual price: $33 vs $45 CAD / $39 USD',
  'payment',
  'draft',
  'Pro is underpriced at $33/yr. A higher price should cost some conversion rate and still raise revenue per exposure. The test is decided on revenue per exposure, not on conversion rate, because conversion rate alone always prefers the cheaper arm.',
  'paid_conversion',
  true
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  (
    'price_annual_v2', 'a', '$33/yr (current)', 50, true,
    '{"price_env": "STRIPE_ANNUAL_PRICE_ID", "cents": {"cad": 3300, "usd": 3300}}'::jsonb
  ),
  (
    'price_annual_v2', 'b', '$45 CAD / $39 USD', 50, false,
    '{"price_env": "STRIPE_ANNUAL_PRICE_ID_B", "cents": {"cad": 4500, "usd": 3900}}'::jsonb
  )
on conflict (test_key, variant) do nothing;
