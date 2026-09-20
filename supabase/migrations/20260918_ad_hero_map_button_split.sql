-- The ad hero's second button. Arm a is today: "Try Pro free" filled beside
-- "Explore the map" outlined. Arm b: the trial button alone. Same trial modal
-- behind both arms.
--
-- Code: src/app/components/split-test/use-ad-hero-map.ts, read by the spot
-- ad page (spot-detail-shell.tsx, surface `spot_ad_hero`) and the city ad
-- page (ad/city-ad-view.tsx, surface `city_ad_hero`), only inside an ad frame
-- at the `today` wall. Never the public pages' SEO hero. Exposure = the hero
-- rendered with an arm; cta_click = the trial button pressed.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='ad_hero_map_button_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='ad_hero_map_button_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'ad_hero_map_button_v1',
  'Ad hero: trial + map buttons vs trial only',
  'treatment',
  'draft',
  'Dropping the "Explore the map" button from the ad hero at the today wall gets more trial presses per exposure, without fewer trials per exposure.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('ad_hero_map_button_v1', 'a', 'Trial + map (today)', 50, true,  '{"map_button":true}'),
  ('ad_hero_map_button_v1', 'b', 'Trial only',          50, false, '{"map_button":false}')
on conflict (test_key, variant) do nothing;
