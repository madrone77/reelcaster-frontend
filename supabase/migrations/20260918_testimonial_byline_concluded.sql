-- testimonial_byline_v1 concluded for the control, 2026-09-18.
--
-- Three and a half hours, 25 exposures: arm a 10 exposures / 22 walls / 0
-- trials, arm b 15 / 19 / 0. Zero presses and zero trials on either arm, so
-- there is nothing to read and Casey pulled it rather than let it run on:
-- the plan picker test (plan_picker_v1) started the same afternoon on the
-- same sheet, and one change at a time is the rule.
--
-- No code change goes with this. With no arm assigned the hook in
-- src/app/components/split-test/use-testimonial-byline.ts returns arm a, the
-- single quote with gold stars, in every modal. The three-card row is left in
-- the tree for the row under the chart on ad and landing pages, which never
-- was in the test.
--
-- Applied to the ReelCaster project via MCP alongside this commit, since
-- migration CI has been unauthorized for a while.

update public.split_tests
set status = 'concluded',
    winner = 'a',
    stopped_at = now(),
    updated_at = now()
where key = 'testimonial_byline_v1';
