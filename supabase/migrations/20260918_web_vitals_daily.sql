-- Page speed as the reader's browser measured it, per day, surface and metric.
--
-- Nothing measured load time before this. Vercel Speed Insights has no read
-- API, and the admin's Mission Control wanted Explore, spot page and city
-- page load times as a health tile next to scoring freshness. So the app
-- reports its own Core Web Vitals (next/web-vitals → POST /api/web-vitals)
-- and the admin reads them back from here.
--
-- HISTOGRAM COUNTERS, NOT AN EVENT LOG. A percentile needs a distribution,
-- and a raw sample per page load would be tens of thousands of rows a day
-- with nothing to purge them. Instead each (day, surface, metric) keeps one
-- counter per histogram bucket plus the sum of the values that fell in it,
-- so p50 / p75 / p95 are read back as the mean of the bucket the percentile
-- lands in: exact to within a bucket's width, which is what a trend needs.
-- Same trade as traffic_events_daily: no visitor id, no user id, no IP,
-- nothing finer than the day.
--
-- The bucket edges live in the app (src/lib/web-vitals-buckets.ts) and in
-- BlueCaster (lib/web-vitals.ts) and must match; the table stores only the
-- bucket index. CLS is stored ×1000 so one integer scale serves every metric.
--
-- Migration CI is unauthorized; applied to the ReelCaster project via MCP
-- alongside this commit.

create table if not exists public.web_vitals_daily (
  day        date    not null,
  -- explore | spot | city | home | lp | other. See surfaceFor in the reporter.
  surface    text    not null,
  -- LCP | TTFB | FCP | INP | CLS
  metric     text    not null,
  -- Index into the shared bucket edges; the last index is the open top bucket.
  bucket     smallint not null,
  samples    integer not null default 0,
  -- Sum of the raw values in this bucket, so a bucket's mean can be read back.
  sum_value  double precision not null default 0,
  updated_at timestamptz not null default now(),
  primary key (day, surface, metric, bucket)
);

alter table public.web_vitals_daily enable row level security;
-- No policies: the service role writes through the function below, the admin
-- reads with its service key, and nobody else has a reason to see it.

-- One call per beacon, many samples: the reporter batches what it saw on a
-- page and posts once on pagehide. p_rows is a JSON array of
-- {surface, metric, bucket, value}; the day is the server's Pacific day so
-- every row of a beacon lands on the same day the admin buckets by.
create or replace function public.bump_web_vitals(p_day date, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Grouped first: one INSERT may not touch the same conflict key twice,
  -- and two LCP samples from one page can share a bucket.
  insert into public.web_vitals_daily as t (day, surface, metric, bucket, samples, sum_value)
  select
    p_day,
    left(r->>'surface', 16),
    left(r->>'metric', 8),
    least(greatest((r->>'bucket')::int, 0), 32),
    count(*)::int,
    sum((r->>'value')::double precision)
  from jsonb_array_elements(p_rows) as r
  where r ? 'surface' and r ? 'metric' and r ? 'bucket' and r ? 'value'
  group by 2, 3, 4
  on conflict (day, surface, metric, bucket)
  do update set
    samples    = t.samples + excluded.samples,
    sum_value  = t.sum_value + excluded.sum_value,
    updated_at = now();
end;
$function$;

revoke all on function public.bump_web_vitals(date, jsonb) from public, anon, authenticated;
