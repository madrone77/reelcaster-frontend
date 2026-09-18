-- The testimonial in the paywall modals. Arm a is the single quote as it stood
-- after testimonial_swipe_v1: Pro label, five small gold stars, the quote, the
-- name in mono. Arm b is a sideways row of three review cards, each with a
-- circle of initials beside the name and the place under it, Trustpilot-style
-- green tiles with the score, then the quote. One test for the whole change.
--
-- Code: src/app/components/split-test/use-testimonial-byline.ts, read by
-- <Testimonial> in src/app/components/paywall/testimonial.tsx, which the trial
-- sheet, plan choice sheet, Pro upsell and desktop plan matrix all render.
-- Surface: `testimonial`. Exposure = the card row rendered with an arm. No
-- cta_click; the primary metric is paid conversion.
--
-- Inserted as DRAFT. Flip to running only after the deploy is verified live:
--   update split_tests set status='running', started_at=now()
--   where key='testimonial_byline_v1';
-- Stop it with:
--   update split_tests set status='concluded', stopped_at=now()
--   where key='testimonial_byline_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency)
values (
  'testimonial_byline_v1',
  'Paywall testimonial: one quote with gold stars vs three review cards with byline and tile stars',
  'treatment',
  'draft',
  'Three anglers in a sideways row, each card opening with the person (initials circle, name, place) and Trustpilot-style tile stars, start more trials per exposure than one quote with gold stars.',
  'paid_conversion',
  false
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('testimonial_byline_v1', 'a', 'One quote, gold stars (today)', 50, true,  '{"testimonial":"single"}'),
  ('testimonial_byline_v1', 'b', 'Three review cards, byline + tiles', 50, false, '{"testimonial":"review_row"}')
on conflict (test_key, variant) do nothing;
