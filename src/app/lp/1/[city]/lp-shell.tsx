"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import MarketingMap from "@/app/(marketing)/components/marketing-map";
import type { LpShellProps, LpTier } from "./lp-types";

// The approved prototype's <style> block, verbatim. Kept as a self-contained
// string so the landing page stays pixel-identical to the sign-off and never
// depends on the app's global CSS.
const CSS_STRING = `
  /* ── Reelcaster real brand tokens (src/styles/rc-tokens.css) ── */
  :root{
    --brand:#1E40E0; --brand-hover:#1A38C8; --brand-soft:#E8ECFD; --brand-soft2:#DBEAFE;
    --badge:#FFCB1F;
    --ink:#0B1220; --ink-soft:#2A3344; --ink-mute:#8A92A4;
    --panel:#FFFFFF; --surface:#F7F8FA; --bg:#F0EFED; --band:#F3F3F5;
    --rule:#DEE2EA; --rule-soft:#ECEEF3;
    --navy:#16234E; --navy-deep:#0F1B3D;
    --good:#16A34A; --good-bg:#DCFCE7; --good-ink:#166534; --good-soft:#F0FDF4; --good-border:#BBF7D0;
    --fair:#D78711; --fair-bg:#FEF3C7; --fair-ink:#92400E; --fair-border:#FDE68A;
    --poor:#DC2626; --poor-bg:#FEE2E2; --poor-ink:#991B1B;
    --shadow-panel:0 8px 24px rgba(15,23,42,.06),0 2px 6px rgba(15,23,42,.04);
    --shadow-bar:0 2px 12px rgba(15,23,42,.05);
    --sans:var(--font-inter,'Inter'),system-ui,-apple-system,'Segoe UI',sans-serif;
    --mono:var(--font-plex-mono,'IBM Plex Mono'),'Geist Mono',ui-monospace,'SFMono-Regular',monospace;
    --r:4px;
  }
  @media (prefers-color-scheme:dark){:root{
    --ink:#EAF0FA; --ink-soft:#B7C2D6; --ink-mute:#8593AC;
    --panel:#141A28; --surface:#111827; --bg:#0B0F1A; --band:#111726;
    --rule:#233046; --rule-soft:#1B2436; --brand:#5B7BFF; --brand-soft:#1B2440; --brand-soft2:#1B2440;
    --good:#22C55E; --good-bg:#123024; --good-ink:#86EFAC; --good-soft:#0F251C; --good-border:#1C4532;
    --fair:#FBBF24; --fair-bg:#3A2A0C; --fair-ink:#FCD98A; --fair-border:#4A3A12;
    --poor:#F87171; --poor-bg:#3A1717; --poor-ink:#FCA5A5;
    --shadow-panel:0 10px 30px rgba(0,0,0,.4); --shadow-bar:0 2px 12px rgba(0,0,0,.4);
  }}
  :root[data-theme="light"]{--ink:#0B1220;--ink-soft:#2A3344;--ink-mute:#8A92A4;--panel:#FFFFFF;--surface:#F7F8FA;--bg:#F0EFED;--band:#F3F3F5;--rule:#DEE2EA;--rule-soft:#ECEEF3;--brand:#1E40E0;--brand-soft:#E8ECFD;--brand-soft2:#DBEAFE;--good:#16A34A;--good-bg:#DCFCE7;--good-ink:#166534;--good-soft:#F0FDF4;--good-border:#BBF7D0;--fair:#D78711;--fair-bg:#FEF3C7;--fair-ink:#92400E;--fair-border:#FDE68A;--poor:#DC2626;--poor-bg:#FEE2E2;--poor-ink:#991B1B;--shadow-panel:0 8px 24px rgba(15,23,42,.06),0 2px 6px rgba(15,23,42,.04)}
  :root[data-theme="dark"]{--ink:#EAF0FA;--ink-soft:#B7C2D6;--ink-mute:#8593AC;--panel:#141A28;--surface:#111827;--bg:#0B0F1A;--band:#111726;--rule:#233046;--rule-soft:#1B2436;--brand:#5B7BFF;--brand-soft:#1B2440;--brand-soft2:#1B2440;--good:#22C55E;--good-bg:#123024;--good-ink:#86EFAC;--good-soft:#0F251C;--good-border:#1C4532;--fair:#FBBF24;--fair-bg:#3A2A0C;--fair-ink:#FCD98A;--fair-border:#4A3A12;--poor:#F87171;--poor-bg:#3A1717;--poor-ink:#FCA5A5;--shadow-panel:0 10px 30px rgba(0,0,0,.4)}

  *{box-sizing:border-box}
  body{margin:0}
  .rc{background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;min-height:100svh}
  .wrap{max-width:1120px;margin:0 auto;padding:0 24px}
  .mono{font-family:var(--mono)}
  .label{font-family:var(--mono);font-weight:600;font-size:10px;line-height:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-mute)}
  a{color:inherit}

  /* top brand bar (real app blue nav) */
  .topbar{position:sticky;top:0;z-index:40;background:var(--brand);color:#fff}
  .topbar .in{max-width:1120px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between}
  .logo{display:flex;align-items:center;text-decoration:none}
  .logo img{display:block;height:48px;width:auto}
  .btn{font-family:var(--sans);font-weight:700;font-size:14px;border-radius:var(--r);padding:11px 18px;border:0;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:8px;transition:background .15s,color .15s,border-color .15s}
  .btn-nav{background:#fff;color:var(--brand)} .btn-nav:hover{background:rgba(255,255,255,.9)}
  .btn-primary{background:var(--brand);color:#fff} .btn-primary:hover{background:var(--brand-hover)}
  .btn-secondary{background:var(--panel);color:var(--brand);border:1px solid var(--brand)} .btn-secondary:hover{background:var(--brand-soft)}
  .btn-lg{padding:14px 24px;font-size:16px}

  /* hero */
  .hero{background:var(--band);border-bottom:1px solid var(--rule)}
  .hero .in{max-width:1120px;margin:0 auto;padding:56px 24px 64px;display:grid;gap:44px}
  @media(min-width:960px){.hero .in{grid-template-columns:1.05fr .95fr;align-items:center;padding:80px 24px 88px}}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--brand);background:var(--brand-soft);border-radius:999px;padding:6px 12px}
  h1{font-size:clamp(38px,7vw,60px);line-height:1.04;letter-spacing:-.03em;font-weight:900;margin:18px 0 0;text-wrap:balance}
  h1 .b{color:var(--brand)}
  .lede{margin:22px 0 0;max-width:34ch;font-size:clamp(17px,2.2vw,20px);line-height:1.5;color:var(--ink-mute)}
  .cta-row{display:flex;flex-direction:column;gap:12px;margin-top:34px}
  @media(min-width:560px){.cta-row{flex-direction:row}}
  .trust{margin-top:18px;font-family:var(--mono);font-size:11px;color:var(--ink-mute);letter-spacing:.02em}

  /* real score card */
  .card{background:var(--panel);border:1px solid var(--rule);border-radius:var(--r);box-shadow:var(--shadow-panel);padding:24px}
  @media(min-width:560px){.card{padding:30px}}
  .card-head{text-align:center}
  .card-head .u{font-family:var(--mono);font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:color-mix(in srgb,var(--ink-mute) 80%,transparent)}
  .card-head .t{margin-top:4px;font-family:var(--mono);font-size:18px;letter-spacing:.3em;text-transform:uppercase;color:var(--ink-mute)}
  .verdict{margin-top:22px;display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
  .pill{display:inline-block;border-radius:var(--r);padding:4px 9px;font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
  .pill-good{background:var(--good-bg);color:var(--good-ink)}
  .num{font-weight:700;font-size:82px;line-height:.82;letter-spacing:-.04em;margin-top:8px}
  .num-good{color:var(--good)}
  .verdict .sub{font-family:var(--mono);font-size:12px;color:var(--ink-soft);margin-top:8px}
  .win{margin-top:20px;background:var(--good-soft);border:1px solid var(--good-border);border-radius:var(--r);padding:14px;text-align:center}
  .win .wl{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--good-ink)}
  .win .wt{font-size:22px;font-weight:800;color:var(--good-ink);margin-top:2px;letter-spacing:-.01em}
  .win .ws{font-family:var(--mono);font-size:11px;color:color-mix(in srgb,var(--good-ink) 85%,transparent);margin-top:3px}
  /* 24h bars */
  .bars{margin-top:20px;display:flex;align-items:flex-end;gap:2px;height:60px}
  .bar{flex:1;background:var(--brand-soft2);border-radius:2px 2px 0 0;min-height:3px}
  .bar.win{background:var(--good)}
  .axis{margin-top:6px;display:flex;justify-content:space-between;font-family:var(--mono);font-size:9px;color:var(--ink-mute)}
  .reg{margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--fair-bg);border:1px solid var(--fair-border);border-radius:var(--r);padding:9px 12px;font-family:var(--mono);font-size:11px;color:var(--fair-ink)}
  .reg .rl{color:var(--brand);font-weight:700}

  /* sections */
  section.band{padding:64px 0;border-bottom:1px solid var(--rule)}
  .sec-head{max-width:60ch}
  .sec-head h2{font-size:clamp(26px,4vw,38px);line-height:1.08;letter-spacing:-.025em;font-weight:900;margin:10px 0 8px}
  .sec-head p{margin:0;font-size:16px;color:var(--ink-mute);line-height:1.5;max-width:52ch}

  /* 14-day strip */
  .days{margin-top:20px;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(64px,1fr);gap:6px;overflow-x:auto;overflow-y:visible;padding:16px 0 6px;-webkit-overflow-scrolling:touch}
  .day{position:relative;background:var(--panel);border:1px solid var(--rule);border-radius:var(--r);padding:15px 4px 11px;text-align:center;min-width:0}
  .day.sel{background:var(--brand);border-color:var(--brand)}
  .day .dw{font-family:var(--mono);font-size:9px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-mute)}
  .day .dd{font-family:var(--mono);font-size:10px;color:var(--ink-soft);margin-top:1px}
  .day.sel .dw,.day.sel .dd{color:rgba(255,255,255,.82)}
  .day .s{font-size:26px;font-weight:800;line-height:1;margin-top:6px;letter-spacing:-.03em}
  .day.sel .s{color:#fff}
  .sg{color:var(--good)} .sf{color:var(--fair)} .sp{color:var(--poor)}
  .day .wx{font-size:12px;margin-top:4px;color:var(--ink-mute)}
  .day.sel .wx{color:rgba(255,255,255,.7)}
  .day .pk{margin-top:5px;font-family:var(--mono);font-size:9px;color:var(--ink-mute);background:var(--surface);border-radius:3px;padding:2px 0}
  .day.sel .pk{background:rgba(255,255,255,.18);color:#fff}
  .bestbadge{position:absolute;top:-11px;left:50%;transform:translateX(-50%);white-space:nowrap;font-family:var(--mono);font-size:8px;font-weight:800;letter-spacing:.08em;background:var(--badge);color:#3a2c00;border-radius:3px;padding:3px 7px}
  /* seasonality — one clean line, readable */
  .season{margin-top:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  .season .st{font-size:14px;color:var(--ink-soft);line-height:1.4}
  .season .st b{color:var(--ink);font-weight:700}
  .season .spark{display:flex;align-items:flex-end;gap:3px;height:22px;flex-shrink:0}
  .season .spark i{width:5px;background:var(--good);border-radius:1px}
  .season .spark i.lo{opacity:.45}
  /* real line-icon weather glyphs (replaces emoji) */
  .wxi{width:18px;height:18px;display:inline-block;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}

  /* side-by-side feature layout */
  .split{display:grid;gap:34px;align-items:center}
  @media(min-width:920px){.split{grid-template-columns:1fr 1fr;gap:56px}}
  .split .copy .label{margin-bottom:8px;display:block}
  .split .copy h2{font-size:clamp(26px,3.4vw,36px);line-height:1.1;letter-spacing:-.025em;font-weight:900;margin:0 0 10px}
  .split .copy p{margin:0;font-size:16px;color:var(--ink-mute);line-height:1.5;max-width:46ch}

  /* real nautical-chart map + working layer toggles */
  .maptabs{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}
  .maptab{font-family:var(--mono);font-size:12px;padding:9px 14px;border-radius:var(--r);border:1px solid var(--rule);background:var(--panel);color:var(--ink-soft);cursor:pointer;transition:background .15s,color .15s,border-color .15s}
  .maptab:hover{border-color:var(--brand)}
  .maptab.on{background:var(--brand);color:#fff;border-color:var(--brand)}
  .mapwrap{position:relative;border:1px solid var(--rule);border-radius:var(--r);overflow:hidden;background:#F4F8FA;aspect-ratio:620/300}
  .mapwrap>svg.chart{display:block;width:100%;height:100%}
  .ov{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:0;transition:opacity .3s}
  .mapwrap[data-layer="currents"] .ov-currents{opacity:.85}
  .mapwrap[data-layer="wind"] .ov-wind{opacity:.8}
  .mapwrap[data-layer="sat"] .ov-sat{opacity:1}
  .ov-sat{background:linear-gradient(150deg,rgba(18,44,32,.62),rgba(9,22,40,.66));mix-blend-mode:multiply}
  .mp{position:absolute;width:24px;height:24px;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:translate(-50%,-100%) rotate(-45deg);display:flex;align-items:center;justify-content:center}
  .mp b{transform:rotate(45deg);color:#fff;font-family:var(--mono);font-weight:700;font-size:10px}
  .mp-g{background:var(--good)} .mp-f{background:var(--fair)}

  /* fresh catch */
  .fc{background:var(--panel);border:1px solid var(--rule);border-radius:var(--r);padding:24px}
  .fc .fh{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute)}
  .fc .fr{display:flex;align-items:center;gap:10px;margin-top:12px}
  .hot{font-family:var(--mono);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;background:var(--good);color:#fff;padding:3px 8px;border-radius:var(--r)}
  .fc .fn{font-size:18px;font-weight:800}
  .fc .fa{margin-left:auto;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute)}
  .fc .fkey{display:flex;justify-content:space-between;font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute);margin-top:18px;padding-bottom:8px;border-bottom:1px solid var(--rule)}
  .fc ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column}
  .fc li{display:flex;align-items:center;gap:16px;padding:12px 0;border-top:1px solid var(--rule-soft)}
  .fc li:first-child{border-top:0}
  .fc li .sp{flex-shrink:0;width:128px;font-size:14px;font-weight:600;color:var(--ink)}
  .fc li .bar{flex:1;height:8px;min-width:40px}
  .fc li .bar i{display:block;height:100%;min-width:6px;background:var(--brand-soft2);border-radius:999px;position:relative;overflow:hidden}
  .fc li .bar i em{position:absolute;left:0;top:0;height:100%;background:var(--good);border-radius:999px}
  .fc li .r{flex-shrink:0;width:54px;text-align:right;font-family:var(--mono);font-size:13px;color:var(--ink-mute)}
  .fc li .r b{color:var(--good-ink);font-weight:800}
  .fc .fnote{margin-top:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--ink-mute)}
  .fc .fnote .k{display:inline-flex;align-items:center;gap:7px}
  .fc .fnote .sw{width:16px;height:8px;border-radius:999px;flex-shrink:0}
  .fc .fnote .sw-g{background:var(--good)}
  .fc .fnote .sw-n{background:var(--brand-soft2)}

  /* make it yours */
  .yours{margin-top:24px;display:grid;gap:16px}
  @media(min-width:640px){.yours{grid-template-columns:1fr 1fr}}
  .tile{background:var(--panel);border:1px solid var(--rule);border-radius:var(--r);padding:20px}
  .tile h3{margin:0 0 6px;font-size:16px;font-weight:800}
  .tile p{margin:0;font-size:14px;color:var(--ink-mute);line-height:1.5}

  /* closing */
  .closing{background:var(--navy);color:#fff;border:0}
  .closing .in{max-width:720px;margin:0 auto;padding:72px 24px;text-align:center}
  .closing h2{font-size:clamp(28px,4.5vw,40px);font-weight:900;letter-spacing:-.02em;line-height:1.08;margin:0 0 12px}
  .closing p{margin:0 0 26px;color:rgba(255,255,255,.72);font-size:17px}
  .closing .btn-primary{background:#fff;color:var(--navy)} .closing .btn-primary:hover{background:rgba(255,255,255,.9)}
  .closing .trust{color:rgba(255,255,255,.6)}

  /* sticky mobile cta */
  .sticky{position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--panel);border-top:1px solid var(--rule);box-shadow:var(--shadow-bar);padding:10px 16px;display:flex;align-items:center;gap:12px}
  .sticky .t{font-family:var(--mono);font-size:11px;color:var(--ink-mute);line-height:1.3;min-width:0}
  .sticky .t b{color:var(--ink)}
  .sticky .btn{margin-left:auto;white-space:nowrap}
  @media(min-width:960px){.sticky{display:none}}
  .rc{padding-bottom:76px}
  @media(min-width:960px){.rc{padding-bottom:0}}

  .toggle{position:fixed;top:70px;right:14px;z-index:60;font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;background:var(--panel);color:var(--ink-soft);border:1px solid var(--rule);border-radius:999px;padding:6px 12px;cursor:pointer}
  /* FLAT — borders only, no shadows anywhere */
  .card,.fc,.sticky,.toggle,.pin{box-shadow:none!important}
  .sticky{border-top:1px solid var(--rule)}
`;

/** Tier → `.s` class on a 14-day cell (sg/sf/sp; bare for unscored). */
function dayScoreClass(tier: LpTier): string {
  if (tier === "good") return "s sg";
  if (tier === "fair") return "s sf";
  if (tier === "poor") return "s sp";
  return "s";
}

export default function LpShell(props: LpShellProps) {
  const barsRef = useRef<HTMLDivElement>(null);

  // Port of the prototype's bottom <script>: cascade the 24h bars in from a
  // seed of hourly scores. Map-layer/overlay JS is gone — MarketingMap owns
  // its own layers now. Reduced-motion falls straight to final heights.
  useEffect(() => {
    const host = barsRef.current;
    if (!host) return;
    const D = props.hours24;

    // Mark the peak window (peak ±1) rather than the prototype's fixed indices.
    let peakIdx = -1;
    let peakVal = -Infinity;
    D.forEach((v, i) => {
      if (v != null && v > peakVal) {
        peakVal = v;
        peakIdx = i;
      }
    });

    const rm = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
    const timers: number[] = [];

    D.forEach((v, i) => {
      const bar = document.createElement("div");
      const isWin = peakIdx >= 0 && i >= peakIdx - 1 && i <= peakIdx + 1;
      bar.className = "bar" + (isWin ? " win" : "");
      const target = v == null ? "3px" : v + "%";
      bar.style.height = rm ? target : "3px";
      host.appendChild(bar);
      if (!rm) {
        const t = window.setTimeout(() => {
          bar.style.transition = "height .5s cubic-bezier(.2,.8,.2,1)";
          bar.style.height = target;
        }, 120 + i * 22);
        timers.push(t);
      }
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
      host.innerHTML = "";
    };
  }, [props.hours24]);

  // Theme toggle (port of the prototype's #tg handler).
  const onToggleTheme = () => {
    const r = document.documentElement;
    const cur =
      r.getAttribute("data-theme") ||
      (window.matchMedia("(prefers-color-scheme:dark)").matches
        ? "dark"
        : "light");
    r.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
  };

  const pillClass =
    props.tier === "none" ? "pill" : `pill pill-${props.tier}`;
  const numClass = props.tier === "none" ? "num" : `num num-${props.tier}`;

  const regStripText =
    props.regulator +
    (props.regArea ? ` · ${props.regAreaLabel} ${props.regArea}` : "") +
    (props.regStatus ? ` · ${props.species} ${props.regStatus}` : "");

  return (
    <div className="rc">
      <style dangerouslySetInnerHTML={{ __html: CSS_STRING }} />

      <button className="toggle" type="button" onClick={onToggleTheme}>
        ◑
      </button>

      {/* Brand top bar (real app blue nav) */}
      <div className="topbar">
        <div className="in">
          <a className="logo" href="#top" aria-label="ReelCaster home">
            <Image src="/reelcaster-mark-white.svg" alt="ReelCaster" width={104} height={48} priority />
          </a>
          <a className="btn btn-nav" href="/signup">
            Start free trial
          </a>
        </div>
      </div>

      {/* HERO */}
      <header className="hero">
        <div className="in">
          <div>
            <span className="eyebrow">
              ● {props.city}, {props.provinceCode} · {props.species}
            </span>
            <h1>
              The {props.species} are on.
              <br />
              <span className="b">Go {props.bestDay}.</span>
            </h1>
            <p className="lede">
              Reelcaster turns tides, weather, water and regulations into one
              score — so you know exactly when and where to fish {props.city}.
            </p>
            <div className="cta-row">
              <a className="btn btn-primary btn-lg" href="/signup">
                Start Free
              </a>
              <a className="btn btn-secondary btn-lg" href="/signup">
                See this week free
              </a>
            </div>
            <div className="trust">
              Free 7-day trial · no card to look · cancel anytime
            </div>
          </div>

          {/* Real score card, city-personalized */}
          <div className="card">
            <div className="card-head">
              <div className="u">{props.updatedLabel}</div>
              <div className="t">Reelcaster Score</div>
            </div>
            <div className="verdict">
              <div>
                <span className={pillClass}>
                  {props.species} · {props.tierWord}
                </span>
                <div className={numClass}>{props.score ?? "—"}</div>
                <div className="sub">
                  Best today {props.peakScore} · {props.peakTime}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="label">{props.spotName}</div>
                {props.regArea && (
                  <div
                    className="mono"
                    style={{
                      fontSize: "11px",
                      color: "var(--ink-mute)",
                      marginTop: "4px",
                    }}
                  >
                    {props.regAreaLabel} {props.regArea}
                  </div>
                )}
              </div>
            </div>
            {props.bestWindowTime && (
              <div className="win">
                <div className="wl">Best window · {props.bestWindowLabel}</div>
                <div className="wt">{props.bestWindowTime}</div>
                <div className="ws">{props.bestWindowSub}</div>
              </div>
            )}
            <div className="bars" ref={barsRef} />
            <div className="axis">
              <span>6A</span>
              <span>12P</span>
              <span>6P</span>
              <span>12A</span>
            </div>
            <div className="reg">
              <span>{regStripText}</span>
              <span className="rl">Regulations ↗</span>
            </div>
          </div>
        </div>
      </header>

      {/* 14-DAY */}
      <section className="band">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">The forecast</span>
            <h2>
              Two weeks out.
              <br />
              Down to the hour.
            </h2>
            <p>
              See the days worth taking off — and the exact window to be on the
              water.
            </p>
          </div>
          <div className="days">
            {props.days.map((d, i) => (
              <div
                key={`${d.dow}-${d.date}-${i}`}
                className={d.isBest ? "day sel" : "day"}
              >
                {d.isBest && <div className="bestbadge">★ BEST</div>}
                <div className="dw">{d.dow}</div>
                <div className="dd">{d.date}</div>
                <div className={dayScoreClass(d.tier)}>{d.score ?? "—"}</div>
                <div className="pk">{d.peak ?? "—"}</div>
              </div>
            ))}
          </div>
          <div className="season">
            {props.seasonMonths.length > 0 && (
              <span className="spark">
                {props.seasonMonths.map((w, i) => (
                  <i
                    key={i}
                    className={w < 0.5 ? "lo" : undefined}
                    style={{ height: `${Math.round(4 + w * 18)}px` }}
                  />
                ))}
              </span>
            )}
            <span className="st">{props.seasonNote}</span>
          </div>
        </div>
      </section>

      {/* MAP */}
      <section className="band">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">The water</span>
            <h2>
              It reads the water so you
              <br />
              don&apos;t have to.
            </h2>
            <p>
              Bottom structure, live currents, wind — the conditions that
              actually move fish, on one live map. Pan, zoom, and filter by
              species.
            </p>
          </div>
          <div
            className="mapwrap"
            style={{ height: "480px", marginTop: "28px" }}
            aria-label={`Live fishing map with depth contours and scored spots near ${props.city}`}
          >
            <MarketingMap
              spots={props.mapSpots}
              center={props.mapCenter}
              zoom={props.mapZoom}
            />
          </div>
        </div>
      </section>

      {/* FRESH CATCH */}
      <section className="band">
        <div className="wrap">
          <div className="split">
            <div className="copy">
              <span className="label">Fresh catch · the differentiator</span>
              <h2>They&apos;re already catching. You&apos;ll know where.</h2>
              <p>
                Fresh reports from the water near you — pulled in daily, pinned
                to the spot they belong to.
              </p>
            </div>
            <div className="fc">
              <div className="fh">
                <span>Fresh catch reports</span>
                <span>Last 21 days</span>
              </div>
              <div className="fr">
                {props.freshActivity && (
                  <span className="hot">{props.freshActivity}</span>
                )}
                <span className="fn">{props.freshCount} recent reports</span>
                {props.freshLatest && (
                  <span className="fa">latest {props.freshLatest}</span>
                )}
              </div>
              <div className="fkey">
                <span>Species</span>
                <span>Landed / reports</span>
              </div>
              <ul>
                {(() => {
                  const maxCount = Math.max(
                    ...props.freshSpecies.map((x) => x.count),
                    1,
                  );
                  return props.freshSpecies.map((s, i) => {
                    const reportPct = Math.round((s.count / maxCount) * 100);
                    const landedPct =
                      s.count > 0
                        ? Math.round((s.positive / s.count) * 100)
                        : 0;
                    return (
                      <li key={`${s.name}-${i}`}>
                        <span className="sp">{s.name}</span>
                        <span className="bar">
                          <i style={{ width: `${reportPct}%` }}>
                            {s.positive > 0 && (
                              <em style={{ width: `${landedPct}%` }} />
                            )}
                          </i>
                        </span>
                        <span className="r">
                          <b>{s.positive}</b> / {s.count}
                        </span>
                      </li>
                    );
                  });
                })()}
              </ul>
              <div className="fnote">
                <span className="k">
                  <span className="sw sw-g" /> Landed
                </span>
                <span className="k">
                  <span className="sw sw-n" /> Reported, no catch
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAKE IT YOURS */}
      <section className="band">
        <div className="wrap">
          <div className="sec-head">
            <span className="label">Make it yours</span>
            <h2>Your spots. Your alerts.</h2>
            <p>Score your own honey hole, and get pinged the moment it turns on.</p>
          </div>
          <div className="yours">
            <div className="tile">
              <h3>Score your own spot</h3>
              <p>
                Drop a pin on your secret mark and get the same 14-day scoring as
                everywhere else.
              </p>
            </div>
            <div className="tile">
              <h3>Never miss the window</h3>
              <p>
                Get an alert when your spot fires — or when a fresh catch lands
                nearby.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="band closing" id="start">
        <div className="in">
          <h2>
            Know the bite in {props.city}.
            <br />
            Before you go.
          </h2>
          <p>Start free and see this week&apos;s best windows for every spot near you.</p>
          <a className="btn btn-primary btn-lg" href="/signup">
            Start Free
          </a>
          <div className="trust" style={{ marginTop: "16px" }}>
            7-day free trial · cancel anytime
          </div>
        </div>
      </section>

      {/* sticky mobile cta */}
      <div className="sticky">
        <div className="t">
          <b>
            {props.city} · {props.species}
          </b>
          <br />
          this week&apos;s bite windows
        </div>
        <a className="btn btn-primary" href="/signup">
          Start Free
        </a>
      </div>
    </div>
  );
}
