/**
 * Shared stylesheet for the /lp/* cold-traffic landing pages.
 *
 * Kept as a self-contained string, deliberately independent of the app's global
 * CSS, so these pages stay pixel-identical to their sign-off — the same
 * treatment /lp/1/[city] uses. Every variant renders inside a `.lp` root, so
 * all selectors are scoped to it and nothing leaks into the rest of the app.
 *
 * /lp/2 and /lp/3 share this file on purpose: they are an A/B pair whose only
 * intended difference is the hero. If the stylesheet were duplicated, a fix
 * applied to one would silently not reach the other, and the test would end up
 * measuring drift instead of the hero.
 */
export const LP_CSS = `

  .lp{
    --navy:#0E1B47;
    --blue:#2447E0;
    --blue-dark:#1B36AE;
    --ink:#0B1220;
    --muted:#5B6478;
    --line:#E4E7F0;
    --bg:#F6F7FB;
    --card:#FFFFFF;
    --good:#16A34A;
    --good-bg:#DCFCE7;
    --fair:#B45309;
    --fair-bg:#FEF3C7;
    --poor:#B91C1C;
    --poor-bg:#FEE2E2;
    --radius:14px;
    --mono:var(--font-plex-mono,'IBM Plex Mono'),ui-monospace,Menlo,monospace;
    --sans:var(--font-inter,'Inter'),-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;

    font-family:var(--sans);color:var(--ink);background:var(--bg);
    line-height:1.5;font-size:16px;-webkit-text-size-adjust:100%;
  }
  .lp *{margin:0;padding:0;box-sizing:border-box}
  .lp .wrap{max-width:480px;margin:0 auto;padding:0 20px}

  /* ---------- utility ---------- */
  .lp .mono-label{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
  .lp .btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:56px;
    background:var(--blue);color:#fff;border:none;border-radius:999px;
    font-size:17px;font-weight:700;font-family:var(--sans);cursor:pointer;text-decoration:none;
    transition:background .15s ease,transform .1s ease}
  .lp .btn:active{background:var(--blue-dark);transform:scale(.99)}
  .lp .btn:focus-visible{outline:3px solid var(--navy);outline-offset:2px}
  .lp .cta-micro{text-align:center;font-size:13px;color:var(--muted);margin-top:10px}
  .lp .cta-micro strong{color:var(--ink);font-weight:600}

  /* ---------- header ---------- */
  .lp header{background:#fff;border-bottom:1px solid var(--line)}
  /* The inline padding is repeated here on purpose. This element carries BOTH
     classes, wrap and header-row, and a padding shorthand on the second one
     wins over .wrap's 0 20px — so the original 14px 0 silently zeroed the
     gutter and pinned the mark and the chip to the screen edges. Matching 20px
     also keeps the mark aligned with the headline underneath it.
     (No backticks in here: this whole file is one template literal.) */
  .lp .header-row{display:flex;align-items:center;justify-content:space-between;
    gap:12px;padding:16px 20px}
  .lp .logo{display:inline-flex;align-items:center}
  .lp .logo img{display:block;height:42px;width:auto}
  .lp .trust-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);
    font-size:10px;letter-spacing:.1em;color:var(--muted);
    background:var(--bg);border:1px solid var(--line);border-radius:999px;padding:6px 10px}
  .lp .trust-chip::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--good)}

  /* ---------- hero ---------- */
  .lp .hero{background:#fff;padding:28px 0 0}
  .lp .eyebrow{display:inline-block;font-family:var(--mono);font-size:10px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--blue);font-weight:600;margin-bottom:12px}
  .lp h1{font-size:clamp(32px,9vw,40px);line-height:1.06;font-weight:800;letter-spacing:-.025em;color:var(--navy)}
  .lp h1 .accent{color:var(--blue)}
  .lp .subhead{margin-top:14px;font-size:16.5px;color:var(--muted);max-width:34ch}
  /* City line. Deliberately a sentence rather than a second mono chip — the
     eyebrow directly above is already mono/uppercase/blue, and two of those
     stacked read as one repeated element instead of two facts. */
  .lp .locality{margin-top:12px;font-size:14.5px;font-weight:600;color:var(--ink)}

  /* ---------- score card (signature) ---------- */
  .lp .score-card{margin-top:26px;background:var(--card);border:1px solid var(--line);
    border-radius:var(--radius);box-shadow:0 10px 30px rgba(14,27,71,.10),0 2px 6px rgba(14,27,71,.06);
    overflow:hidden}
  .lp .score-card-top{display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;border-bottom:1px solid var(--line)}
  .lp .live-badge{display:inline-flex;align-items:center;gap:6px;font-family:var(--mono);
    font-size:10px;letter-spacing:.16em;color:var(--good);font-weight:600}
  .lp .live-dot{width:7px;height:7px;border-radius:50%;background:var(--good);animation:lp2pulse 2s ease-in-out infinite}
  @keyframes lp2pulse{0%,100%{opacity:1}50%{opacity:.35}}
  @media (prefers-reduced-motion: reduce){.lp .live-dot{animation:none}}
  .lp .score-card-body{padding:16px}
  .lp .spot-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .lp .spot-name{font-size:20px;font-weight:800;letter-spacing:-.01em;color:var(--navy)}
  .lp .spot-meta{margin-top:3px;font-family:var(--mono);font-size:10.5px;letter-spacing:.06em;color:var(--muted)}
  .lp .score-big{text-align:right;flex-shrink:0}
  .lp .score-num{font-size:46px;font-weight:800;line-height:1;letter-spacing:-.03em;color:var(--good)}
  .lp .score-num.score-fair{color:var(--fair)}
  .lp .score-num.score-poor{color:var(--poor)}
  .lp .score-tag.tag-fair{background:var(--fair-bg);color:var(--fair)}
  .lp .score-tag.tag-poor{background:var(--poor-bg);color:var(--poor)}
  .lp .score-tag{display:inline-block;margin-top:4px;background:var(--good-bg);color:var(--good);
    font-family:var(--mono);font-size:10px;letter-spacing:.14em;font-weight:700;
    padding:3px 9px;border-radius:5px}
  .lp .window-band{margin-top:14px;background:var(--good-bg);border-radius:10px;padding:12px 14px;text-align:center}
  .lp .window-band.band-fair{background:var(--fair-bg)}
  .lp .window-band.band-poor{background:var(--poor-bg)}
  .lp .window-band.band-fair .mono-label{color:var(--fair)}
  .lp .window-band.band-poor .mono-label{color:var(--poor)}
  .lp .window-band .mono-label{color:var(--good)}
  .lp .window-time{font-size:22px;font-weight:800;color:var(--navy);letter-spacing:-.01em;margin-top:2px}
  .lp .window-note{font-size:12.5px;color:var(--muted);margin-top:2px}
  .lp .hours{display:flex;align-items:flex-end;gap:3px;height:52px;margin-top:16px}
  .lp .hours .bar{flex:1;border-radius:2.5px 2.5px 0 0;background:#D8DCEA;min-height:6px}
  .lp .hours .bar.on{background:var(--good)}
  .lp .hours .bar.on.bar-fair{background:var(--fair)}
  .lp .hours .bar.on.bar-poor{background:var(--poor)}
  .lp .hours-axis{display:flex;justify-content:space-between;margin-top:6px;
    font-family:var(--mono);font-size:9px;letter-spacing:.08em;color:var(--muted)}
  .lp .catch-line{display:flex;align-items:center;gap:7px;margin-top:14px;padding-top:13px;
    border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
  .lp .catch-line::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--good);flex-shrink:0}
  .lp .catch-line strong{color:var(--ink)}
  /* The primary CTA sits in its own band under whichever hero the variant
     renders, so /lp/2 and /lp/3 present an identical button in an identical
     position and the test isolates the hero above it. */
  .lp .hero-cta-band{background:#fff;padding:22px 0 34px}

  /* ---------- trial timeline ---------- */
  .lp .section{padding:34px 0}
  .lp .section.white{background:#fff}
  .lp .section-kicker{font-family:var(--mono);font-size:10.5px;letter-spacing:.16em;
    text-transform:uppercase;color:var(--blue);font-weight:600;margin-bottom:14px}
  .lp .timeline{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:20px}
  .lp .t-step{display:flex;gap:14px;position:relative;padding-bottom:22px}
  .lp .t-step:last-child{padding-bottom:0}
  .lp .t-step:not(:last-child)::before{content:'';position:absolute;left:15px;top:34px;bottom:2px;
    width:2px;background:var(--line)}
  .lp .t-icon{width:32px;height:32px;flex-shrink:0;border-radius:50%;background:var(--bg);
    border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:14px}
  /* The prototype filled this step navy but never set a colour, leaving the ✓
     at the inherited near-black ink on navy — invisible. */
  .lp .t-step.charged .t-icon{background:var(--navy);border-color:var(--navy);color:#fff}
  .lp .t-body{padding-top:4px}
  .lp .t-day{font-size:15.5px;font-weight:700;color:var(--navy)}
  .lp .t-desc{font-size:14px;color:var(--muted);margin-top:1px}
  .lp .t-desc strong{color:var(--ink)}
  .lp .price-plain{margin-top:16px;text-align:center;font-size:15px;color:var(--ink)}
  .lp .price-plain b{font-weight:800;color:var(--navy)}
  .lp .price-anchor{text-align:center;font-size:13px;color:var(--muted);margin-top:4px}

  /* ---------- feature stack ---------- */
  .lp .feature{display:flex;gap:16px;padding:20px 0;border-bottom:1px solid var(--line)}
  .lp .feature:last-child{border-bottom:none}
  .lp .f-thumb{width:64px;height:64px;flex-shrink:0;border-radius:12px;border:1px solid var(--line);
    background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .lp .f-thumb svg{display:block}
  .lp .f-title{font-size:16.5px;font-weight:700;color:var(--navy)}
  .lp .f-desc{font-size:14px;color:var(--muted);margin-top:2px}
  .lp .f-pro{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.14em;
    color:var(--blue);border:1px solid var(--blue);border-radius:4px;padding:2px 6px;
    margin-left:6px;vertical-align:2px}

  /* ---------- proof ---------- */
  .lp .stat-band{display:flex;gap:12px}
  /* min-width:0 + a fluid size so a word-length value ("Hourly") or a longer
     real number cannot burst the tile — flex items default to min-width:auto,
     which refuses to shrink below their content. */
  .lp .stat{flex:1;min-width:0;background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:16px 10px;text-align:center}
  .lp .stat-num{font-size:clamp(19px,5.6vw,26px);font-weight:800;color:var(--navy);
    letter-spacing:-.02em;overflow-wrap:anywhere}
  .lp .stat-label{font-family:var(--mono);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;
    color:var(--muted);margin-top:4px}
  .lp .quote{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);
    padding:18px;margin-top:12px}
  .lp .quote p{font-size:15px;color:var(--ink)}
  .lp .quote-attr{margin-top:10px;font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;color:var(--muted)}

  /* ---------- score distillation ---------- */
  .lp .distill{display:flex;flex-direction:column;align-items:center}
  .lp .d-score.d-fair{background:var(--fair);box-shadow:0 8px 20px rgba(180,83,9,.28)}
  .lp .d-score.d-poor{background:var(--poor);box-shadow:0 8px 20px rgba(185,28,28,.28)}
  .lp .d-score{background:var(--good);color:#fff;border-radius:12px;padding:12px 26px 10px;
    text-align:center;box-shadow:0 8px 20px rgba(22,163,74,.28)}
  .lp .d-score .mono-label{color:rgba(255,255,255,.75);font-size:8.5px}
  .lp .d-num{display:block;font-size:36px;font-weight:800;line-height:1.05;letter-spacing:-.02em}
  .lp .d-tag{display:inline-block;font-family:var(--mono);font-size:9px;letter-spacing:.18em;
    background:rgba(255,255,255,.22);border-radius:4px;padding:2px 9px;margin-top:4px}
  .lp .d-line{width:2px;height:26px;background:var(--line);position:relative}
  .lp .d-line::after{content:'';position:absolute;left:50%;bottom:-3px;transform:translateX(-50%);
    width:7px;height:7px;border-radius:50%;background:var(--navy)}
  .lp .d-stack{width:100%;display:flex;flex-direction:column;gap:7px;margin-top:8px}
  .lp .d-layer{display:flex;border-radius:8px;overflow:hidden;box-shadow:0 3px 0 rgba(14,27,71,.16)}
  .lp .d-layer .d-label{flex:1.25;background:var(--blue);color:#fff;font-family:var(--mono);
    font-size:11px;letter-spacing:.05em;font-weight:600;padding:12px;display:flex;align-items:center}
  .lp .d-layer .d-src{flex:1;background:#fff;border:1px solid var(--line);border-left:none;
    color:var(--navy);font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;
    padding:12px;display:flex;align-items:center;justify-content:flex-end;text-align:right}
  .lp .d-layer.top .d-label{background:var(--good-bg);color:var(--good)}
  .lp .d-layer.top .d-src{background:var(--good-bg);border-color:var(--good-bg);color:var(--good)}
  .lp .d-caption{margin-top:14px;font-size:13px;color:var(--muted);text-align:center;max-width:32ch}

  /* ---------- FAQ ---------- */
  .lp details{background:var(--card);border:1px solid var(--line);border-radius:12px;
    padding:0 16px;margin-bottom:10px}
  .lp summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;
    gap:12px;padding:15px 0;font-size:15px;font-weight:600;color:var(--navy)}
  .lp summary::-webkit-details-marker{display:none}
  .lp summary::after{content:'+';font-size:20px;font-weight:400;color:var(--muted);transition:transform .15s}
  .lp details[open] summary::after{transform:rotate(45deg)}
  .lp .faq-a{padding:0 0 15px;font-size:14px;color:var(--muted)}

  /* ---------- final CTA / footer ---------- */
  .lp .final{background:var(--navy);padding:40px 0 44px}
  .lp .final h2{color:#fff;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.15;text-align:center}
  .lp .final .cta-micro{color:rgba(255,255,255,.65)}
  .lp .final .cta-micro strong{color:#fff}
  .lp .final .btn{margin-top:20px}
  .lp footer{background:var(--navy);border-top:1px solid rgba(255,255,255,.12);padding:22px 0 34px}
  .lp footer .wrap{display:flex;flex-wrap:wrap;gap:8px 18px;justify-content:center}
  .lp footer a,.lp footer span{font-size:12px;color:rgba(255,255,255,.55);text-decoration:none}

  /* ---------- sticky CTA ---------- */
  .lp .sticky-cta{position:fixed;left:0;right:0;bottom:0;z-index:50;
    background:rgba(255,255,255,.96);backdrop-filter:blur(8px);
    border-top:1px solid var(--line);padding:10px 20px calc(10px + env(safe-area-inset-bottom));
    transform:translateY(110%);transition:transform .25s ease}
  .lp .sticky-cta.show{transform:translateY(0)}
  .lp .sticky-inner{max-width:480px;margin:0 auto;display:flex;align-items:center;gap:12px}
  .lp .sticky-price{flex-shrink:0}
  .lp .sticky-price b{display:block;font-size:14px;font-weight:800;color:var(--navy);line-height:1.2}
  .lp .sticky-price span{font-size:11px;color:var(--muted)}
  .lp .sticky-cta .btn{min-height:48px;font-size:15.5px}

  @media (min-width:480px){
    .lp{background:#EDEFF6}
    .lp .page{max-width:480px;margin:0 auto;background:var(--bg);box-shadow:0 0 60px rgba(14,27,71,.08)}
  }

  /* ---------- image hero (/lp/3 only) ---------- */
  /* Navy underneath the photo, not white: the caption is white text, and the
     seeded Unsplash heroes are documented as able to 404. On a white ground a
     missing image would leave the headline invisible; on navy it still reads. */
  .lp .hero-photo{position:relative;height:clamp(300px,54vh,440px);background:var(--navy);overflow:hidden}
  .lp .hero-photo img{object-fit:cover}
  .lp .hero-photo::after{content:'';position:absolute;inset:0;
    background:linear-gradient(to bottom,rgba(14,27,71,0) 0%,rgba(14,27,71,.12) 38%,rgba(14,27,71,.86) 100%)}
  /* Bottom padding clears the score card, which climbs 34px back over this
     seam — without it the card crops the last line of the subhead. */
  .lp .hero-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding-bottom:54px}
  .lp .hero-cap h1{color:#fff;text-shadow:0 2px 14px rgba(9,16,40,.45)}
  .lp .hero-cap h1 .accent{color:#A8BCFF}
  .lp .hero-cap .subhead{color:rgba(255,255,255,.86);margin-top:10px;text-shadow:0 1px 10px rgba(9,16,40,.5)}
  .lp .hero-cap .eyebrow{color:#A8BCFF}
  .lp .hero-cap .locality{color:#fff;text-shadow:0 1px 10px rgba(9,16,40,.5)}
  /* Photo section runs to the edge; the score card climbs back over the seam so
     the product proof is attached to the image rather than floating below it. */
  .lp .hero.photo{padding:0;background:#fff}
  .lp .hero.photo .score-card{margin-top:-34px;position:relative;z-index:3}
`
