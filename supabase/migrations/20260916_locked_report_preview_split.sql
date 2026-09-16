-- The locked Recent reports card on the spot page. Arm a is today: the
-- lavender "Upgrade to Pro for the full report" row under the cut-off
-- headline. Arm b: grey placeholder rows in the shape of the Pro report, with
-- the offer on a card over them and a solid button ("Start free trial" signed
-- out, "Get Pro" signed in). Same trial modal behind both arms.
--
-- Code: src/app/components/split-test/use-locked-report-preview.ts, read by
-- RecentReportsBand in src/app/explore/components/recent-reports.tsx. Covers
-- the spot page and the phone spot sheet (both mount SpotDetailShell), never
-- the ad frame. Surface: `spot_reports`. Exposure = the locked card rendered
-- with an arm; cta_click = the card pressed.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='locked_report_preview_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='locked_report_preview_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'locked_report_preview_v1',
  'Locked spot report: upgrade row vs placeholder preview',
  'treatment',
  'draft',
  'Showing the shape of the full report behind a solid trial button gets more presses on the locked Recent reports card than the upgrade row, without fewer trials per exposure.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('locked_report_preview_v1', 'a', 'Upgrade row (today)', 50, true,  '{"card":"upgrade_row"}'),
  ('locked_report_preview_v1', 'b', 'Placeholder preview', 50, false, '{"card":"preview"}')
on conflict (test_key, variant) do nothing;
