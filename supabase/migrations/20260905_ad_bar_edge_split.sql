-- The ad frame's bar: top edge (today) against the bottom edge it wore on
-- 2026-09-02, the frame's best day (39 paywall views, 5 trials and a purchase;
-- 2 trials the next day, none the day after, once the bar had moved to the
-- top and every spot open forced the offer). A treatment test, no price in
-- it; both arms open the same modal at the control price.
--
-- Arm a is the top edge, unchanged.
-- Arm b is the bottom edge: src/app/components/split-test/use-ad-bar-edge.ts,
-- read by the framed Explore map and the framed spot page.
--
-- Inserted as running: a deploy that does not know the key serves arm a to
-- everyone and counts nothing, so this is live the moment the code is.
-- Stop it with: update split_tests set status='concluded', stopped_at=now()
-- where key='ad_bar_edge_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, started_at)
values (
  'ad_bar_edge_v1',
  'Ad frame bar: top edge vs bottom edge',
  'treatment',
  'running',
  'The bar at the bottom of the screen, under a thumb, is pressed more than the same bar at the top, and the framed map and spot page start more trials per exposure with it there.',
  'paid_conversion',
  false,
  now()
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('ad_bar_edge_v1', 'a', 'Top edge (today)', 50, true,  '{"edge":"top"}'),
  ('ad_bar_edge_v1', 'b', 'Bottom edge',      50, false, '{"edge":"bottom"}')
on conflict (test_key, variant) do nothing;
