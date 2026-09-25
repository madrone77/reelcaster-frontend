-- sheet_names_wall_v1: the phone sheet opened by a LOCKED thing names what
-- was tapped ("See Friday, Sep 25 in Seattle") over the offer, against the
-- sheet as it stands. Treatment test, phone only, surface `sheet_wall`.
-- Inserted as DRAFT; flip to running only once the FE deploy is live.
insert into split_tests (key, name, status, hypothesis, example_path, surface_kind, primary_metric, split_by_currency)
values (
  'sheet_names_wall_v1',
  'Phone sheet from a locked tap: plain offer vs naming what was tapped',
  'draft',
  'A sheet opened by tapping a locked day, spot, report or custom spot gets more Start taps and trials per session when its first line names the thing tapped ("See Friday, Sep 25 in Seattle") than with the plain offer. Sheets from a lock get a Start tap ~7% of the time vs 24-29% when the reader asked.',
  '/fishing/us/wa/seattle?ad=today',
  'treatment',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('sheet_names_wall_v1', 'a', 'Plain offer (as it stands)', 50, true, '{"named": false}'::jsonb),
  ('sheet_names_wall_v1', 'b', 'Names what was tapped', 50, false, '{"named": true}'::jsonb)
on conflict do nothing;
