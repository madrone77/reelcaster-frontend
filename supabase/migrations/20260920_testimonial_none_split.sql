-- The testimonial in the paywall modals, or none. Arm a is today's single
-- quote: Pro label, five small gold stars, the words, the name in mono (Bob,
-- or Nick for a Washington reader). Arm b renders nothing where the quote
-- would be. Two tests on this surface kept the single quote
-- (testimonial_swipe_v1, testimonial_byline_v1); this one asks whether the
-- quote earns its place at all (Casey, 2026-09-20).
--
-- Code: src/app/components/split-test/use-testimonial-none.ts, read by
-- <Testimonial> in src/app/components/paywall/testimonial.tsx, which the trial
-- sheet, plan choice sheet, Pro upsell and desktop plan matrix all render.
-- Surface: `testimonial`. Exposure = a modal opened with an arm in force,
-- counted on both arms. No cta_click; the primary metric is paid conversion.
-- Denominator is sessions (started after the session log began).
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='testimonial_none_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='testimonial_none_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, example_path)
values (
  'testimonial_none_v1',
  'Paywall testimonial: one quote with gold stars vs no testimonial',
  'treatment',
  'draft',
  'A paywall modal with no customer quote, the buy button that much nearer the price, converts at least as well per session as the modal with today''s single five-star quote.',
  'paid_conversion',
  false,
  '/fishing/us/wa/seattle?ad=today'
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('testimonial_none_v1', 'a', 'One quote, gold stars (today)', 50, true,  '{"testimonial":"single"}'),
  ('testimonial_none_v1', 'b', 'No testimonial', 50, false, '{"testimonial":"none"}')
on conflict (test_key, variant) do nothing;
