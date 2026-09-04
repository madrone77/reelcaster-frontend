-- The phone trial sheet: three lines and a timeline (today) against the whole
-- Pro tier with a testimonial. A treatment test, no price in it; the arms are
-- two layouts of the same offer and both charge the control price.
--
-- Arm a is src/app/components/paywall/trial-sheet.tsx, unchanged.
-- Arm b is src/app/components/paywall/trial-sheet-pro.tsx.
--
-- Inserted as running: a deploy that does not know the key serves arm a to
-- everyone and counts nothing, so this is live the moment the code is.
-- Stop it with: update split_tests set status='concluded', stopped_at=now()
-- where key='trial_sheet_pro_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, started_at)
values (
  'trial_sheet_pro_v1',
  'Phone trial sheet: three lines + timeline vs full Pro list + testimonial',
  'treatment',
  'running',
  'The control reads clean and does not convert. Listing all seven Pro rows and a customer quote in place of the timeline lifts trial starts per exposure.',
  'paid_conversion',
  false,
  now()
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('trial_sheet_pro_v1', 'a', 'Three lines + timeline (today)', 50, true,  '{"sheet":"timeline"}'),
  ('trial_sheet_pro_v1', 'b', 'Full Pro list + testimonial',    50, false, '{"sheet":"pro"}')
on conflict (test_key, variant) do nothing;
