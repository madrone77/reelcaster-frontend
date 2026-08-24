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
.l8 .navcta{
  font-size:14px;font-weight:600;color:#fff;background:var(--l8-brand);border:0;border-radius:8px;
  padding:9px 16px;cursor:pointer;text-decoration:none;transition:background .15s;white-space:nowrap;
}
.l8 .navcta:hover{background:var(--l8-brand-hover)}
.l8 .navcta:focus-visible{outline:2px solid var(--l8-brand);outline-offset:3px}

/* hero */
.l8 .hero{background:var(--l8-navy);color:#fff;padding-block:clamp(44px,6vw,80px);overflow:hidden}
.l8 .herogrid{display:grid;grid-template-columns:1fr;gap:clamp(32px,4vw,56px);align-items:center}
@media(min-width:940px){.l8 .herogrid{grid-template-columns:1.02fr .98fr}}
.l8 .pin{display:inline-flex;align-items:center;gap:9px;font-family:var(--l8-mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8FA3BC;margin:0 0 20px}
.l8 .pin i{width:7px;height:7px;border-radius:999px;background:var(--l8-emerald);box-shadow:0 0 0 4px rgba(52,211,153,.16)}
.l8 h1{font-size:clamp(34px,5.4vw,58px);font-weight:700;line-height:1.03;letter-spacing:-.033em;margin:0 0 20px;color:#fff;text-wrap:balance}
.l8 h1 em{font-style:normal;color:var(--l8-emerald)}
.l8 .herosub{font-size:clamp(16px,1.9vw,19px);line-height:1.55;color:#C3D0E0;margin:0 0 28px;max-width:46ch}

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

/* trial form */
.l8 .form{max-width:470px}
.l8 .formrow{display:flex;gap:10px;flex-wrap:wrap}
.l8 .form label{display:block;font-family:var(--l8-mono);font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#8FA3BC;margin:0 0 8px}
.l8 .form input{
  flex:1 1 210px;min-width:0;font-family:inherit;font-size:16px;font-weight:500;color:#fff;
  padding:14px 16px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.09);
}
.l8 .form input::placeholder{color:#8FA3BC}
.l8 .form input:focus-visible{outline:2px solid var(--l8-emerald);outline-offset:2px}
.l8 .form button{
  flex:0 0 auto;font-family:inherit;font-size:16px;font-weight:600;color:#fff;background:var(--l8-brand);
  border:0;border-radius:10px;padding:14px 24px;cursor:pointer;transition:background .15s;
}
.l8 .form button:hover:not(:disabled){background:var(--l8-brand-hover)}
.l8 .form button:disabled{opacity:.65;cursor:default}
.l8 .form button:focus-visible{outline:2px solid var(--l8-emerald);outline-offset:2px}
.l8 .terms{font-family:var(--l8-mono);font-size:12px;line-height:1.65;color:#8FA3BC;margin:14px 0 0}
.l8 .err{font-family:var(--l8-mono);font-size:12px;color:#FCA5A5;margin:10px 0 0}

/* on paper, the same form inverts */
.l8 .onpaper .form input{color:var(--l8-ink);border-color:var(--l8-rule);background:var(--l8-panel)}
.l8 .onpaper .form input::placeholder{color:var(--l8-ink-mute)}
.l8 .onpaper .form label,.l8 .onpaper .terms{color:var(--l8-ink-soft)}

/* THE PRODUCT SHOTS.
   Both heroes are real marketing renders with their callouts baked in, so the
   page cannot drift away from the app the way a hand-drawn approximation
   does. They carry their own transparent margin, hence the negative insets:
   without them the arrow's empty gutter reads as a layout mistake. */
.l8 .stage{position:relative;display:flex;justify-content:center}
.l8 .shot{
  width:100%;height:auto;display:block;
  max-width:520px;
  /* The renders are 1820px tall. Unbounded, the hero grows past a laptop
     viewport and pushes everything under it off the first screen, so the
     height is what gets capped and the width follows. */
  max-height:min(600px,62vh);width:auto;margin-inline:auto;
  filter:drop-shadow(0 24px 50px rgba(0,0,0,.34));
}
.l8 .shotfig .shot{max-height:min(660px,70vh)}

/* where / what / when */
.l8 .wwwsec{background:var(--l8-panel);border-block:1px solid var(--l8-rule)}
.l8 .www{display:grid;grid-template-columns:1fr;gap:clamp(28px,4vw,56px);align-items:center}
@media(min-width:940px){.l8 .www{grid-template-columns:1fr 1fr}}
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
.l8 .mrow{display:grid;grid-template-columns:1fr 64px 30px;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid var(--l8-rule)}
.l8 .mn{font-size:14px;font-weight:500;color:var(--l8-ink-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.l8 .mb{height:6px;background:var(--l8-surface);border-radius:999px;overflow:hidden}
.l8 .mb i{display:block;height:100%;background:var(--l8-good);border-radius:999px;opacity:.5}
.l8 .mv{font-family:var(--l8-mono);font-size:13px;font-weight:600;color:var(--l8-ink-soft);text-align:right;font-variant-numeric:tabular-nums}
.l8 .mrow.top .mn{color:var(--l8-ink);font-weight:600}
.l8 .mrow.top .mb i{opacity:1}
.l8 .mrow.top .mv{color:var(--l8-good-ink)}

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
.l8 .close .form{margin:0 auto;text-align:left}
.l8 .foot{background:var(--l8-navy);color:#6E82A0;font-family:var(--l8-mono);font-size:11px;padding:0 var(--l8-gut) 36px;text-align:center;line-height:1.7}

@media(prefers-reduced-motion:reduce){.l8 *{animation:none!important;transition:none!important}}
`;
