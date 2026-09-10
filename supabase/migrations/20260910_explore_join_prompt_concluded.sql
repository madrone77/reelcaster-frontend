-- explore_join_prompt_v1 concluded for the control.
--
-- Three days, 58 exposures: arm a 26 exposures / 23 walls / 2 trials, arm b
-- 32 / 24 / 2. Zero recorded CTA clicks on either arm. That is a dead heat on
-- a sample far too small to call, so the two-screen join prompt has not earned
-- a permanent place and the walls go back to <ProTrialModal>.
--
-- No code change goes with this, which is the point of concluding rather than
-- deploying a winner: a concluded test stops being dealt, the arm drops out of
-- rc_split on the next visit, and explore-wall.tsx falls through to arm a on
-- its own. JoinPromptModal and PlanChoiceModal are left in the tree, unreached,
-- so this is one row away from being run again with real traffic behind it.
--
-- Applied to the ReelCaster project via MCP alongside this commit, since
-- migration CI has been unauthorized for a while.

update public.split_tests
set status = 'concluded',
    winner = 'a',
    stopped_at = now(),
    updated_at = now()
where key = 'explore_join_prompt_v1';
