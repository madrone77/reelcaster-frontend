-- ad_intro_v1 is decided: the intro card (arm b). Casey's call, 2026-09-09,
-- on 2,220 exposures. Arm b: 1,076 exposures, 99 "Got it" presses (9.2%),
-- 5 trials (0.5%). Arm a (nothing): 1,144 exposures, 2 trials (0.2%). The
-- card's readers reached the wall LESS often (209 against 346) and started
-- the trial more often, which is the shape the hypothesis wanted at the end
-- and not at the middle; neither gap is significant and no sale landed on
-- either arm. The card is now a decision, not a rule under test.
--
-- Every `?ad=day2` visitor gets it: explore-shell mounts
-- src/app/explore/components/ad-intro-card.tsx on the wall alone with no arm
-- read, and src/app/components/split-test/use-ad-intro.ts is deleted. The
-- card keeps its own Mixpanel pair (Ad Intro Shown / Dismissed) and its once
-- per tab sessionStorage; only the split counters go. Concluding removes the
-- key from every rc_split cookie, which is harmless because nothing reads it.
--
-- On 2026-09-09 the weights were set to a=0 / b=100 with the row still
-- running, so the card reached every new visitor before this code deployed.
-- Apply this AFTER the deploy: a concluded test on the old code shows the
-- card to nobody.

update public.split_tests
   set status = 'concluded',
       winner = 'b',
       stopped_at = now(),
       updated_at = now()
 where key = 'ad_intro_v1'
   and status <> 'concluded';
