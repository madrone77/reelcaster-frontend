-- Where to look at a test.
--
-- The admin split-tests page links every test to an example: the surface
-- drawn as each arm, at phone and desktop width, from the live site with
-- `?rc_arm=<test>:<variant>` on the URL (src/lib/split-preview.ts). The page
-- needs to know which URL carries the surface, and that is a fact about the
-- test, so it lives on the registry row beside the rest.
--
-- A path, not a URL: the admin page knows the site. Query strings the surface
-- needs (the ad frame's `?ad=today`) belong in the path; the arm is appended.
-- NULL means there is nothing to look at from a URL alone: a payment arm's
-- price is resolved on the server and no client-side lens can draw it.

alter table public.split_tests
  add column if not exists example_path text;

comment on column public.split_tests.example_path is
  'Site path that draws this test''s surface for a signed-out reader, with any query the surface needs. The admin example page appends ?rc_arm=<key>:<variant>. NULL when no URL alone shows the arms.';

update public.split_tests set example_path = '/explore?ad=today'
  where key = 'explore_locked_spots_v1';
update public.split_tests set example_path = '/fishing/wa/seattle?ad=today'
  where key = 'ad_hero_map_button_v1';
-- The phone sheet opens from the hero's trial button; the arm holds for the tab.
update public.split_tests set example_path = '/fishing/wa/seattle?ad=today'
  where key = 'plan_picker_v1';
