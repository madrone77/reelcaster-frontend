"use client";

import { useEffect, useRef } from "react";
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
  .logo svg{height:38px;width:auto;display:block}
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
  .hot{font-family:var(--mono);font-size:11px;font-weight:800;letter-spacing:.06em;background:var(--good);color:#fff;padding:3px 8px;border-radius:var(--r)}
  .fc .fn{font-size:18px;font-weight:800}
  .fc .fa{margin-left:auto;font-family:var(--mono);font-size:11px;color:var(--ink-mute)}
  .fc ul{margin:14px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px}
  .fc li{display:flex;justify-content:space-between;font-size:14px;color:var(--ink-soft);border-top:1px solid var(--rule-soft);padding-top:8px}
  .fc li:first-child{border-top:0;padding-top:0}
  .fc li .r{font-family:var(--mono);color:var(--ink-mute)} .fc li .r b{color:var(--good)}

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
            <svg
              className="rcmark"
              width="139"
              height="64"
              viewBox="0.26 -0.16 138.87 63.97"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3.26025"
                y="2.8418"
                width="132.872"
                height="57.9746"
                fill="none"
                stroke="white"
                strokeWidth="4"
              />
              <mask
                id="path-2-outside-1_679_886"
                maskUnits="userSpaceOnUse"
                x="14.854"
                y="13.2695"
                width="112"
                height="28"
                fill="black"
              >
                <rect fill="white" x="14.854" y="13.2695" width="112" height="28" />
                <path d="M15.6507 13.6695H31.6107C34.2707 13.6695 36.196 14.2775 37.3867 15.4935C38.6027 16.6842 39.2107 18.6095 39.2107 21.2695V24.6895C39.2107 26.7922 38.856 28.4262 38.1467 29.5915C37.4627 30.7569 36.3607 31.5295 34.8407 31.9095L39.5907 40.2695H32.1807L27.8107 32.2895H22.4907V40.2695H15.6507V13.6695ZM32.3707 21.2695C32.3707 19.7495 31.6107 18.9895 30.0907 18.9895H22.4907V26.9695H30.0907C31.6107 26.9695 32.3707 26.2095 32.3707 24.6895V21.2695ZM68.6503 40.2695H47.5603V13.6695H68.6503V18.9895H54.4003V24.1195H65.6103V29.4395H54.4003V34.9495H68.6503V40.2695ZM97.3314 40.2695H76.2414V13.6695H97.3314V18.9895H83.0814V24.1195H94.2914V29.4395H83.0814V34.9495H97.3314V40.2695ZM111.762 34.9495H125.632V40.2695H104.922V13.6695H111.762V34.9495Z" />
              </mask>
              <path
                d="M15.6507 13.6695H31.6107C34.2707 13.6695 36.196 14.2775 37.3867 15.4935C38.6027 16.6842 39.2107 18.6095 39.2107 21.2695V24.6895C39.2107 26.7922 38.856 28.4262 38.1467 29.5915C37.4627 30.7569 36.3607 31.5295 34.8407 31.9095L39.5907 40.2695H32.1807L27.8107 32.2895H22.4907V40.2695H15.6507V13.6695ZM32.3707 21.2695C32.3707 19.7495 31.6107 18.9895 30.0907 18.9895H22.4907V26.9695H30.0907C31.6107 26.9695 32.3707 26.2095 32.3707 24.6895V21.2695ZM68.6503 40.2695H47.5603V13.6695H68.6503V18.9895H54.4003V24.1195H65.6103V29.4395H54.4003V34.9495H68.6503V40.2695ZM97.3314 40.2695H76.2414V13.6695H97.3314V18.9895H83.0814V24.1195H94.2914V29.4395H83.0814V34.9495H97.3314V40.2695ZM111.762 34.9495H125.632V40.2695H104.922V13.6695H111.762V34.9495Z"
                fill="white"
              />
              <path
                d="M15.6507 13.6695V13.2917H15.2729V13.6695H15.6507ZM37.3867 15.4935L37.1167 15.7579L37.1224 15.7635L37.3867 15.4935ZM38.1467 29.5915L37.8239 29.3951L37.8209 29.4003L38.1467 29.5915ZM34.8407 31.9095L34.7491 31.543L34.2664 31.6636L34.5122 32.0962L34.8407 31.9095ZM39.5907 40.2695V40.6474H40.2399L39.9192 40.0829L39.5907 40.2695ZM32.1807 40.2695L31.8493 40.451L31.9568 40.6474H32.1807V40.2695ZM27.8107 32.2895L28.1421 32.1081L28.0346 31.9117H27.8107V32.2895ZM22.4907 32.2895V31.9117H22.1129V32.2895H22.4907ZM22.4907 40.2695V40.6474H22.8685V40.2695H22.4907ZM15.6507 40.2695H15.2729V40.6474H15.6507V40.2695ZM22.4907 18.9895V18.6117H22.1129V18.9895H22.4907ZM22.4907 26.9695H22.1129V27.3474H22.4907V26.9695ZM15.6507 13.6695V14.0474H31.6107V13.6695V13.2917H15.6507V13.6695ZM31.6107 13.6695V14.0474C34.2249 14.0474 36.0284 14.6464 37.1167 15.7579L37.3867 15.4935L37.6567 15.2292C36.3636 13.9086 34.3165 13.2917 31.6107 13.2917V13.6695ZM37.3867 15.4935L37.1224 15.7635C38.2338 16.8518 38.8329 18.6554 38.8329 21.2695H39.2107H39.5885C39.5885 18.5637 38.9716 16.5166 37.651 15.2236L37.3867 15.4935ZM39.2107 21.2695H38.8329V24.6895H39.2107H39.5885V21.2695H39.2107ZM39.2107 24.6895H38.8329C38.8329 26.7574 38.4828 28.3128 37.824 29.3951L38.1467 29.5915L38.4694 29.788C39.2293 28.5396 39.5885 26.827 39.5885 24.6895H39.2107ZM38.1467 29.5915L37.8209 29.4003C37.1965 30.464 36.1877 31.1833 34.7491 31.543L34.8407 31.9095L34.9323 32.2761C36.5337 31.8757 37.7289 31.0497 38.4725 29.7828L38.1467 29.5915ZM34.8407 31.9095L34.5122 32.0962L39.2622 40.4562L39.5907 40.2695L39.9192 40.0829L35.1692 31.7229L34.8407 31.9095ZM39.5907 40.2695V39.8917H32.1807V40.2695V40.6474H39.5907V40.2695ZM32.1807 40.2695L32.5121 40.0881L28.1421 32.1081L27.8107 32.2895L27.4793 32.471L31.8493 40.451L32.1807 40.2695ZM27.8107 32.2895V31.9117H22.4907V32.2895V32.6674H27.8107V32.2895ZM22.4907 32.2895H22.1129V40.2695H22.4907H22.8685V32.2895H22.4907ZM22.4907 40.2695V39.8917H15.6507V40.2695V40.6474H22.4907V40.2695ZM15.6507 40.2695H16.0285V13.6695H15.6507H15.2729V40.2695H15.6507ZM32.3707 21.2695H32.7485C32.7485 20.4513 32.5437 19.7682 32.0679 19.2924C31.592 18.8165 30.9089 18.6117 30.0907 18.6117V18.9895V19.3674C30.7925 19.3674 31.2494 19.5425 31.5335 19.8267C31.8177 20.1108 31.9929 20.5678 31.9929 21.2695H32.3707ZM30.0907 18.9895V18.6117H22.4907V18.9895V19.3674H30.0907V18.9895ZM22.4907 18.9895H22.1129V26.9695H22.4907H22.8685V18.9895H22.4907ZM22.4907 26.9695V27.3474H30.0907V26.9695V26.5917H22.4907V26.9695ZM30.0907 26.9695V27.3474C30.9089 27.3474 31.592 27.1425 32.0679 26.6667C32.5437 26.1908 32.7485 25.5078 32.7485 24.6895H32.3707H31.9929C31.9929 25.3913 31.8177 25.8482 31.5335 26.1324C31.2494 26.4165 30.7925 26.5917 30.0907 26.5917V26.9695ZM32.3707 24.6895H32.7485V21.2695H32.3707H31.9929V24.6895H32.3707ZM68.6503 40.2695V40.6474H69.0281V40.2695H68.6503ZM47.5603 40.2695H47.1825V40.6474H47.5603V40.2695ZM47.5603 13.6695V13.2917H47.1825V13.6695H47.5603ZM68.6503 13.6695H69.0281V13.2917H68.6503V13.6695ZM68.6503 18.9895V19.3674H69.0281V18.9895H68.6503ZM54.4003 18.9895V18.6117H54.0225V18.9895H54.4003ZM54.4003 24.1195H54.0225V24.4974H54.4003V24.1195ZM65.6103 24.1195H65.9881V23.7417H65.6103V24.1195ZM65.6103 29.4395V29.8174H65.9881V29.4395H65.6103ZM54.4003 29.4395V29.0617H54.0225V29.4395H54.4003ZM54.4003 34.9495H54.0225V35.3274H54.4003V34.9495ZM68.6503 34.9495H69.0281V34.5717H68.6503V34.9495ZM68.6503 40.2695V39.8917H47.5603V40.2695V40.6474H68.6503V40.2695ZM47.5603 40.2695H47.9381V13.6695H47.5603H47.1825V40.2695H47.5603ZM47.5603 13.6695V14.0474H68.6503V13.6695V13.2917H47.5603V13.6695ZM68.6503 13.6695H68.2725V18.9895H68.6503H69.0281V13.6695H68.6503ZM68.6503 18.9895V18.6117H54.4003V18.9895V19.3674H68.6503V18.9895ZM54.4003 18.9895H54.0225V24.1195H54.4003H54.7781V18.9895H54.4003ZM54.4003 24.1195V24.4974H65.6103V24.1195V23.7417H54.4003V24.1195ZM65.6103 24.1195H65.2325V29.4395H65.6103H65.9881V24.1195H65.6103ZM65.6103 29.4395V29.0617H54.4003V29.4395V29.8174H65.6103V29.4395ZM54.4003 29.4395H54.0225V34.9495H54.4003H54.7781V29.4395H54.4003ZM54.4003 34.9495V35.3274H68.6503V34.9495V34.5717H54.4003V34.9495ZM68.6503 34.9495H68.2725V40.2695H68.6503H69.0281V34.9495H68.6503ZM97.3314 40.2695V40.6474H97.7092V40.2695H97.3314ZM76.2414 40.2695H75.8636V40.6474H76.2414V40.2695ZM76.2414 13.6695V13.2917H75.8636V13.6695H76.2414ZM97.3314 13.6695H97.7092V13.2917H97.3314V13.6695ZM97.3314 18.9895V19.3674H97.7092V18.9895H97.3314ZM83.0814 18.9895V18.6117H82.7036V18.9895H83.0814ZM83.0814 24.1195H82.7036V24.4974H83.0814V24.1195ZM94.2914 24.1195H94.6692V23.7417H94.2914V24.1195ZM94.2914 29.4395V29.8174H94.6692V29.4395H94.2914ZM83.0814 29.4395V29.0617H82.7036V29.4395H83.0814ZM83.0814 34.9495H82.7036V35.3274H83.0814V34.9495ZM97.3314 34.9495H97.7092V34.5717H97.3314V34.9495ZM97.3314 40.2695V39.8917H76.2414V40.2695V40.6474H97.3314V40.2695ZM76.2414 40.2695H76.6192V13.6695H76.2414H75.8636V40.2695H76.2414ZM76.2414 13.6695V14.0474H97.3314V13.6695V13.2917H76.2414V13.6695ZM97.3314 13.6695H96.9536V18.9895H97.3314H97.7092V13.6695H97.3314ZM97.3314 18.9895V18.6117H83.0814V18.9895V19.3674H97.3314V18.9895ZM83.0814 18.9895H82.7036V24.1195H83.0814H83.4592V18.9895H83.0814ZM83.0814 24.1195V24.4974H94.2914V24.1195V23.7417H83.0814V24.1195ZM94.2914 24.1195H93.9136V29.4395H94.2914H94.6692V24.1195H94.2914ZM94.2914 29.4395V29.0617H83.0814V29.4395V29.8174H94.2914V29.4395ZM83.0814 29.4395H82.7036V34.9495H83.0814H83.4592V29.4395H83.0814ZM83.0814 34.9495V35.3274H97.3314V34.9495V34.5717H83.0814V34.9495ZM97.3314 34.9495H96.9536V40.2695H97.3314H97.7092V34.9495H97.3314ZM111.762 34.9495H111.385V35.3274H111.762V34.9495ZM125.632 34.9495H126.01V34.5717H125.632V34.9495ZM125.632 40.2695V40.6474H126.01V40.2695H125.632ZM104.922 40.2695H104.545V40.6474H104.922V40.2695ZM104.922 13.6695V13.2917H104.545V13.6695H104.922ZM111.762 13.6695H112.14V13.2917H111.762V13.6695ZM111.762 34.9495V35.3274H125.632V34.9495V34.5717H111.762V34.9495ZM125.632 34.9495H125.255V40.2695H125.632H126.01V34.9495H125.632ZM125.632 40.2695V39.8917H104.922V40.2695V40.6474H125.632V40.2695ZM104.922 40.2695H105.3V13.6695H104.922H104.545V40.2695H104.922ZM104.922 13.6695V14.0474H111.762V13.6695V13.2917H104.922V13.6695ZM111.762 13.6695H111.385V34.9495H111.762H112.14V13.6695H111.762Z"
                fill="white"
                mask="url(#path-2-outside-1_679_886)"
              />
              <path
                d="M21.8302 49.239H20.4097C20.3908 49.0932 20.352 48.9615 20.2933 48.8441C20.2345 48.7267 20.1569 48.6263 20.0603 48.543C19.9637 48.4596 19.8491 48.3962 19.7165 48.3526C19.5859 48.3072 19.441 48.2844 19.2819 48.2844C18.9997 48.2844 18.7563 48.3536 18.5518 48.4918C18.3491 48.6301 18.1929 48.8299 18.083 49.0913C17.9751 49.3526 17.9211 49.6689 17.9211 50.0401C17.9211 50.4265 17.976 50.7504 18.0859 51.0117C18.1976 51.2712 18.3539 51.4672 18.5546 51.5998C18.7573 51.7305 18.9969 51.7958 19.2734 51.7958C19.4287 51.7958 19.5698 51.7759 19.6967 51.7362C19.8254 51.6964 19.9381 51.6386 20.0347 51.5629C20.1332 51.4852 20.2137 51.3915 20.2762 51.2816C20.3406 51.1699 20.3851 51.0439 20.4097 50.9038L21.8302 50.9123C21.8056 51.1699 21.7308 51.4237 21.6058 51.6737C21.4826 51.9237 21.3131 52.1519 21.0972 52.3583C20.8813 52.5629 20.6181 52.7257 20.3075 52.8469C19.9987 52.9682 19.6446 53.0288 19.245 53.0288C18.7184 53.0288 18.2469 52.9132 17.8302 52.6822C17.4154 52.4492 17.0878 52.1102 16.8472 51.6651C16.6067 51.2201 16.4864 50.6784 16.4864 50.0401C16.4864 49.4 16.6086 48.8574 16.8529 48.4123C17.0972 47.9672 17.4277 47.6291 17.8444 47.3981C18.2611 47.167 18.7279 47.0515 19.245 47.0515C19.5972 47.0515 19.923 47.1007 20.2222 47.1992C20.5215 47.2958 20.7847 47.4379 21.012 47.6254C21.2393 47.811 21.4239 48.0392 21.566 48.31C21.708 48.5808 21.7961 48.8905 21.8302 49.239ZM39.025 52.9492H37.5136L39.4767 47.131H41.3488L43.3119 52.9492H41.8005L40.434 48.5969H40.3886L39.025 52.9492ZM38.8233 50.6594H41.9823V51.7276H38.8233V50.6594ZM62.1835 48.8754C62.1646 48.667 62.0803 48.5051 61.9307 48.3896C61.7829 48.2721 61.5718 48.2134 61.2971 48.2134C61.1153 48.2134 60.9638 48.2371 60.8426 48.2844C60.7214 48.3318 60.6305 48.3971 60.5699 48.4805C60.5093 48.5619 60.478 48.6557 60.4761 48.7617C60.4723 48.8488 60.4894 48.9255 60.5273 48.9918C60.567 49.0581 60.6238 49.1168 60.6977 49.168C60.7735 49.2172 60.8644 49.2608 60.9704 49.2987C61.0765 49.3365 61.1958 49.3697 61.3284 49.3981L61.8284 49.5117C62.1163 49.5742 62.3701 49.6576 62.5898 49.7617C62.8113 49.8659 62.997 49.9899 63.1466 50.1339C63.2981 50.2778 63.4127 50.4435 63.4903 50.631C63.568 50.8185 63.6077 51.0288 63.6096 51.2617C63.6077 51.6291 63.5149 51.9445 63.3312 52.2077C63.1475 52.471 62.8833 52.6727 62.5386 52.8129C62.1958 52.953 61.782 53.0231 61.2971 53.0231C60.8104 53.0231 60.3862 52.9502 60.0244 52.8043C59.6627 52.6585 59.3814 52.4369 59.1807 52.1396C58.9799 51.8422 58.8767 51.4663 58.871 51.0117H60.2176C60.229 51.1992 60.2791 51.3555 60.3682 51.4805C60.4572 51.6055 60.5793 51.7002 60.7346 51.7646C60.8918 51.829 61.0737 51.8612 61.2801 51.8612C61.4695 51.8612 61.6305 51.8356 61.7631 51.7844C61.8975 51.7333 62.0007 51.6623 62.0727 51.5714C62.1447 51.4805 62.1816 51.3763 62.1835 51.2589C62.1816 51.149 62.1475 51.0553 62.0812 50.9776C62.0149 50.8981 61.9127 50.8299 61.7744 50.7731C61.6381 50.7144 61.4638 50.6604 61.2517 50.6112L60.6437 50.4691C60.1399 50.3536 59.7432 50.167 59.4534 49.9094C59.1636 49.65 59.0197 49.2996 59.0216 48.8583C59.0197 48.4985 59.1163 48.1831 59.3113 47.9123C59.5064 47.6415 59.7763 47.4303 60.121 47.2788C60.4657 47.1272 60.8587 47.0515 61.3 47.0515C61.7507 47.0515 62.1418 47.1282 62.4733 47.2816C62.8066 47.4331 63.0651 47.6462 63.2488 47.9208C63.4326 48.1954 63.5263 48.5136 63.5301 48.8754H62.1835ZM79.4095 48.2731V47.131H84.3271V48.2731H82.5629V52.9492H81.1766V48.2731H79.4095ZM100.294 52.9492V47.131H104.351V48.2731H101.7V49.4663H104.143V50.6112H101.7V51.8072H104.351V52.9492H100.294ZM120.511 52.9492V47.131H122.915C123.35 47.131 123.726 47.2096 124.043 47.3668C124.361 47.5221 124.606 47.7456 124.778 48.0373C124.951 48.3271 125.037 48.6708 125.037 49.0685C125.037 49.4719 124.949 49.8147 124.773 50.0969C124.597 50.3772 124.347 50.5913 124.023 50.739C123.699 50.8848 123.315 50.9577 122.872 50.9577H121.352V49.8498H122.611C122.823 49.8498 123 49.8223 123.142 49.7674C123.286 49.7106 123.395 49.6254 123.469 49.5117C123.543 49.3962 123.58 49.2485 123.58 49.0685C123.58 48.8886 123.543 48.7399 123.469 48.6225C123.395 48.5032 123.286 48.4142 123.142 48.3555C122.998 48.2949 122.821 48.2646 122.611 48.2646H121.918V52.9492H120.511ZM123.787 50.2901L125.236 52.9492H123.702L122.281 50.2901H123.787Z"
                fill="white"
              />
            </svg>
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
            <h2>Two weeks out. Down to the hour.</h2>
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
          <div className="split">
            <div className="copy">
              <span className="label">The water</span>
              <h2>It reads the water so you don&apos;t have to.</h2>
              <p>
                Bottom structure, live currents, wind — the conditions that
                actually move fish, on one map. Tap a layer.
              </p>
            </div>
            <div
              className="mapwrap"
              style={{ height: "420px" }}
              aria-label={`Nautical chart with depth contours and scored spots near ${props.city}`}
            >
              <MarketingMap
                spots={props.mapSpots}
                species={props.mapSpecies}
                center={props.mapCenter}
                zoom={props.mapZoom}
              />
            </div>
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
              <ul>
                {props.freshSpecies.map((s, i) => (
                  <li key={`${s.name}-${i}`}>
                    <span>{s.name}</span>
                    <span className="r">
                      <b>{s.positive}</b> / {s.count}
                    </span>
                  </li>
                ))}
              </ul>
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
