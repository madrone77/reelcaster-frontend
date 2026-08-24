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

/* THE PHONE.
   The hero is a picture of the real product, not an illustration of it: the
   conditions grid and the hour strip are the app's own, filled with this
   city's numbers. The bezel is drawn rather than an image so it stays sharp
   at any width and costs no bytes. */
.l8 .stage{position:relative;display:flex;justify-content:center;padding-block:8px}
.l8 .phone{
  position:relative;width:min(340px,86vw);border-radius:44px;padding:11px;
  background:linear-gradient(160deg,#2A2F3A,#0B0D12);
  box-shadow:0 26px 60px rgba(0,0,0,.45),0 0 0 1px rgba(255,255,255,.06) inset;
}
.l8 .screen{
  position:relative;border-radius:34px;overflow:hidden;background:#fff;
  /* A light surface inside a dark section has to set its own ink. Without
     this every value in the conditions grid inherits the hero's white and
     renders invisible on white, which innerText will happily tell you is
     present. */
  color:var(--l8-ink);
}
.l8 .notch{position:absolute;top:9px;left:50%;transform:translateX(-50%);width:96px;height:22px;border-radius:999px;background:#0B0D12;z-index:3}
.l8 .phonetop{background:var(--l8-brand);padding:30px 16px 14px;display:flex;align-items:center;justify-content:space-between}
.l8 .wordmark{border:2px solid #fff;padding:4px 8px 3px;line-height:1}
.l8 .wordmark b{display:block;color:#fff;font-size:17px;font-weight:700;letter-spacing:.06em}
.l8 .wordmark i{display:block;color:#fff;font-style:normal;font-family:var(--l8-mono);font-size:7px;letter-spacing:.42em;text-align:center;margin-top:1px}
.l8 .avatar{width:26px;height:26px;border-radius:999px;background:#fff;color:var(--l8-brand);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center}
.l8 .screenbody{padding:12px 12px 14px}
.l8 .condlab{font-family:var(--l8-mono);font-size:8.5px;font-weight:600;letter-spacing:.16em;color:var(--l8-ink-mute);margin:0 0 7px}
.l8 .condgrid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--l8-rule);border-radius:4px;overflow:hidden}
.l8 .cell{padding:6px 6px 7px;border-right:1px solid var(--l8-rule);border-bottom:1px solid var(--l8-rule);min-width:0}
.l8 .cell:nth-child(4n){border-right:0}
.l8 .cell:nth-last-child(-n+4){border-bottom:0}
.l8 .cell .k{display:block;font-family:var(--l8-mono);font-size:7px;font-weight:600;letter-spacing:.13em;color:var(--l8-ink-mute);text-transform:uppercase}
.l8 .cell .v{display:block;font-size:13px;font-weight:700;letter-spacing:-.02em;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.l8 .cell .v.sc{color:var(--l8-fair)}
.l8 .cell .v.sc.good{color:var(--l8-good)}
.l8 .cell small{display:block;text-decoration:none;font-family:var(--l8-mono);font-size:7.5px;color:var(--l8-ink-mute);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* the strip the arrow points at */
.l8 .stripwrap{margin-top:13px}
.l8 .striprow{display:flex;gap:2px;border:1px solid var(--l8-rule);border-radius:4px;padding:4px;background:#fff}
.l8 .striprow i{flex:1;height:26px;border-radius:2px;background:var(--l8-surface);position:relative}
.l8 .striprow i.good{background:var(--l8-good-bg)}
.l8 .striprow i.fair{background:var(--l8-fair-bg)}
.l8 .striprow i.poor{background:var(--l8-poor-bg)}
.l8 .striprow i.now{box-shadow:0 0 0 2px var(--l8-brand) inset;border-radius:3px}
.l8 .striphours{display:flex;justify-content:space-between;font-family:var(--l8-mono);font-size:7.5px;color:var(--l8-ink-mute);margin-top:5px}

/* the chart stack below, drawn only far enough to read as the real page */
.l8 .mini{margin-top:12px}
.l8 .mini b{display:block;font-family:var(--l8-mono);font-size:8px;font-weight:600;letter-spacing:.15em;color:var(--l8-ink-soft);margin-bottom:5px}
.l8 .minibox{height:52px;border:1px solid var(--l8-rule);border-radius:4px;padding:5px;background:#fff}
.l8 .minibars{display:flex;align-items:flex-end;gap:1.5px;height:100%}
.l8 .minibars i{flex:1;background:#A5B4FC;border-radius:1px}
.l8 .fade{position:absolute;left:0;right:0;bottom:0;height:56px;background:linear-gradient(180deg,rgba(255,255,255,0),#fff);pointer-events:none}

/* THE CALLOUT. Deliberately the loudest object on the page: it is the one
   thing a cold reader must understand, and three words do it. */
.l8 .callout{
  /* Aligned on the STRIP, not guessed. Everything above it inside the phone
     is fixed height (bezel, header, label, two grid rows), so once the phone
     reaches its 340px cap this offset is stable; below 940px the callout drops
     under the phone anyway. Measured at 1280 and checked at 1024 and 1440. */
  position:absolute;left:-4px;top:240px;z-index:4;
  display:flex;align-items:center;pointer-events:none;
}
.l8 .callout span{
  background:#2E3138;color:#fff;font-weight:700;letter-spacing:-.01em;
  font-size:clamp(17px,2.4vw,22px);padding:14px 8px 14px 18px;
  border-radius:6px 0 0 6px;white-space:nowrap;
  box-shadow:0 10px 30px rgba(0,0,0,.3);
}
.l8 .callout svg{display:block;filter:drop-shadow(0 10px 22px rgba(0,0,0,.3))}
@media(max-width:939px){
  .l8 .callout{left:50%;transform:translateX(-50%);top:auto;bottom:-14px}
  .l8 .callout span{border-radius:6px;padding:11px 16px;font-size:17px}
  .l8 .callout svg{display:none}
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
