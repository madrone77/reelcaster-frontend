-- The words on the top bar's signed-out trial button. Arm a is today:
-- "Start free trial". Arm b: "Try Pro free". Same button, same width, same
-- trial modal behind it on both arms.
--
-- Code: src/app/components/split-test/use-trial-cta-label.ts, read by
-- TrialCtaButton in src/app/explore/components/explore-top-bar.tsx. Covers
-- every page that mounts that bar signed out (Explore, the spot page, and the
-- ad frame on both). Surfaces: `topbar` (product bar) and `ad_topbar` (the ad
-- frame's bar), never pooled. Exposure = the button rendered with an arm;
-- cta_click = the button pressed. The read is presses per exposure, then
-- trials per exposure downstream.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live,
-- or arms get handed out while the bar still reads the control on both:
--   update split_tests set status='running', started_at=now()
--   where key='trial_cta_label_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='trial_cta_label_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'trial_cta_label_v1',
  'Top bar trial button: "Start free trial" vs "Try Pro free"',
  'treatment',
  'draft',
  'Naming the plan ("Try Pro free") gets more presses on the top bar button than naming the trial, without fewer trials per exposure.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('trial_cta_label_v1', 'a', 'Start free trial (today)', 50, true,  '{"label":"Start free trial"}'),
  ('trial_cta_label_v1', 'b', 'Try Pro free',             50, false, '{"label":"Try Pro free"}')
on conflict (test_key, variant) do nothing;
