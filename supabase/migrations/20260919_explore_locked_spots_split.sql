-- Locked spots on the ad-framed Explore map. Arm a is today: every pin shows
-- its score. Arm b: a stable three in five of the pins wear a padlock instead of a
-- score, and a tap on one opens the Pro wall. The spot the visitor landed on
-- (`?spot=`) and the mark the city ad page featured (`?keep=`) stay open.
--
-- Code: src/app/components/split-test/use-locked-spots.ts, read by
-- src/app/explore/explore-shell.tsx, the city page chart and the hero reel
-- for every signed-out viewer (widened from ad traffic only on 2026-09-19). The lock
-- rule is src/app/explore/lib/spot-locks.ts. Exposure = the framed map
-- rendered with an arm; cta_click = a lock pressed.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='explore_locked_spots_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='explore_locked_spots_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'explore_locked_spots_v1',
  'Ad map: locked pins vs open map',
  'treatment',
  'draft',
  'Locking about 60% of the pins on the ad-framed map, with the landing spot left open, earns more trials per exposure than a fully open map.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('explore_locked_spots_v1', 'a', 'Open map',    50, true,  '{"locks":false}'),
  ('explore_locked_spots_v1', 'b', 'Locked pins', 50, false, '{"locks":true}')
on conflict (test_key, variant) do nothing;
