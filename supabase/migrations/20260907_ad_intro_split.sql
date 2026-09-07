-- Orientation on landing for the cold ad visitor. `?ad=day2` drops Meta
-- traffic onto the live Explore map with nothing in between, and the first
-- thing the visit does is a tap on a dot or a tap on Back. Arm b shows three
-- lines over the map once per tab: what the dots are, what the number means,
-- tap one to see when to go. One "Got it" button. No trial, no Pro, no
-- price; the wall's free spot opens and the trial modal run as before on
-- both arms. Arm a is today: nothing.
--
-- Code: src/app/explore/components/ad-intro-card.tsx, gated by
-- src/app/components/split-test/use-ad-intro.ts. Exposure = the framed
-- Explore rendered with an arm; cta_click = the button (acknowledged, not
-- tapped past). The read is downstream: walls and trials per exposure.
--
-- Inserted as running: a deploy that does not know the key serves arm a to
-- everyone and counts nothing, so this is live the moment the code is.
-- Stop it with: update split_tests set status='concluded', stopped_at=now()
-- where key='ad_intro_v1';

insert into public.split_tests
  (key, name, surface_kind, status, hypothesis, primary_metric, split_by_currency, started_at)
values (
  'ad_intro_v1',
  'Ad frame (day2): three lines of orientation on landing vs nothing',
  'treatment',
  'running',
  'A cold visitor told what the dots are and what to do with one taps a spot rather than leaving, and reaches the wall and the trial more often per exposure.',
  'paid_conversion',
  false,
  now()
)
on conflict (key) do nothing;

insert into public.split_test_variants (test_key, variant, label, weight, is_control, config)
values
  ('ad_intro_v1', 'a', 'No card (today)',                 50, true,  '{"intro":false}'),
  ('ad_intro_v1', 'b', 'Intro card: You''re on the live map', 50, false, '{"intro":true}')
on conflict (test_key, variant) do nothing;
