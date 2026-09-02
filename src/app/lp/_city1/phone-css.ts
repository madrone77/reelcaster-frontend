/**
 * The device shells the two live phones wear: the conditions phone and the
 * alert phone.
 *
 * Lifted out of city1-css.ts unchanged when the homepage carousel started
 * drawing the same two components (see (marketing)/components/phone-carousel).
 * A landing page and the homepage showing the same screen in two subtly
 * different devices is the picture disagreeing with itself, so there is one
 * copy of these rules and both pages inject it.
 *
 * ── Why `.rcp` and not `.l8` ─────────────────────────────────────────────
 *
 * These rules used to hang off the landing page's own root class. The homepage
 * is not that page and must not inherit the rest of that sheet, so the shared
 * half moved to its own root class, `.rcp`, which the landing page now carries
 * alongside `.l8`. Nothing else about the landing page changed.
 *
 * Colours are restated as `--rcp-*` rather than reused from `--l8-*` for the
 * same reason: this block has to stand on its own inside one injected <style>
 * on a page that has never heard of the landing page's tokens. They are the
 * same v1.0 design-system values `rc-tokens.css` carries.
 *
 * What is NOT here: the layout each page gives the phone. The landing page
 * lets its two phones reclaim the section gutter below its two-column break,
 * and that rule stays in city1-css.ts because it is about that page's
 * sections. This file is only the device.
 */
export const PHONE_CSS = `
.rcp{
  --rcp-brand:#2536D9;
  --rcp-ink:#12151A; --rcp-ink-mute:#8A919C;
  --rcp-panel:#FFFFFF; --rcp-navy:#0F1B3D;
  --rcp-mono:var(--font-plex-mono,"IBM Plex Mono"),ui-monospace,SFMono-Regular,monospace;
}
.rcp *{box-sizing:border-box}

/* ── The conditions phone ─────────────────────────────────────────────────
   The same black shell as the Explore reel, and deliberately NOT the same
   insides.

   The reel's phone is sized in cqw so the whole device shrinks with its
   column, which is right for a map: a map at 80% is a smaller map. This one
   is showing 12px mono readouts and a chart whose hour cells are 13px wide,
   and scaling those down stops the picture being about anything. So the app
   simply lays itself out at whatever width the column gives it, at true size,
   which is what it does on a real phone. Give it less than about 397px and
   SpotTerminal drops under its own 300px measuring floor and draws itself
   shrunk to fit, which costs the picture the one thing it is about.

   It also wears no app bar and no tab bar. The screen is ~750px of instrument
   on its own; the reel's 116px bar over it and 76px bar under it made a phone
   375 by 948, half again taller than the 375 by 812 device it is a picture
   of. The island is drawn here instead, because it is the one piece of chrome
   that still says "phone" and costs no height.

   Radii are the reel's own percentages resolved at 375: 3cqw of padding,
   13cqw on the shell, 10cqw on the screen. They stay concentric the same way,
   the screen's plus the bezel. */
.rcp .condphone{display:flex;justify-content:center;width:100%}
.rcp .condbody{
  width:min(397px,100%);
  padding:11px;
  background:#0A0C10;
  border-radius:49px;
  box-shadow:0 26px 54px rgba(18,21,26,.26), 0 2px 0 rgba(255,255,255,.14) inset;
}
.rcp .condscreen{
  position:relative;overflow:hidden;
  border-radius:38px;
  background:var(--rcp-panel);
  /* Top clears the island (12 + 28, plus air). */
  padding:50px 10px 18px;
}
/* The dynamic island, drawn rather than screenshotted so the frame stays
   sharp at any width, and so the phone is not pretending to a clock or a
   battery percentage we would then have to keep honest. Same geometry as the
   reel's, which draws it on its app bar instead. */
.rcp .condscreen::before{
  content:"";position:absolute;top:12px;left:50%;
  transform:translateX(-50%);
  width:96px;height:28px;
  border-radius:999px;background:#0A0C10;
}
.rcp .condpane > * + *{margin-top:8px}

/* ── The alert phone ──────────────────────────────────────────────────────
   Same shell as the conditions phone, and a real 375x812 screen: nothing
   inside forces a height here, so the ratio is stated rather than fallen into.

   It is a LOCK SCREEN, not a Messages thread. A thread holding one message is
   four fifths empty, and the moment being sold is a text reaching somebody who
   was not looking at their phone -- which happens here, not in a thread they
   had to open. */
.rcp .smsphone{display:flex;justify-content:center;width:100%}
.rcp .smsbody{
  width:min(397px,100%);
  padding:11px;
  background:#0A0C10;
  border-radius:49px;
  box-shadow:0 26px 54px rgba(18,21,26,.26), 0 2px 0 rgba(255,255,255,.14) inset;
}
/* Deep navy rather than a photograph: a stock wallpaper is one more thing to
   license and to keep from dating, and the brand's own navy makes the white
   banner the brightest thing on the screen, which is where the eye should go. */
.rcp .smsscreen{
  position:relative;overflow:hidden;
  aspect-ratio:375/812;
  border-radius:38px;
  background:
    radial-gradient(120% 80% at 50% 0%, #1B2C63 0%, transparent 60%),
    linear-gradient(180deg, var(--rcp-navy) 0%, #060B1D 100%);
  color:#fff;
  display:flex;flex-direction:column;align-items:center;
  padding:0 12px 18px;
}
.rcp .smsscreen::before{
  content:"";position:absolute;top:12px;left:50%;
  transform:translateX(-50%);
  width:96px;height:28px;
  border-radius:999px;background:#000;z-index:2;
}
/* iOS puts the date over the clock, and the clock is the biggest thing on the
   screen. Tabular figures so the loop cannot reflow it. */
.rcp .smsclock{
  margin-top:66px;text-align:center;
  display:flex;flex-direction:column;align-items:center;gap:2px;
}
.rcp .smsdate{font-size:15px;font-weight:600;color:rgba(255,255,255,.86)}
.rcp .smstime{
  font-size:74px;font-weight:600;line-height:1;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums;
}
/* The banner. Frosted, as iOS draws it, and it is the only white on the
   screen. Hidden with visibility rather than display, so the text stays in
   the accessibility tree through the empty beat.
   NB: this file is one JS template literal -- no backticks in these comments,
   or the stylesheet ends here and the rest of it becomes code. */
.rcp .smsbanner{
  margin-top:40px;width:100%;
  display:flex;gap:11px;align-items:flex-start;
  background:rgba(255,255,255,.94);
  -webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);
  border-radius:20px;padding:12px 14px;
  box-shadow:0 12px 30px rgba(0,0,0,.30);
  color:var(--rcp-ink);
  opacity:0;transform:translateY(-14px) scale(.97);visibility:hidden;
  transition:opacity .34s ease, transform .34s cubic-bezier(.2,.9,.3,1.15), visibility 0s .34s;
}
.rcp .smsbanner.on{
  opacity:1;transform:none;visibility:visible;
  transition:opacity .34s ease, transform .34s cubic-bezier(.2,.9,.3,1.15), visibility 0s;
}
.rcp .smsicon{
  flex:none;width:36px;height:36px;border-radius:9px;
  background:var(--rcp-brand);color:#fff;
  display:flex;align-items:center;justify-content:center;
  font-family:var(--rcp-mono);font-size:13px;font-weight:700;letter-spacing:.03em;
}
.rcp .smsmsg{min-width:0;flex:1}
.rcp .smshead{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.rcp .smsapp{font-size:13px;font-weight:700;letter-spacing:.01em}
.rcp .smswhen{font-size:12px;color:var(--rcp-ink-mute);flex:none}
.rcp .smstext{margin:2px 0 0;font-size:15px;line-height:1.32;color:var(--rcp-ink)}
/* The home indicator, which is what stops the bottom reading as a crop. */
.rcp .smsbar{
  margin-top:auto;width:134px;height:5px;border-radius:999px;
  background:rgba(255,255,255,.55);
}
/* Reduced motion: the banner is simply there. The component stops its loop
   too, so this only governs the first paint. */
@media (prefers-reduced-motion:reduce){
  .rcp .smsbanner{opacity:1;transform:none;visibility:visible;transition:none}
}
`;
