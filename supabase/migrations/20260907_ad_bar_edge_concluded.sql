-- ad_bar_edge_v1 is decided: the bottom edge (arm b). Casey's call,
-- 2026-09-07, on 676 exposures: b pressed the bar 36 times in 350 against
-- a's 29 in 326, and the trials were level at 3 each. Both framed surfaces
-- (the Explore map and the spot page) now pass adBarEdge="bottom" with no
-- arm read at all; src/app/components/split-test/use-ad-bar-edge.ts is
-- gone. Concluding removes the key from every rc_split cookie, which is
-- harmless because nothing reads it.
--
-- On 2026-09-07 the weights were set to a=0 / b=100 with the row still
-- running, so the bottom edge reached every new visitor before this code
-- deployed. Apply this AFTER the deploy: a concluded test on the old code
-- falls back to the top edge.

update public.split_tests
   set status = 'concluded',
       winner = 'b',
       stopped_at = now(),
       updated_at = now()
 where key = 'ad_bar_edge_v1'
   and status <> 'concluded';
