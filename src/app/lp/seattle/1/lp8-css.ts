/**
 * /lp/8's own stylesheet.
 *
 * Self-contained rather than an addition to `_shared/lp-css.ts`, for the same
 * reason /lp/1 keeps its own: that file describes a 480px phone column with a
 * feature list and a sticky value anchor, and this page is a full-width
 * landing page with a two-column hero. Extending it would mean bending every
 * shared rule around a layout no other variant uses, and any mistake there
 * would land on /lp/2, /lp/3, /lp/5, /lp/6 and /lp/7 while they are mid-test.
 *
 * Every colour is a v1.0 design-system token read off `rc-tokens.css`. They
 * are restated as local custom properties rather than referenced through the
 * Tailwind `rc-*` utilities because this block is one injected <style> and
 * has to stand on its own.
 *
 * One rule worth not relearning: emerald is accent-on-navy only. The score
 * spectrum (--l8-good and friends) is DATA and always sits on paper. They are
 * never adjacent and never substitute for each other.
 */
export const LP8_CSS = `
.l8{
  --l8-brand:#2536D9; --l8-brand-hover:#1C29A8;
  --l8-ink:#12151A; --l8-ink-soft:#5A616B; --l8-ink-mute:#8A919C;
  --l8-panel:#FFFFFF; --l8-surface:#EDEFF1; --l8-bg:#F5F6F7;
  --l8-rule:#E2E5E9; --l8-rule-soft:#EDEFF1;
  --l8-navy:#0F1B3D;
  /* The hero's own grey. A step darker than --l8-bg and --l8-surface so the
     white band below it reads as a change rather than a rendering artefact,
     and light enough that ink type on it clears contrast without going black
     on white. It is a separate token from --l8-surface because that one is a
     component fill (meter tracks, chips) and would drag them along. */
  --l8-hero:#E6E9ED;
  --l8-emerald:#34D399; --l8-emerald-deep:#047857;
  --l8-good:#3D8B4F; --l8-good-bg:#DCFCE7; --l8-good-ink:#1B6B41; --l8-good-border:#BBF7D0;
  --l8-fair:#C97A1C; --l8-fair-bg:#FEF3C7;
  --l8-poor:#B23A2F; --l8-poor-bg:#FEE2E2;
  --l8-mono:var(--font-plex-mono,"IBM Plex Mono"),ui-monospace,SFMono-Regular,monospace;
  --l8-gut:clamp(20px,5vw,64px);

  background:var(--l8-bg); color:var(--l8-ink);
  font-size:16px; font-weight:500; line-height:1.5;
}
.l8 *{box-sizing:border-box}
.l8 .shell{max-width:1180px;margin:0 auto;padding-inline:var(--l8-gut)}
.l8 section{padding-block:clamp(48px,7vw,88px)}
.l8 .lab{
  font-family:var(--l8-mono);font-size:11px;font-weight:600;text-transform:uppercase;
  letter-spacing:.1em;color:var(--l8-ink-soft);margin:0 0 16px;display:block;
}
.l8 h2{font-size:clamp(26px,3.6vw,38px);font-weight:700;line-height:1.12;letter-spacing:-.025em;margin:0 0 14px;text-wrap:balance}
.l8 .sub{font-size:clamp(16px,1.7vw,18px);line-height:1.6;color:var(--l8-ink-soft);margin:0;max-width:60ch}

/* nav */
.l8 .nav{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.93);backdrop-filter:blur(8px);border-bottom:1px solid var(--l8-rule)}
.l8 .navin{max-width:1180px;margin:0 auto;padding:0 var(--l8-gut);height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px}
/* The mark, not the word set in the body face. Height-driven with width
   auto, so the 144x66 box keeps its aspect whatever next/image writes into
   the width/height attributes. 36px in a 60px bar puts the knockout letters
   at about the 15px the typed wordmark ran at, which is why the bar did not
   have to change height. */
.l8 .navmark{height:36px;width:auto;display:block}
.l8 .navcta{
  font-size:14px;font-weight:600;color:#fff;background:var(--l8-brand);border:0;border-radius:8px;
  padding:9px 16px;cursor:pointer;text-decoration:none;transition:background .15s;white-space:nowrap;
}
.l8 .navcta:hover{background:var(--l8-brand-hover)}
.l8 .navcta:focus-visible{outline:2px solid var(--l8-brand);outline-offset:3px}

/* hero.
   Light grey, not navy. Everything below is re-tuned for paper rather than
   inverted from the dark version: a light band with dark-band type on it is
   how a hero ends up legible but flat.

   The bottom rule is not decoration. The section under this one is
   --l8-panel white, and two light surfaces meeting with nothing between them
   read as one surface with a seam. */
.l8 .hero{
  background:var(--l8-hero);color:var(--l8-ink);
  padding-block:clamp(44px,6vw,80px);overflow:hidden;
  border-bottom:1px solid var(--l8-rule);
}
.l8 .herogrid{display:grid;grid-template-columns:1fr;gap:clamp(32px,4vw,56px);align-items:center}
@media(min-width:940px){.l8 .herogrid{grid-template-columns:1.02fr .98fr}}
/* min-width:0 is load-bearing, not hygiene.
   An fr track sizes to minmax(auto, 1fr), and that "auto" minimum is the
   item's min-content width. The phone in the second column is a container
   query root whose CHILDREN are sized from its own resolved width, so the
   track was asking the phone how wide it wanted to be, while the phone was
   asking the track. Chrome settles that by converging over many frames: the
   phone crept wider frame after frame, and because the preview card's entrance
   animation is keyed off the same custom property, it was restarted on every
   one of those frames and never finished -- a card sitting at opacity 0.4,
   0.6, 0.9 and, if you caught it early enough, invisible.
   Zeroing the minimum makes the track sizing independent of the content, which
   ends the negotiation. */
.l8 .herogrid > *{min-width:0}
/* The reel is conditional: no payload, no phone. Without this the copy would
   keep sitting in a half-width column beside an empty one, which reads as an
   image that failed to load rather than a page that never had one. */
.l8 .herogrid > div:only-child{grid-column:1 / -1}
.l8 .pin{display:inline-flex;align-items:center;gap:9px;font-family:var(--l8-mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--l8-ink-soft);margin:0 0 20px}
/* The live dot goes to the deep emerald: #34D399 was picked to glow on navy
   and on grey it is a pale smudge at 7px. The halo follows it, or the dot
   sits in a ring of the colour it used to be. */
.l8 .pin i{width:7px;height:7px;border-radius:999px;background:var(--l8-emerald-deep);box-shadow:0 0 0 4px rgba(4,120,87,.14)}
.l8 h1{font-size:clamp(34px,5.4vw,58px);font-weight:700;line-height:1.03;letter-spacing:-.033em;margin:0 0 20px;color:var(--l8-ink);text-wrap:balance}
/* "go", and the one green on this page that is not data.
   --l8-emerald is accent-on-navy and vanishes here; --l8-good is the score
   spectrum and is spoken for. --l8-emerald-deep is the same accent family
   built for paper, which is what this band now is. */
.l8 h1 em{font-style:normal;color:var(--l8-emerald-deep)}
.l8 .herosub{font-size:clamp(16px,1.9vw,19px);line-height:1.55;color:var(--l8-ink-soft);margin:0 0 28px;max-width:46ch}

/* day card: the product, shown working */
.l8 .day{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.16);border-radius:16px;padding:clamp(16px,2.4vw,24px)}
.l8 .dayhead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:20px}
.l8 .dayspot{font-size:18px;font-weight:600;color:#fff;line-height:1.25}
.l8 .daymeta{font-family:var(--l8-mono);font-size:12px;color:#8FA3BC;margin-top:5px}
.l8 .daynum{font-size:clamp(38px,5vw,52px);font-weight:700;line-height:.9;letter-spacing:-.045em;color:var(--l8-emerald);font-variant-numeric:tabular-nums;text-align:right}
.l8 .daynum small{display:block;font-family:var(--l8-mono);font-size:10px;font-weight:600;letter-spacing:.11em;color:#8FA3BC;margin-top:8px}
.l8 .bars{display:flex;align-items:flex-end;gap:clamp(2px,.5vw,4px);height:clamp(110px,15vw,150px)}
.l8 .bars i{flex:1;display:block;border-radius:3px 3px 0 0;background:rgba(255,255,255,.14);transform-origin:bottom;animation:l8rise .5s cubic-bezier(.2,.8,.3,1) both}
.l8 .bars i.on{background:var(--l8-emerald)}
.l8 .bars i.dim{background:rgba(255,255,255,.085)}
@keyframes l8rise{from{transform:scaleY(.02);opacity:0}to{transform:scaleY(1);opacity:1}}
.l8 .hrs{display:flex;justify-content:space-between;font-family:var(--l8-mono);font-size:11px;color:#8FA3BC;margin-top:10px}
.l8 .bracket{margin-top:16px;padding-top:16px;border-top:1px solid rgba(255,255,255,.14);display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.l8 .tag{display:inline-flex;align-items:center;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;background:var(--l8-emerald-deep);color:#fff}
.l8 .tag.plain{background:rgba(255,255,255,.11);color:#C3D0E0;font-weight:500}

/* THE ASK.
   One link into Explore, on navy in the hero and on navy again at the close,
   which is why the focus ring is emerald rather than brand: a brand-blue ring
   around a brand-blue button on a navy panel is invisible.

   Sized a step larger than .mapcta on purpose. That one is a next step offered
   to somebody already reading the marks; this is the page's ask, and the two
   sitting at the same weight read as two equal options. */
.l8 .go{
  display:inline-flex;align-items:center;gap:10px;
  background:var(--l8-brand);color:#fff;text-decoration:none;
  font-size:17px;font-weight:600;padding:15px 26px;border-radius:10px;
  transition:background .15s ease;
}
.l8 .go:hover{background:var(--l8-brand-hover)}
.l8 .go:focus-visible{outline:2px solid var(--l8-emerald);outline-offset:3px}
/* Brand blue on grey carries itself; what it needs is a ring that is not
   also blue. Emerald is kept for the close band, which is still navy. */
.l8 .hero .go:focus-visible{outline-color:var(--l8-ink)}

/* What the free tier actually opens, in the same mono the terms line used.
   It sits under the button for the reason the trial terms did: the limit is
   part of the offer, and an offer qualified further down the page is a
   qualification the reader meets after deciding. */
.l8 .gonote{font-family:var(--l8-mono);font-size:12px;line-height:1.65;color:var(--l8-ink-soft);margin:14px 0 0;max-width:46ch}
/* Stacked layout only: the ask and its qualifier centre over the phone.
   Below 940px the hero is one column with the phone centred under it, so a
   left-hung button sat off the axis everything else in that column shares.
   The two-column hero keeps them left, where the button belongs to the text
   column beside the phone rather than to the page. */
@media(max-width:939px){
  .l8 #start{text-align:center}
  .l8 #start .gonote{margin-inline:auto}
}
/* The close is still navy, so its copy of this line keeps the navy colour. */
.l8 .close .gonote{color:#8FA3BC;margin-inline:auto}

/* THE PRODUCT SHOTS.
   Both heroes are real marketing renders with their callouts baked in, so the
   page cannot drift away from the app the way a hand-drawn approximation
   does. They carry their own transparent margin, hence the negative insets:
   without them the arrow's empty gutter reads as a layout mistake. */
.l8 .stage{position:relative;display:flex;justify-content:center}
.l8 .shot{
  height:auto;display:block;margin-inline:auto;
  /* The renders are 1820px tall. Unbounded, the hero grows past a laptop
     viewport and pushes everything under it off the first screen, so the
     HEIGHT is what gets capped and the width follows from it.
     max-width must therefore include 100%: with width:auto the width is
     derived from the height, so on a narrow phone the image computes ~527px,
     and because a grid item defaults to min-width:auto that widens the whole
     track and pushes the text column off screen with it. A bare 520px cap
     never bites, because 520 is already wider than the phone. */
  width:auto;max-width:min(520px,100%);
  max-height:min(600px,62vh);
  /* Softened with the band. A shadow tuned to read against navy turns into a
     grey bruise on grey, and the phone stops looking lifted and starts
     looking dirty. Same ink the paper shadows use, a little deeper because
     this one is still the largest object on the page. */
  filter:drop-shadow(0 22px 46px rgba(18,21,26,.22));
}
.l8 .shotfig .shot{max-height:min(660px,70vh);max-width:min(560px,100%)}

/* ── THE REEL: Explore on a phone, walking its own spots ──────────────
   Everything here is sized off ONE unit. --sp is a pixel of the captured
   375-wide screen, expressed as a share of the phone's width, so the whole
   device scales with the column it is given and every number below can be
   read straight off the design without a second mental conversion. The
   container query is on .reelphone, which is what cqw resolves against.

   The map still is 375x724 CSS px (750x1448 at 2x). Those two numbers and
   the ones in reel-frame.ts are the same fact; changing one without the
   other puts every pin in the wrong bay. */
/* width:100% is load-bearing. .stage is itself a flex row, so without it .reel
   shrink-to-fits its content, that content is a percentage of .reel, and the
   circular reference resolves to zero -- a phone with no width and therefore,
   through --sp, no height either. */
.l8 .reel{display:flex;justify-content:center;width:100%}
/* AN ELEMENT CANNOT QUERY ITS OWN SIZE.
   This bit the phone twice. cqw written on .reelphone -- the container itself
   -- does not resolve against .reelphone; it falls back to the VIEWPORT, so
   border-radius:13cqw on a 330px phone computed to 166px at a 1280 window.
   A radius wider than half the box turns the black shell into a lozenge, and
   the screen's square corners hang out past it on the right and the bottom.
   It fails silently and plausibly, which is the worst way for it to fail.

   So .reelphone is now nothing but a width and a container context, and every
   painted property lives on .reelbody, which is a DESCENDANT and can read cqw
   correctly. The two radii stay concentric by construction: the shell's is the
   screen's plus the bezel, 10 + 3. */
.l8 .reelphone{
  container-type:inline-size;
  width:min(330px,88%);
}
.l8 .reelbody{
  padding:3cqw;
  background:#0A0C10;
  border-radius:13cqw;
  box-shadow:0 26px 54px rgba(18,21,26,.26), 0 2px 0 rgba(255,255,255,.14) inset;
}
.l8 .reelscreen{
  --sp:calc(94cqw / 375);
  position:relative;overflow:hidden;
  width:100%;height:calc(840 * var(--sp));
  border-radius:10cqw;
  background:var(--l8-brand);
  font-size:calc(13 * var(--sp));
  line-height:1.25;
}

/* App chrome: the blue header carries the status bar, as it does in the app.
   116sp is a 52sp status strip and then the app bar, and the app bar's numbers
   below are not styling decisions -- they are ExploreTopBar's own, measured off
   it at 375px, which is exactly the width this frame is drawn at:

     bar 64 tall, 16 of side padding, mark 104x48, CTA 40 tall,
     4 radius, 12/700 uppercase with 0.3 of tracking.

   Anything invented here is the hero quietly disagreeing with the screen it is
   a picture of, which is the one job this component has. */
.l8 .reelnav{
  position:absolute;inset:0 0 auto 0;height:calc(116 * var(--sp));
  background:var(--l8-brand);color:#fff;
  display:flex;align-items:center;justify-content:space-between;
  padding:calc(52 * var(--sp)) calc(16 * var(--sp)) 0;
}
/* The dynamic island. Drawn rather than screenshotted so the frame stays
   sharp at any width, and so the phone is not pretending to a battery
   percentage or a clock we would then have to keep honest. */
.l8 .reelnav::before{
  content:"";position:absolute;top:calc(12 * var(--sp));left:50%;
  transform:translateX(-50%);
  width:calc(96 * var(--sp));height:calc(28 * var(--sp));
  border-radius:999px;background:#0A0C10;
}
/* The mark at the app bar's own 48sp, which the 52sp status strip above
   leaves room for: the dynamic island ends at 40sp and this row starts at 52. */
.l8 .reelwm{height:calc(48 * var(--sp));width:auto;display:block}
.l8 .reelnavcta{
  display:inline-flex;align-items:center;
  height:calc(40 * var(--sp));padding:0 calc(16 * var(--sp));
  background:#fff;color:var(--l8-brand);
  border-radius:calc(4 * var(--sp));
  font-size:calc(12 * var(--sp));font-weight:700;
  text-transform:uppercase;letter-spacing:calc(.3 * var(--sp));
  white-space:nowrap;
}

.l8 .reelmap{
  position:absolute;inset:calc(116 * var(--sp)) 0 0 0;
  height:calc(724 * var(--sp));
  overflow:hidden;
}
/* The sheet. Wider and taller than the screen above, and slid under it one
   stop at a time -- the map moving beneath a phone, not a slideshow of
   pictures of a map. --iw/--ih/--tx/--ty come from the frame, in the same map
   pixels reel-frame.ts projects into, so this rule says nothing about any
   particular city.

   The transition is the reel's only long animation. 1.1s is slow enough to
   read as a map being dragged and short enough to leave most of the 2.4s
   dwell as a rest on the mark; the easing is symmetric because a pan that
   snaps out of the gate reads as a jump cut. */
.l8 .reelpan{
  position:absolute;top:0;left:0;
  width:calc(var(--iw) * var(--sp));
  height:calc(var(--ih) * var(--sp));
  transform:translate3d(
    calc(var(--tx) * var(--sp) * -1),
    calc(var(--ty) * var(--sp) * -1), 0);
  transition:transform 1.1s cubic-bezier(.65,0,.35,1);
  will-change:transform;
}
.l8 .reelmapimg{display:block;width:100%;height:100%;object-fit:cover}

/* pins. Percentages of the map box, so they follow the projection in
   reel-frame.ts at any rendered size. */
/* A puck with a tail, because a plain rounded rect floating over water does
   not say WHICH water. --tail is how far below the badge the point sits, and
   it appears three times -- in the offset that puts the point on the spot, in
   the transform-origin so growing does not walk the point off it, and in the
   ring's placement -- so it is a variable rather than the same number typed
   out three times and later corrected in two of them. */
.l8 .reelpin{
  --tail:calc(7 * var(--sp));
  position:absolute;
  transform:translate(-50%,calc(-100% - var(--tail)));
  transform-origin:50% calc(100% + var(--tail));
  display:flex;align-items:center;justify-content:center;
  min-width:calc(30 * var(--sp));height:calc(21 * var(--sp));
  padding:0 calc(5 * var(--sp));
  background:var(--pin);border:calc(1.5 * var(--sp)) solid #fff;
  border-radius:calc(6 * var(--sp));
  box-shadow:0 calc(2 * var(--sp)) calc(5 * var(--sp)) rgba(10,12,16,.35);
  transition:transform .45s cubic-bezier(.2,.9,.25,1), opacity .45s ease;
  opacity:.85;z-index:1;
}
/* The tail is a rotated square rather than a border triangle, so the white
   outline carries on around it instead of stopping where the badge ends. */
.l8 .reelpin::after{
  content:"";position:absolute;left:50%;top:100%;
  width:calc(10 * var(--sp));height:calc(10 * var(--sp));
  margin-top:calc(-6 * var(--sp));
  background:var(--pin);
  border-right:calc(1.5 * var(--sp)) solid #fff;
  border-bottom:calc(1.5 * var(--sp)) solid #fff;
  border-bottom-right-radius:calc(2 * var(--sp));
  transform:translateX(-50%) rotate(45deg);
  z-index:-1;
}
.l8 .reelpin b{color:#fff;font-size:calc(11 * var(--sp));font-weight:700;font-variant-numeric:tabular-nums}
/* The stop the reel is on: lifted, opaque, and above its neighbours. The
   drop-shadow is what separates it from map clutter -- tide stations and
   contour lines sit under these pins, and a pin that has only grown can still
   be lost in them. */
.l8 .reelpin.on{
  opacity:1;z-index:3;
  transform:translate(-50%,calc(-100% - var(--tail))) scale(1.32);
  filter:drop-shadow(0 calc(3 * var(--sp)) calc(7 * var(--sp)) rgba(10,12,16,.45));
}
/* The ring expands FROM the point, not from the badge, so the thing being
   circled is the piece of water rather than the number. */
.l8 .reelping{
  position:absolute;left:50%;top:100%;
  width:calc(22 * var(--sp));height:calc(22 * var(--sp));
  margin:calc(var(--tail) - 11 * var(--sp)) 0 0 calc(-11 * var(--sp));
  border-radius:999px;
  border:calc(2.5 * var(--sp)) solid #fff;
  box-shadow:0 0 0 calc(1 * var(--sp)) var(--pin) inset, 0 0 0 calc(1 * var(--sp)) var(--pin);
  animation:reelping 2.4s cubic-bezier(.2,.7,.4,1) infinite;
  pointer-events:none;
}
@keyframes reelping{
  0%{transform:scale(.35);opacity:.95}
  75%{transform:scale(2);opacity:0}
  100%{transform:scale(2);opacity:0}
}

/* floating chrome over the map */
.l8 .reelchip{
  position:absolute;left:calc(10 * var(--sp));right:calc(10 * var(--sp));
  top:calc(10 * var(--sp));height:calc(42 * var(--sp));
  background:#fff;border-radius:calc(11 * var(--sp));
  box-shadow:0 calc(2 * var(--sp)) calc(8 * var(--sp)) rgba(18,21,26,.14);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 calc(12 * var(--sp));
}
.l8 .reelloc{font-size:calc(12.5 * var(--sp));font-weight:600;color:var(--l8-ink)}
.l8 .reeladd{font-size:calc(11.5 * var(--sp));font-weight:600;color:var(--l8-brand)}

.l8 .reelcount{
  /* Clear of the card, which grew when the FULL REPORT row went in. */
  position:absolute;left:calc(14 * var(--sp));bottom:calc(232 * var(--sp));
  background:rgba(18,21,26,.82);color:#fff;
  font-family:var(--l8-mono);font-size:calc(10.5 * var(--sp));font-weight:600;
  padding:calc(5 * var(--sp)) calc(10 * var(--sp));border-radius:999px;
  font-variant-numeric:tabular-nums;
}

/* the preview card, remounted on every stop */
.l8 .reelcard{
  position:absolute;left:calc(10 * var(--sp));right:calc(10 * var(--sp));
  bottom:calc(74 * var(--sp));
  background:#fff;border-radius:calc(14 * var(--sp));
  padding:calc(13 * var(--sp)) calc(14 * var(--sp)) calc(14 * var(--sp));
  box-shadow:0 calc(6 * var(--sp)) calc(18 * var(--sp)) rgba(18,21,26,.18);
  /* No fill-mode, and no var(--sp) inside the keyframes.
     "both" holds the FROM state -- opacity 0 -- whenever the animation is not
     running, so anything that stopped it from running left the card invisible
     rather than merely un-animated. The resting state is now the visible one,
     and the fade is decoration on top of it. Keeping --sp out of the keyframes
     also stops a container resize from being able to restart it. */
  animation:reelin .42s cubic-bezier(.2,.8,.3,1);
}
@keyframes reelin{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.l8 .reelcardtop{display:flex;align-items:center;justify-content:space-between;gap:calc(8 * var(--sp))}
.l8 .reelspot{
  font-size:calc(14 * var(--sp));font-weight:700;color:var(--l8-ink);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.l8 .reelbadge{
  flex:0 0 auto;font-family:var(--l8-mono);font-size:calc(11.5 * var(--sp));font-weight:700;
  padding:calc(3 * var(--sp)) calc(8 * var(--sp));border-radius:calc(6 * var(--sp));
  font-variant-numeric:tabular-nums;
}
.l8 .reelbadge.good{background:var(--l8-good-bg);color:var(--l8-good-ink)}
.l8 .reelbadge.fair{background:var(--l8-fair-bg);color:var(--l8-fair)}
.l8 .reelbadge.poor{background:var(--l8-poor-bg);color:var(--l8-poor)}
.l8 .reelbadge.none{background:var(--l8-surface);color:var(--l8-ink-mute)}
.l8 .reelsp{font-size:calc(11.5 * var(--sp));color:var(--l8-ink-soft);margin-top:calc(3 * var(--sp))}
/* The management area, beside the species and quieter than it: the species is
   what the score is about, the area is only where. A rule rather than a filled
   chip, so it reads as a second clause of the same line instead of a badge
   competing with the score badge across the card. */
.l8 .reelarea{
  margin-left:calc(7 * var(--sp));padding-left:calc(7 * var(--sp));
  border-left:1px solid var(--l8-rule);
  color:var(--l8-ink-mute);font-weight:600;letter-spacing:.02em;
}
/* The readings and the sparkline share a row, as they do on the real card. */
.l8 .reelmetarow{
  display:flex;align-items:flex-end;gap:calc(10 * var(--sp));
  margin-top:calc(11 * var(--sp));
}
.l8 .reelmeta{
  flex:1 1 auto;min-width:0;
  display:grid;grid-template-columns:repeat(3,1fr);gap:calc(6 * var(--sp));
}
/* 12 two-hour buckets. Heights are percentages of the row so the bars scale
   with the phone like everything else, with a floor so a dead hour still
   draws a tick rather than vanishing. */
.l8 .reeltrend{
  flex:0 0 auto;display:flex;align-items:flex-end;gap:calc(1.5 * var(--sp));
  width:calc(66 * var(--sp));height:calc(24 * var(--sp));
}
.l8 .reeltrend i{
  flex:1;border-radius:calc(2 * var(--sp)) calc(2 * var(--sp)) 0 0;
  background:color-mix(in srgb, var(--l8-good) 30%, transparent);
}
.l8 .reeltrend i.lit{background:var(--l8-good)}
.l8 .reelmeta span{
  font-size:calc(12 * var(--sp));font-weight:600;color:var(--l8-ink);
  display:flex;flex-direction:column;gap:calc(3 * var(--sp));
}
.l8 .reelmeta em{
  font-style:normal;font-family:var(--l8-mono);font-size:calc(8.5 * var(--sp));
  font-weight:600;letter-spacing:.09em;color:var(--l8-ink-mute);
  display:flex;align-items:center;gap:calc(4 * var(--sp));
}
/* The reading's glyph, at the card's own 12px against its 9px label — the
   same ratio SpotCard draws (w-3 h-3 on a text-[9px] row), so the icons carry
   the labels rather than crowding them. Muted with the label, not with the
   value: the glyph names the reading, the number is the reading. */
.l8 .reelmeta em svg{
  width:calc(12 * var(--sp));height:calc(12 * var(--sp));
  flex:0 0 auto;stroke-width:2;
}

/* The card's last row, as the product draws it: the way on, and the save. */
.l8 .reelmore{
  display:flex;align-items:center;justify-content:space-between;
  margin-top:calc(11 * var(--sp));padding-top:calc(10 * var(--sp));
  border-top:calc(1 * var(--sp)) solid var(--l8-rule);
}
.l8 .reelmore span{
  font-family:var(--l8-mono);font-size:calc(10 * var(--sp));font-weight:700;
  letter-spacing:.07em;color:var(--l8-brand);
}
.l8 .reelmore b{font-size:calc(14 * var(--sp));color:var(--l8-ink-mute)}

.l8 .reeltabs{
  position:absolute;left:calc(10 * var(--sp));right:calc(10 * var(--sp));
  bottom:calc(10 * var(--sp));height:calc(54 * var(--sp));
  background:rgba(255,255,255,.98);border-radius:calc(14 * var(--sp));
  box-shadow:0 calc(2 * var(--sp)) calc(10 * var(--sp)) rgba(18,21,26,.14);
  display:grid;grid-template-columns:repeat(4,1fr);align-items:center;
  font-size:calc(9.5 * var(--sp));font-weight:600;color:var(--l8-ink-mute);text-align:center;
}
.l8 .reeltabs span{
  display:flex;flex-direction:column;align-items:center;
  gap:calc(3 * var(--sp));
}
.l8 .reeltabs svg{
  width:calc(18 * var(--sp));height:calc(18 * var(--sp));
  stroke-width:2;
}
.l8 .reeltabs em{font-style:normal}
.l8 .reeltabs .on{color:var(--l8-brand)}

/* Reduced motion: the component stops advancing, so the pulse and the card's
   entrance are the only moving parts left to switch off. The global rule at
   the foot of this sheet catches both; this is here so the pin still reads as
   the selected one when nothing is animating. */
@media(prefers-reduced-motion:reduce){
  .l8 .reelping{display:none}
}

/* where / what / when */
.l8 .wwwsec{background:var(--l8-panel);border-block:1px solid var(--l8-rule)}
.l8 .www{display:grid;grid-template-columns:1fr;gap:clamp(28px,4vw,56px);align-items:center}
/* Screenshot LEFT here, which is the mirror of the hero above it.
   Two identical two-column blocks stacked read as one long column of text with
   pictures beside it; alternating gives the eye somewhere new to land. Done
   with the order property, not by moving the markup: stacked on a phone the
   heading still has to introduce the image it describes. */
@media(min-width:940px){
  .l8 .www{grid-template-columns:1fr 1fr}
  .l8 .www .shotfig{order:-1}
}
.l8 .wwwlist{list-style:none;margin:24px 0 0;padding:0;display:flex;flex-direction:column;gap:0}
.l8 .wwwlist li{
  display:grid;grid-template-columns:76px 1fr;gap:16px;align-items:baseline;
  padding:14px 0;border-bottom:1px solid var(--l8-rule);
}
.l8 .wwwlist li:last-child{border-bottom:0}
.l8 .wwwlist b{font-size:17px;font-weight:700;letter-spacing:-.02em}
.l8 .wwwlist span{font-size:15px;line-height:1.55;color:var(--l8-ink-soft)}
.l8 .shotfig{margin:0}
.l8 .shotfig .shot{filter:drop-shadow(0 18px 40px rgba(18,21,26,.16))}
.l8 .shotfig figcaption{
  font-family:var(--l8-mono);font-size:11.5px;line-height:1.6;color:var(--l8-ink-mute);
  text-align:center;margin-top:14px;max-width:46ch;margin-inline:auto;
}

/* Bob's review. Sits on paper, so the stars take the badge yellow rather than
   anything from the score spectrum, which is data and must not be spent on
   chrome. */
.l8 .quote{
  margin:28px 0 0;max-width:62ch;background:var(--l8-panel);
  border:1px solid var(--l8-rule);border-radius:14px;padding:22px 24px;
  box-shadow:var(--l8-shadow-bar,0 2px 12px rgba(18,21,26,.05));
}
.l8 .stars{display:flex;gap:3px;margin-bottom:12px}
.l8 .stars span{color:var(--l8-rule);font-size:15px;line-height:1}
.l8 .stars span.on{color:#FFCB1F}
.l8 .quote blockquote{
  margin:0;font-size:17px;line-height:1.6;color:var(--l8-ink);font-weight:500;
}
.l8 .quote figcaption{
  margin-top:14px;font-family:var(--l8-mono);font-size:12px;
  letter-spacing:.06em;color:var(--l8-ink-soft);
}

/* proof strip */
.l8 .strip{background:var(--l8-panel);border-block:1px solid var(--l8-rule)}
.l8 .stripin{display:grid;grid-template-columns:repeat(2,1fr);gap:clamp(20px,3vw,40px);padding-block:clamp(28px,3.5vw,40px)}
@media(min-width:760px){.l8 .stripin{grid-template-columns:repeat(4,1fr)}}
.l8 .stat .n{font-size:clamp(24px,3vw,32px);font-weight:700;letter-spacing:-.035em;font-variant-numeric:tabular-nums;line-height:1}
.l8 .stat .t{font-size:13px;color:var(--l8-ink-soft);margin-top:7px;line-height:1.4}

/* two-column band */
.l8 .two{display:grid;grid-template-columns:1fr;gap:clamp(28px,4vw,56px);align-items:start}
@media(min-width:940px){.l8 .two{grid-template-columns:.85fr 1.15fr}}
.l8 .white{background:var(--l8-panel);border-block:1px solid var(--l8-rule)}

/* ladder */
.l8 .ladder{background:var(--l8-panel);border:1px solid var(--l8-rule);border-radius:16px;padding:clamp(16px,2.2vw,24px);box-shadow:0 2px 12px rgba(18,21,26,.05)}
.l8 .rung{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:13px 0;border-bottom:1px solid var(--l8-rule-soft)}
.l8 .rung:last-of-type{border-bottom:0}
.l8 .rname{font-size:15px;font-weight:600}
.l8 .rname small{display:block;font-family:var(--l8-mono);font-size:11.5px;font-weight:400;color:var(--l8-ink-soft);margin-top:4px}
.l8 .rval{font-family:var(--l8-mono);font-size:14px;font-weight:600;color:var(--l8-good-ink);font-variant-numeric:tabular-nums;white-space:nowrap}
.l8 .meter{display:flex;align-items:center;gap:9px;justify-content:flex-end}
.l8 .meter u{display:block;width:52px;height:5px;background:var(--l8-good-border);border-radius:999px;overflow:hidden;text-decoration:none}
.l8 .meter u b{display:block;height:100%;background:var(--l8-good);border-radius:999px}
.l8 .sum{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:16px;padding:15px 18px;background:var(--l8-good-bg);border:1px solid var(--l8-good-border);border-radius:12px}
.l8 .sum span{font-family:var(--l8-mono);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--l8-good-ink)}
.l8 .sum b{font-size:26px;font-weight:700;letter-spacing:-.04em;color:var(--l8-good-ink);font-variant-numeric:tabular-nums}

/* marks */
.l8 .marks{display:grid;grid-template-columns:1fr;gap:0 clamp(24px,4vw,56px)}
@media(min-width:720px){.l8 .marks{grid-template-columns:1fr 1fr}}
.l8 .mrow{text-decoration:none;color:inherit;display:grid;grid-template-columns:1fr 64px 30px;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--l8-rule)}
.l8 .mn{font-size:14px;font-weight:500;color:var(--l8-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l8 .mb{height:6px;background:var(--l8-surface);border-radius:999px;overflow:hidden}
.l8 .mb i{display:block;height:100%;background:var(--l8-good);border-radius:999px;opacity:.5}
.l8 .mv{font-family:var(--l8-mono);font-size:13px;font-weight:600;color:var(--l8-ink-soft);text-align:right;font-variant-numeric:tabular-nums}
.l8 .mrow.top .mn{color:var(--l8-ink);font-weight:600}
.l8 .mrow.top .mb i{opacity:1}
.l8 .mrow.top .mv{color:var(--l8-good-ink)}

/* A mark row is a link now, so it needs a hover and a focus ring. The row is
   the target rather than the name alone: a 14px name is a small tap area on a
   phone, and the score beside it is part of the same thought. */
.l8 .mrow{border-radius:6px;transition:background .12s ease;margin-inline:-8px;padding-inline:8px}
.l8 .mrow:hover{background:var(--l8-surface)}
.l8 .mrow:hover .mn{color:var(--l8-brand)}
.l8 .mrow:focus-visible{outline:2px solid var(--l8-brand);outline-offset:1px}

.l8 .mapcta{
  display:inline-flex;align-items:center;gap:9px;margin-top:28px;
  background:var(--l8-brand);color:#fff;text-decoration:none;
  font-size:16px;font-weight:600;padding:13px 22px;border-radius:10px;
  transition:background .15s ease;
}
.l8 .mapcta:hover{background:var(--l8-brand-hover)}
.l8 .mapcta:focus-visible{outline:2px solid var(--l8-brand);outline-offset:3px}

/* replaces */
.l8 .chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:8px}
.l8 .chips span{font-size:14px;font-weight:500;color:var(--l8-ink-mute);text-decoration:line-through;background:var(--l8-panel);border:1px solid var(--l8-rule);border-radius:999px;padding:8px 15px}
.l8 .one{display:inline-flex;align-items:center;gap:10px;margin-top:20px;background:var(--l8-good-bg);border:1px solid var(--l8-good-border);border-radius:999px;padding:10px 18px;font-size:15px;font-weight:600;color:var(--l8-good-ink)}

/* timeline */
.l8 .steps{display:grid;grid-template-columns:1fr;gap:14px;margin-top:8px}
@media(min-width:820px){.l8 .steps{grid-template-columns:repeat(3,1fr)}}
.l8 .step{background:var(--l8-panel);border:1px solid var(--l8-rule);border-radius:14px;padding:18px}
.l8 .step b{display:block;font-family:var(--l8-mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--l8-brand);margin-bottom:8px}
.l8 .step p{margin:0;font-size:14.5px;line-height:1.6;color:var(--l8-ink-soft)}
.l8 .step p strong{color:var(--l8-ink);font-weight:600}

/* faq */
.l8 .faq{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:820px){.l8 .faq{grid-template-columns:1fr 1fr;gap:16px}}
.l8 .qa{background:var(--l8-panel);border:1px solid var(--l8-rule);border-radius:14px;padding:20px}
.l8 .qa h3{font-size:16px;font-weight:600;margin:0 0 8px}
.l8 .qa p{font-size:14.5px;line-height:1.6;color:var(--l8-ink-soft);margin:0}

/* close */
.l8 .close{background:var(--l8-navy);color:#fff;text-align:center}
.l8 .close h2{color:#fff}
.l8 .close .sub{color:#C3D0E0;margin:0 auto 28px}
.l8 .foot{background:var(--l8-navy);color:#6E82A0;font-family:var(--l8-mono);font-size:11px;padding:0 var(--l8-gut) 36px;text-align:center;line-height:1.7}

@media(prefers-reduced-motion:reduce){.l8 *{animation:none!important;transition:none!important}}
`;
