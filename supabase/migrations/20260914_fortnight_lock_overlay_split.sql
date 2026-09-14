-- The locked tail of the spot page's 14-day strip, for signed-out visitors.
-- Arm a is today: a grey padlock tile per locked day. Arm b: the locked days
-- as blank white tiles (weekday and date, nothing below) under one panel,
-- "See all 14 days with ReelCaster Pro", with the same trial button the bar
-- carries.
--
-- Code: src/app/components/split-test/use-fortnight-lock.ts, read by
-- spot-detail-shell.tsx and explore/components/forecast-strip.tsx; arm b is
-- explore/components/locked-fortnight-overlay.tsx.
-- Surfaces: `spot_strip` (spot page), `ad_spot_strip` (its ad frame),
-- `sheet_spot_strip` (the spot sheet on Explore), `explore_strip` (Explore's
-- desktop strip), `ad_explore_strip` (the same on its ad frame), never pooled.
-- Exposure = the strip drawn with a locked day to a signed-out visitor.
-- cta_click = a padlock tapped (a) or the panel button pressed (b). Arm b is
-- a bigger button and will win presses by construction; judge it on trials
-- started and trial-to-paid per exposure.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='fortnight_lock_overlay_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='fortnight_lock_overlay_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'fortnight_lock_overlay_v1',
  'Spot page locked days: padlock tiles vs one Pro panel',
  'treatment',
  'draft',
  'Showing the locked days as ordinary blank tiles under one "See all 14 days with ReelCaster Pro" panel starts more trials per signed-out exposure than a padlock per day, without a lower trial-to-paid rate.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('fortnight_lock_overlay_v1', 'a', 'Padlock tiles (today)', 50, true,  '{}'),
  ('fortnight_lock_overlay_v1', 'b', 'One Pro panel',         50, false, '{}')
on conflict (test_key, variant) do nothing;
