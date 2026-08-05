"use client";

import { useEffect, useRef, useState } from "react";
import type { SunHours } from "@/lib/bluecaster/live-spot-types";
import { niceCurrentScale } from "../../lib/current-series";
import { monoInterp as interp } from "../../lib/curve";
import {
  weatherFromHour,
  weatherIconMarkup,
  type WeatherCondition,
} from "./weather-icon";
import { useUnitPreferences } from "@/contexts/unit-preferences-context";
import {
  WIND_LABELS,
  convertWind,
  convertTemp,
  convertHeight,
  type WindUnit,
  type TempUnit,
  type PrecipUnit,
  type HeightUnit,
} from "@/app/utils/unit-conversions";

/** Display-unit prefs used by this panel (source data stays kn/m/°C/mm). */
type TerminalUnits = {
  windUnit: WindUnit;
  tempUnit: TempUnit;
  precipUnit: PrecipUnit;
  heightUnit: HeightUnit;
};

/** Per-hour arrays (length 24) for the day being shown. */
export type TerminalHours = {
  score: (number | null)[];
  tide: (number | null)[];
  wind: (number | null)[];
  gust: (number | null)[];
  windDir: (number | null)[];
  sea: (number | null)[];
  cloud: (number | null)[];
  precip: (number | null)[];
  air: (number | null)[];
};

const C = {
  brand: "#1E40E0",
  ink: "#0F172A",
  soft: "#334155",
  muted: "#64748B",
  faint: "#94A3B8",
  rule: "#E2E8F0",
  ruleSoft: "#EEF2F6",
  slack: "#059669",
  wind:"#818CF8",
  r: ["#059669", "#65A30D", "#CA8A04", "#EA580C", "#E11D48"],
};

const num = (v: number | null | undefined) =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const ratingIdx = (s: number) =>
  s >= 75 ? 0 : s >= 55 ? 2 : 4;
// Score-cell colors match the 14-day report tiers exactly (rc-good / rc-fair / rc-poor).
const ratingCol = (s: number | null) =>
  s == null ? "#CBD5E1" : s >= 75 ? "#16A34A" : s >= 55 ? "#D78711" : "#DC2626";
// Score STRIP cells use the soft-tint paradigm — pale tier fill + dark tier ink,
// same as the BEST WINDOW callout and DFO notice (not solid saturated blocks).
const ratingBg = (s: number | null) =>
  s == null ? "#F1F5F9" : s >= 75 ? "#DCFCE7" : s >= 55 ? "#FEF3C7" : "#FEE2E2";
const ratingInk = (s: number | null) =>
  s == null ? "#8A92A4" : s >= 75 ? "#166534" : s >= 55 ? "#92400E" : "#991B1B";
const verdict = (s: number | null) =>
  s == null ? "—" : ["Good", "Good", "Fair", "Slow", "Poor"][ratingIdx(s)];
const WNAMES = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const windName = (d: number | null) => (d == null ? "—" : WNAMES[Math.round(d / 22.5) % 16]);
const seaWord = (m: number | null) =>
  m == null ? "—" : m < 0.2 ? "Calm" : m < 0.35 ? "Rippled" : m < 0.65 ? "Light" : m < 1 ? "Chop" : "Rough";
const airWord = (t: number | null) => (t == null ? "—" : t < 11 ? "Cold" : t < 18 ? "Mild" : "Warm");
const hh = (t: number) => {
  let h = Math.floor(t);
  let m = Math.round((t - h) * 60);
  if (m === 60) { h++; m = 0; }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/**
 * Fallback pseudo-current from the tide rate: flood(+) on rising, ebb(−) on
 * falling, slack at turns. Timing is real; the ±1.6 kn magnitude is invented
 * (normalized), so this only draws when the real predicted series
 * (`realCurrent` prop) hasn't loaded or has no coverage at the spot.
 */
function deriveCurrent(tide: (number | null)[]): (number | null)[] {
  const n = tide.length;
  const raw = tide.map((_, i) => {
    const a = num(tide[Math.max(0, i - 1)]);
    const b = num(tide[Math.min(n - 1, i + 1)]);
    if (a == null || b == null) return null;
    return b - a;
  });
  const max = Math.max(0.001, ...raw.map((r) => (r == null ? 0 : Math.abs(r))));
  return raw.map((r) => (r == null ? null : (r / max) * 1.6));
}

/** Current-row config: signed series, full-scale (kn), and slack threshold. */
type CurrentRow = { v: (number | null)[]; scale: number; thr: number };

/** Tide-row scale (m). Whole-metre bounds so ticks stay clean. */
type TideScale = { mn: number; mx: number };

/**
 * Tide scale from the observed range — 0–3 m covers a typical Victoria day,
 * but Salish Sea tides run past 4 m (and below datum), so grow the bounds to
 * whole metres around whatever range the spot actually sees. `range` is the
 * multi-day min/max so the scale holds steady while flipping days.
 */
function tideScale(
  tide: (number | null)[],
  range: { min: number; max: number } | null | undefined,
): TideScale {
  const vals = tide.filter((v): v is number => num(v) != null);
  const lo = Math.min(range?.min ?? 0, ...(vals.length ? [Math.min(...vals)] : []));
  const hi = Math.max(range?.max ?? 3, ...(vals.length ? [Math.max(...vals)] : []));
  return { mn: Math.min(0, Math.floor(lo)), mx: Math.max(3, Math.ceil(hi)) };
}

const tickFmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function currentRow(
  realCurrent: (number | null)[] | null | undefined,
  tide: (number | null)[],
): CurrentRow {
  const v = realCurrent ?? deriveCurrent(tide);
  const scale = realCurrent ? niceCurrentScale(realCurrent) : 2;
  // Slack band: near-zero flow relative to the day's range, clamped so weak-
  // current spots don't read "slack all day" and strong ones aren't too strict.
  const thr = Math.min(0.3, Math.max(0.1, 0.2 * scale));
  return { v, scale, thr };
}

/**
 * An extreme must rise/fall at least this fraction of the series' own range to
 * count as a real turn. 8% of a 7.5ft tide day ≈ 0.6ft — well under any true
 * high/low, well over hourly-prediction wobble.
 */
const MIN_PROMINENCE = 0.08;

type Extreme = { i: number; v: number; hi: boolean };

/**
 * Local extremes (peaks/troughs) with hour + value.
 *
 * Raw local-max/min detection is not enough. A broad tide peak wobbles at the
 * top — 9.24 → 9.15 → 9.10 → 9.14 on real hourly data — and each ~0.1ft jitter
 * registers as a genuine low then high, so one evening high drew three stacked
 * "H 9.2ft / L / H" annotations. Note they ALTERNATE, so collapsing
 * same-kind neighbours doesn't help; the filter has to be prominence.
 *
 * Least-prominent-pair-first removal: repeatedly drop the adjacent pair whose
 * values differ by less than MIN_PROMINENCE of the range (both members — an
 * adjacent low/high that barely differ are the same wobble), then merge any
 * same-kind neighbours left behind, keeping the true extreme. Whether the
 * wobble appears at all depends on the station's curve, which is why one spot
 * showed it and its neighbour didn't.
 */
function extremes(arr: (number | null)[]): Extreme[] {
  const raw: Extreme[] = [];
  for (let i = 1; i < arr.length - 1; i++) {
    const p = num(arr[i - 1]), c = num(arr[i]), nx = num(arr[i + 1]);
    if (p == null || c == null || nx == null) continue;
    if (c > p && c >= nx) raw.push({ i, v: c, hi: true });
    else if (c < p && c <= nx) raw.push({ i, v: c, hi: false });
  }
  if (raw.length < 2) return raw;

  const vals = arr.map(num).filter((v): v is number => v != null);
  const range = Math.max(...vals) - Math.min(...vals);
  if (!(range > 0)) return raw;
  const minDelta = range * MIN_PROMINENCE;

  let ex = raw;
  while (ex.length >= 2) {
    // Prominence of each turn = the smaller of its rise and its fall. Drop the
    // weakest one at a time, NOT both sides of a weak pair: when the wobble sits
    // at the end of the day, the pair is (real high, jitter low) and removing
    // both throws away the day's actual high tide.
    let worst = -1;
    let worstProm = Infinity;
    for (let i = 0; i < ex.length; i++) {
      const dPrev = i > 0 ? Math.abs(ex[i].v - ex[i - 1].v) : Infinity;
      const dNext = i < ex.length - 1 ? Math.abs(ex[i].v - ex[i + 1].v) : Infinity;
      const prom = Math.min(dPrev, dNext);
      // `<=` so ties resolve to the LATER extreme — a trailing wobble is the
      // artefact; the earlier turn is the one anglers are reading.
      if (prom <= worstProm) { worstProm = prom; worst = i; }
    }
    if (worst < 0 || worstProm >= minDelta) break;
    ex = ex.filter((_, i) => i !== worst);
    // Removing one can leave two same-kind extremes adjacent; keep the real one.
    const merged: Extreme[] = [];
    for (const e of ex) {
      const last = merged[merged.length - 1];
      if (last && last.hi === e.hi) {
        if (e.hi ? e.v > last.v : e.v < last.v) merged[merged.length - 1] = e;
        continue;
      }
      merged.push(e);
    }
    ex = merged;
  }
  return ex;
}

type Dims = { w: number; LABEL: number; READ: number; mobile: boolean; id: string };

// Hover-pill geometry (desktop). TAG_PAD is the horizontal breathing room on
// each side of the label — the pill used to be a fixed 104px box that the
// longest readouts ("11:00 · 100 Good") overflowed on both sides.
const TAG_H = 20, TAG_GAP = 5, TAG_PAD = 10, TAG_MIN_W = 64;

// Gutter widths shared by buildSvg, the pointer math, and the cursor mover —
// mobile needs a real left gutter or the y-axis ticks clip off the canvas.
const gutters = (mob: boolean) =>
  mob ? { LABEL: 36, READ: 10 } : { LABEL: 132, READ: 72 };

function buildSvg(
  hours: TerminalHours,
  cur: CurrentRow,
  ts: TideScale,
  sun: SunHours,
  best: [number, number] | null,
  d: Dims,
  u: TerminalUnits,
): string {
  const current = cur.v;
  const { LABEL, READ, w: W, mobile: mob, id } = d;
  // Display-only conversions — every scale/threshold below stays in source
  // units (kn/m/°C); only tick labels, captions and annotations convert.
  const cvW = (v: number) => convertWind(v, "knots", u.windUnit);
  const cvH = (v: number) => convertHeight(v, "m", u.heightUnit);
  const cvT = (v: number) => convertTemp(v, "C", u.tempUnit);
  const wLbl = WIND_LABELS[u.windUnit];
  const x0 = LABEL, x1 = W - READ, cw = x1 - x0, hw = cw / 24;
  // Annotations (H/L, SLACK, wind names…) need roomy hour cells — that's all
  // desktop widths, plus the mobile variant when it renders at tablet width.
  const wide = !mob || hw > 22;
  const base = mob ? 0.62 : 1;
  const rows = [
    { k: "score", l: "Score", n: "colour = rating", h: mob ? 20 : 34 },
    { k: "tide", l: "Tide", n: `${u.heightUnit} · ${tickFmt(cvH(ts.mn))}–${tickFmt(cvH(ts.mx))} fixed`, h: 116 * base },
    { k: "cur", l: "Current", n: `${wLbl} · +flood −ebb`, h: 128 * base },
    { k: "wind", l: "Wind", n: `${wLbl} · bar+gust`, h: mob ? 84 : 122 },
    { k: "arrow", l: "", n: "", h: mob ? 22 : 32 },
    { k: "sea", l: "Sea State", n: `wave ${u.heightUnit} · 0–${tickFmt(cvH(1))}`, h: 70 * base },
    { k: "air", l: "Air Temp", n: `°${u.tempUnit} · ${Math.round(cvT(5))}–${Math.round(cvT(25))} fixed`, h: mob ? 42 : 56 },
  ] as { k: string; l: string; n: string; h: number; y0?: number; y1?: number }[];
  // Mobile row labels live in the inter-row gaps, so the gaps must clear a
  // 12px label — including after the arrow row, which precedes "Sea State".
  // Desktop `top` also reserves headroom for the hover pill, which floats above
  // the score row — at the old 21 the pill's rounded top clipped off the viewBox.
  const gap = mob ? 17 : 15, top = mob ? 18 : 28;
  const Y: Record<string, { y0: number; y1: number }> = {};
  let cy = top;
  rows.forEach((r) => { r.y0 = cy; r.y1 = cy + r.h; Y[r.k] = { y0: r.y0, y1: r.y1 }; cy += r.h + (r.k === "arrow" ? (mob ? gap : 4) : gap); });
  const axisY = cy + 2;
  // Weather-icon row beneath the hour axis (replaces the in-stack SKY row).
  const wxIconY = axisY + (mob ? 14 : 20) + (mob ? 12 : 15);
  const wxLabelY = wxIconY + (mob ? 12 : 15);
  const H = wxLabelY + (mob ? 4 : 6);
  const cTop = Y.score.y0, cBot = Y.air.y1;

  // twilight bands
  const TW: [number, number, number][] = [
    [0, sun.nauticalRise, 0.065], [sun.nauticalRise, sun.civilRise, 0.045], [sun.civilRise, sun.sunrise, 0.03],
    [sun.sunset, sun.civilSet, 0.03], [sun.civilSet, sun.nauticalSet, 0.045], [sun.nauticalSet, 24, 0.065],
  ];

  const xAt = (t: number) => x0 + t * hw;
  // Clamp an annotation's anchor so its text box stays inside the plot area —
  // near the edges, switch from centered to edge-anchored instead of letting
  // the label bleed past x0/x1.
  const annAt = (px: number) => {
    const margin = 46;
    if (px < x0 + margin) return { x: x0, anchor: "start" as const };
    if (px > x1 - margin) return { x: x1, anchor: "end" as const };
    return { x: px, anchor: "middle" as const };
  };
  const yIn = (v: number, y0: number, y1: number, mn: number, mx: number) => y1 - ((v - mn) / (mx - mn)) * (y1 - y0);
  const curve = (fn: (t: number) => number | null, y0: number, y1: number, mn: number, mx: number) => {
    const N = mob ? 96 : 192; let p = ""; let started = false;
    for (let j = 0; j <= N; j++) {
      const t = (j / N) * 24; const v = fn(t);
      if (v == null) { started = false; continue; }
      const yy = yIn(v, y0, y1, mn, mx);
      p += (started ? "L" : "M") + xAt(t).toFixed(1) + "," + yy.toFixed(1); started = true;
    }
    return p;
  };

  let s = `<svg id="${id}" viewBox="0 0 ${W} ${H}" width="100%" tabindex="0" role="slider" aria-label="24-hour conditions, arrow keys to scrub by hour" aria-valuemin="0" aria-valuemax="23" aria-valuenow="0" data-ty0="${Y.tide.y0}" data-ty1="${Y.tide.y1}" style="touch-action:none;cursor:crosshair">`;
  s += `<defs><linearGradient id="${id}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.brand}" stop-opacity=".13"/><stop offset="1" stop-color="${C.brand}" stop-opacity="0"/></linearGradient></defs>`;

  TW.forEach((t) => { if (t[1] <= t[0]) return; s += `<rect x="${xAt(t[0]).toFixed(1)}" y="${cTop}" width="${((t[1] - t[0]) * hw).toFixed(1)}" height="${cBot - cTop}" fill="#334155" opacity="${t[2]}"/>`; });
  if (best) s += `<rect x="${xAt(best[0]).toFixed(1)}" y="${cTop}" width="${((best[1] - best[0] + 1) * hw).toFixed(1)}" height="${cBot - cTop}" fill="${C.brand}" opacity=".045"/>`;
  for (let g = 0; g <= 24; g += mob ? 6 : 3) s += `<line x1="${xAt(g).toFixed(1)}" y1="${cTop}" x2="${xAt(g).toFixed(1)}" y2="${cBot}" stroke="${C.ruleSoft}" stroke-width="1"/>`;

  // SCORE — cells carry only their tier tint; the selected hour is outlined by
  // the movable cursor group (below), so no static range highlight here.
  { const r = Y.score; for (let i = 0; i < 24; i++) { const cx = xAt(i); const sc = num(hours.score[i]);
    s += `<rect x="${(cx + 0.8).toFixed(1)}" y="${r.y0}" width="${(hw - 1.6).toFixed(1)}" height="${r.y1 - r.y0}" rx="1.5" fill="${ratingBg(sc)}"/>`;
    if (wide && sc != null) s += `<text class="tm-cell" fill="${ratingInk(sc)}" x="${(cx + hw / 2).toFixed(1)}" y="${(r.y0 + (r.y1 - r.y0) / 2 + 4)}" text-anchor="middle">${sc}</text>`;
  } }

  // TIDE (scale adapts to the spot's range — see tideScale)
  { const r = Y.tide; const { mn, mx } = ts; const line = curve((t) => interp(hours.tide, t), r.y0, r.y1, mn, mx);
    if (line) { s += `<path d="${line} L${x1.toFixed(1)},${r.y1} L${x0.toFixed(1)},${r.y1} Z" fill="url(#${id}tg)"/><path d="${line}" fill="none" stroke="${C.brand}" stroke-width="1.5"/>`; }
    [mn, (mn + mx) / 2, mx].forEach((tk) => { s += `<text class="tm-tick" x="${x0 - 5}" y="${yIn(tk, r.y0, r.y1, mn, mx) + 3}" text-anchor="end">${tickFmt(cvH(tk))}</text>`; });
    extremes(hours.tide).slice(0, 4).forEach((e) => { const px = xAt(e.i), py = yIn(e.v, r.y0, r.y1, mn, mx);
      s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="${C.brand}"/>`;
      // Annotation flips to the other side of the dot when the extreme sits
      // close enough to the row edge that the text would bleed out of the row.
      const above = e.hi ? py - r.y0 >= 14 : r.y1 - py < 16;
      if (wide) { const a = annAt(px); s += `<text class="tm-ann" x="${a.x.toFixed(1)}" y="${py + (above ? -6 : 14)}" text-anchor="${a.anchor}">${e.hi ? "H" : "L"} ${cvH(e.v).toFixed(1)}${u.heightUnit} ${hh(e.i)}</text>`; } }); }

  // CURRENT ±scale (adaptive to the day's real peak; ±2 for the fallback)
  { const r = Y.cur; const sc = cur.scale, thr = cur.thr; const zy = yIn(0, r.y0, r.y1, -sc, sc);
    for (let i = 0; i < 24; i++) { const v = num(current[i]); if (v == null || Math.abs(v) >= thr) continue;
      let a = i, b = i; while (a > 0 && Math.abs(num(current[a - 1]) ?? 9) < thr) a--; while (b < 23 && Math.abs(num(current[b + 1]) ?? 9) < thr) b++;
      s += `<rect x="${xAt(a).toFixed(1)}" y="${r.y0}" width="${((b - a + 1) * hw).toFixed(1)}" height="${r.y1 - r.y0}" fill="${C.slack}" opacity=".065"/>`;
      const mid = (a + b) / 2, px = xAt(mid + 0.5);
      s += `<path d="M${px.toFixed(1)},${zy - 4} L${(px + 4).toFixed(1)},${zy} L${px.toFixed(1)},${zy + 4} L${(px - 4).toFixed(1)},${zy} Z" fill="${C.slack}"/>`;
      if (wide) { const a = annAt(px); s += `<text class="tm-ann tm-slack" x="${a.x.toFixed(1)}" y="${r.y1 - 4}" text-anchor="${a.anchor}">SLACK ${hh(mid + 0.5)}</text>`; }
      i = b;
    }
    s += `<line x1="${x0}" y1="${zy.toFixed(1)}" x2="${x1}" y2="${zy.toFixed(1)}" stroke="${C.faint}" stroke-width="1"/>`;
    const line = curve((t) => interp(current, t), r.y0, r.y1, -sc, sc); if (line) s += `<path d="${line}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
    [sc, 0, -sc].forEach((tk) => { s += `<text class="tm-tick" x="${x0 - 5}" y="${yIn(tk, r.y0, r.y1, -sc, sc) + 3}" text-anchor="end">${tk > 0 ? "+" : ""}${tickFmt(cvW(tk))}</text>`; });
    if (wide) extremes(current).filter((e) => Math.abs(e.v) > 0.4 * sc).slice(0, 3).forEach((e) => {
      const a = annAt(xAt(e.i + 0.5));
      s += `<text class="tm-ann" x="${a.x.toFixed(1)}" y="${yIn(e.v, r.y0, r.y1, -sc, sc) + (e.hi ? -8 : 14)}" text-anchor="${a.anchor}">${e.hi ? "FLOOD" : "EBB"} ${Math.abs(cvW(e.v)).toFixed(1)}</text>`; }); }

  // WIND 0-24 + arrows
  { const r = Y.wind, vmax = 24;
    [10, 20].forEach((tk) => { const yy = yIn(tk, r.y0, r.y1, 0, vmax); s += `<line x1="${x0}" y1="${yy.toFixed(1)}" x2="${x1}" y2="${yy.toFixed(1)}" stroke="${C.ruleSoft}" stroke-width="1" stroke-dasharray="3 3"/><text class="tm-tick" x="${x0 - 5}" y="${yy + 3}" text-anchor="end">${Math.round(cvW(tk))}</text>`; });
    const scy = yIn(15, r.y0, r.y1, 0, vmax); s += `<line x1="${x0}" y1="${scy.toFixed(1)}" x2="${x1}" y2="${scy.toFixed(1)}" stroke="${C.r[4]}" stroke-width="1" stroke-dasharray="4 3" opacity=".8"/>`;
    if (wide) s += `<text class="tm-note" x="${x0 + 3}" y="${scy - 4}" style="fill:${C.r[4]}">${Math.round(cvW(15))} ${wLbl.toUpperCase()} SMALL CRAFT</text>`;
    for (let i = 0; i < 24; i++) { const cx = xAt(i), bw = hw * 0.56, v = num(hours.wind[i]); if (v == null) continue; const by = yIn(v, r.y0, r.y1, 0, vmax);
      s += `<rect x="${(cx + hw / 2 - bw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${(r.y1 - by).toFixed(1)}" rx="1.5" fill="${C.wind}"/>`;
      const gv = num(hours.gust[i]); if (gv != null) { const gy = yIn(gv, r.y0, r.y1, 0, vmax); s += `<line x1="${(cx + hw / 2 - bw / 2 - 1).toFixed(1)}" y1="${gy.toFixed(1)}" x2="${(cx + hw / 2 + bw / 2 + 1).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${C.soft}" stroke-width="1.4"/>`; } }
    const ar = Y.arrow, ay = (ar.y0 + ar.y1) / 2, step = mob ? 2 : 1;
    for (let k = 0; k < 24; k += step) { const dv = num(hours.windDir[k]); if (dv == null) continue; const ax = xAt(k) + hw / 2, dir = (dv + 180) % 360;
      s += `<g transform="translate(${ax.toFixed(1)},${ay.toFixed(1)}) rotate(${dir})"><path d="M0,-6 L0,6 M0,6 L-3,2 M0,6 L3,2" stroke="${C.soft}" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`;
      if (wide && k % 3 === 0) s += `<text class="tm-tick" x="${ax.toFixed(1)}" y="${ar.y1 + 2}" text-anchor="middle">${windName(dv)}</text>`; } }

  // SEA 0-1
  { const r = Y.sea; s += `<line x1="${x0}" y1="${yIn(0.5, r.y0, r.y1, 0, 1).toFixed(1)}" x2="${x1}" y2="${yIn(0.5, r.y0, r.y1, 0, 1).toFixed(1)}" stroke="${C.ruleSoft}" stroke-width="1" stroke-dasharray="3 3"/>`;
    s += `<text class="tm-tick" x="${x0 - 5}" y="${r.y0 + 7}" text-anchor="end">${tickFmt(cvH(1))}</text><text class="tm-tick" x="${x0 - 5}" y="${r.y1}" text-anchor="end">0</text>`;
    for (let i = 0; i < 24; i++) { const v = num(hours.sea[i]); if (v == null) continue; const cx = xAt(i), bw = hw * 0.56, col = v < 0.35 ? C.faint : v < 0.65 ? C.r[2] : C.r[3], by = yIn(v, r.y0, r.y1, 0, 1);
      s += `<rect x="${(cx + hw / 2 - bw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.5, r.y1 - by).toFixed(1)}" rx="1" fill="${col}"/>`; } }

  // (Sky is no longer an in-stack row — cloud + precip now render as the
  // weather-icon row beneath the hour axis; see below.)

  // AIR 5-25
  { const r = Y.air; const line = curve((t) => interp(hours.air, t), r.y0, r.y1, 5, 25); if (line) s += `<path d="${line}" fill="none" stroke="${C.r[3]}" stroke-width="1.6"/>`;
    [25, 15, 5].forEach((tk) => { s += `<text class="tm-tick" x="${x0 - 5}" y="${yIn(tk, r.y0, r.y1, 5, 25) + 3}" text-anchor="end">${Math.round(cvT(tk))}</text>`; });
    if (wide) { const ex = extremes(hours.air); const hiE = ex.filter((e) => e.hi)[0], loE = ex.filter((e) => !e.hi)[0];
      [loE, hiE].forEach((e) => { if (!e) return; const px = xAt(e.i), py = yIn(e.v, r.y0, r.y1, 5, 25), a = annAt(px); s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.2" fill="${C.r[3]}"/><text class="tm-ann tm-sub" x="${a.x.toFixed(1)}" y="${py + (e.hi ? -7 : 14)}" text-anchor="${a.anchor}">${e.hi ? "H" : "L"} ${cvT(e.v).toFixed(1)}° ${hh(e.i)}</text>`; }); } }

  // labels
  rows.forEach((r) => { if (r.k === "arrow") return;
    if (mob) s += `<text class="tm-lbl" x="${x0}" y="${(r.y0 ?? 0) - 5}">${r.l.toUpperCase()}</text>`;
    else { s += `<text class="tm-lbl" x="12" y="${(r.y0 ?? 0) + 14}">${r.l.toUpperCase()}</text>`; if (r.n) s += `<text class="tm-note" x="12" y="${(r.y0 ?? 0) + 30}">${r.n}</text>`; } });

  // hour axis + sun context. Desktop: sunrise/sunset carry a glyph + time, and
  // first light / last light (nautical twilight) get a faint tick at the top of
  // the plot — the daylight envelope Surfline shows. The plain hour label under
  // any sun marker is dropped so they don't collide.
  const sunTimes = mob ? [sun.sunrise, sun.sunset] : [sun.nauticalRise, sun.sunrise, sun.sunset, sun.nauticalSet];
  for (let a = 0; a <= 24; a += mob ? 6 : 3) {
    if (sunTimes.some((t) => Math.abs(t - a) < 0.8)) continue;
    s += `<text class="tm-ax" x="${xAt(a).toFixed(1)}" y="${axisY + 12}" text-anchor="middle">${String(a).padStart(2, "0")}</text>`;
  }
  if (mob) {
    [sun.sunrise, sun.sunset].forEach((t) => { s += `<text x="${xAt(t).toFixed(1)}" y="${axisY + 12}" text-anchor="middle" style="font-size:8px;fill:${C.r[2]}">☀</text>`; });
  } else {
    // first / last light — faint short ticks just under the axis
    [sun.nauticalRise, sun.nauticalSet].forEach((t) => {
      s += `<text class="tm-ax" x="${xAt(t).toFixed(1)}" y="${axisY + 12}" text-anchor="middle" style="fill:${C.faint}">${hh(t)}</text>`;
    });
    // sunrise / sunset — glyph + time
    [sun.sunrise, sun.sunset].forEach((t) => {
      s += `<text x="${xAt(t).toFixed(1)}" y="${axisY + 12}" text-anchor="middle" style="font-size:11px;fill:${C.r[2]};font-family:var(--rc-font-mono)">☀${hh(t)}</text>`;
    });
  }

  // Weather-icon row — 6 fixed 4-hour segments (00/04/08/12/16/20), one icon
  // per segment's dominant condition, beneath the hour axis. Replaces the cloud
  // strip + precip bars; precip is the only emphasized condition.
  {
    const wxSize = mob ? 14 : 18;
    for (const seg of [0, 4, 8, 12, 16, 20]) {
      const tally: Partial<Record<WeatherCondition, number>> = {};
      for (let h = seg; h < seg + 4; h++) {
        const c = weatherFromHour(num(hours.cloud[h]), num(hours.precip[h]));
        if (c) tally[c] = (tally[c] ?? 0) + 1;
      }
      const cond = (Object.entries(tally) as [WeatherCondition, number][]).sort(
        (a, b) => b[1] - a[1],
      )[0]?.[0];
      const cx = xAt(seg + 2);
      if (cond) s += weatherIconMarkup(cond, { x: cx, y: wxIconY, size: wxSize });
      s += `<text class="tm-ax" x="${cx.toFixed(1)}" y="${wxLabelY}" text-anchor="middle">${String(seg).padStart(2, "0")}</text>`;
    }
  }

  // right-gutter readouts (desktop)
  if (!mob) { const rx = x1 + 14;
    ([["score", Y.score], ["tide", Y.tide], ["cur", Y.cur], ["wind", Y.wind], ["sea", Y.sea], ["air", Y.air]] as const).forEach(([k, r]) => {
      const midy = (r.y0 + r.y1) / 2;
      s += `<text class="tm-rv" id="${id}-${k}-v" x="${rx}" y="${midy}">—</text><text class="tm-rs" id="${id}-${k}-s" x="${rx}" y="${midy + 13}">—</text>`; });
  }

  // Score-cell outline — highlights the whole hour cell under the cursor.
  // Positioned absolutely (not inside the translated cursor group) so it stays
  // grid-aligned; the cursor line below is what moves.
  const selW = (hw - 1.6).toFixed(1);
  s += `<rect id="${id}-cell" x="${(x0 + 0.8).toFixed(1)}" y="${(Y.score.y0 - 1).toFixed(1)}" width="${selW}" height="${(Y.score.y1 - Y.score.y0 + 2).toFixed(1)}" rx="2" fill="none" stroke="${C.brand}" stroke-width="2"/>`;
  // Cursor group — translated to the centre of the hour cell under the pointer:
  // a vertical line, a dot riding the tide curve, and a hover pill reading the
  // hour + score there. The pill's width is re-fitted to its text in paint().
  s += `<g id="${id}-cur"><line x1="0" y1="${(Y.score.y1 + 1).toFixed(1)}" x2="0" y2="${mob ? cBot : axisY + 2}" stroke="${C.brand}" stroke-width="1.5"/>`;
  s += `<circle id="${id}-tdot" cx="0" cy="${Y.tide.y0.toFixed(1)}" r="3.2" fill="${C.brand}" stroke="#fff" stroke-width="1.5" display="none"/>`;
  if (!mob) s += `<g id="${id}-tagg"><rect id="${id}-tagr" x="-52" y="${(cTop - TAG_H - TAG_GAP).toFixed(1)}" width="104" height="${TAG_H}" rx="3" fill="${C.brand}"/><text class="tm-ctag" id="${id}-tagt" x="0" y="${(cTop - TAG_GAP - TAG_H / 2 + 4.3).toFixed(1)}" text-anchor="middle">—</text></g>`;
  s += `</g>`;
  s += "</svg>";
  return s;
}

export default function SpotTerminal({
  hours, realCurrent, tideRange, sun, nowHour, selectedHour, onSelectHour, bestWindow, speciesName,
}: {
  hours: TerminalHours;
  /** Signed real current (kn, +flood −ebb) for the day; null → tide-derived fallback. */
  realCurrent?: (number | null)[] | null;
  /** Multi-day tide min/max (m) so the row scale holds steady across day flips. */
  tideRange?: { min: number; max: number } | null;
  sun: SunHours;
  nowHour: number;
  selectedHour: number;
  onSelectHour: (h: number) => void;
  bestWindow: [number, number] | null;
  speciesName: string | null;
}) {
  const deskRef = useRef<HTMLDivElement>(null);
  const mobRef = useRef<HTMLDivElement>(null);
  const { windUnit, tempUnit, precipUnit, heightUnit } = useUnitPreferences();
  const units: TerminalUnits = { windUnit, tempUnit, precipUnit, heightUnit };
  // Drag state lives in refs (not wire()-locals) so an SVG rebuild mid-gesture
  // — e.g. a data refresh landing during a touch drag — doesn't drop the scrub.
  const downRef = useRef(false);
  const lastHRef = useRef<number | null>(null);
  const cur = currentRow(realCurrent, hours.tide);
  const current = cur.v;
  const ts = tideScale(hours.tide, tideRange);

  // Render both terminals 1:1 (viewBox width = pixel width) so font sizes are
  // true CSS px and match the app's type scale — not scaled fractions. The
  // mobile variant spans phone through tablet widths, so it's measured too.
  const [deskW, setDeskW] = useState(1120);
  const [mobW, setMobW] = useState(414);
  useEffect(() => {
    const watch = (el: HTMLDivElement | null, min: number, set: (w: number) => void) => {
      if (!el) return null;
      const measure = () => {
        const w = el.clientWidth;
        if (w > min) set(w);
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return ro;
    };
    const a = watch(deskRef.current, 400, setDeskW);
    const b = watch(mobRef.current, 300, setMobW);
    return () => { a?.disconnect(); b?.disconnect(); };
  }, []);

  const readAt = (h: number) => {
    const hi = Math.max(0, Math.min(23, Math.round(h)));
    const t = interp(hours.tide, h) ?? 0, tR = (interp(hours.tide, h + 0.15) ?? t) >= t;
    const cv = num(current[hi]) ?? 0, cs = Math.abs(cv) < cur.thr ? "Slack" : cv > 0 ? "Flood" : "Ebb";
    const sc = num(hours.score[hi]);
    // vs-previous-hour delta — answers "what changed" without a second lookup.
    const prevSc = hi > 0 ? num(hours.score[hi - 1]) : null;
    const scoreDelta = sc != null && prevSc != null ? sc - prevSc : null;
    const scoreDeltaTxt =
      scoreDelta == null ? "" : scoreDelta === 0 ? " · flat" : scoreDelta > 0 ? ` ▲${scoreDelta}` : ` ▼${Math.abs(scoreDelta)}`;
    // Words (Slack/Flood, sea state, Cold/Mild) key off source units; only the
    // displayed numbers + unit tokens convert.
    const cvW = (v: number) => convertWind(v, "knots", windUnit);
    const wLbl = WIND_LABELS[windUnit];
    return {
      hour: hh(hi), score: sc == null ? "—" : String(sc), verd: verdict(sc), col: ratingCol(sc), scoreDeltaTxt,
      tide: convertHeight(num(hours.tide[hi]) ?? 0, "m", heightUnit).toFixed(1) + heightUnit, tideS: tR ? "Rising ▲" : "Falling ▼",
      curSigned: (cv >= 0 ? "+" : "") + cvW(cv).toFixed(1) + wLbl, curS: cs,
      wind: cvW(num(hours.wind[hi]) ?? 0).toFixed(0) + wLbl, windS: windName(hours.windDir[hi]) + " G" + cvW(num(hours.gust[hi]) ?? 0).toFixed(0),
      sea: convertHeight(num(hours.sea[hi]) ?? 0, "m", heightUnit).toFixed(1) + heightUnit, seaS: seaWord(num(hours.sea[hi])),
      air: convertTemp(num(hours.air[hi]) ?? 0, "C", tempUnit).toFixed(1) + "°", airS: airWord(num(hours.air[hi])),
    };
  };

  // Scrub only over scored hours: leading/trailing hours with no fishing score
  // (e.g. today's 00:00, which has tide but no weather forecast yet) render as
  // empty cells and must not hold the cursor — clamp the selectable range to
  // the first…last scored hour so the readout never lands on an empty cell.
  const loH = Math.max(0, hours.score.findIndex((v) => num(v) != null));
  let hiH = 23; while (hiH > loH && num(hours.score[hiH]) == null) hiH--;
  const clampH = (h: number) => Math.max(loH, Math.min(hiH, h));
  // Fractional time (curve space 0–24) clamped to the scored cells.
  const clampTf = (t: number) => Math.max(loH, Math.min(hiH + 1 - 1e-3, t));

  // Single painter for the pointer, keyboard and prop paths: positions the cell
  // outline, the cursor line, the tide-riding dot, the hover pill, the gutter
  // readouts and the aria state. `tf` is always an hour centre (idx + 0.5).
  const paint = (host: HTMLDivElement | null, id: string, mob: boolean, tf: number) => {
    const svg = host?.querySelector("svg") as SVGSVGElement | null; if (!svg) return;
    const { LABEL: x0, READ } = gutters(mob);
    const vw = svg.viewBox.baseVal.width, hw = (vw - x0 - READ) / 24, x1 = vw - READ;
    const cursorX = x0 + tf * hw;
    const idx = Math.max(0, Math.min(23, Math.floor(tf)));
    const cell = svg.querySelector(`#${id}-cell`); if (cell) cell.setAttribute("x", (x0 + idx * hw + 0.8).toFixed(1));
    const g = svg.querySelector(`#${id}-cur`); if (g) g.setAttribute("transform", `translate(${cursorX.toFixed(1)},0)`);
    const tdot = svg.querySelector(`#${id}-tdot`);
    const ty0 = Number(svg.dataset.ty0), ty1 = Number(svg.dataset.ty1);
    if (tdot && Number.isFinite(ty0)) {
      const tv = interp(hours.tide, tf);
      if (tv == null) tdot.setAttribute("display", "none");
      else { const yy = ty1 - ((tv - ts.mn) / (ts.mx - ts.mn)) * (ty1 - ty0); tdot.setAttribute("cy", yy.toFixed(1)); tdot.setAttribute("display", ""); }
    }
    const d = readAt(idx);
    if (!mob && g) {
      const tagg = g.querySelector(`#${id}-tagg`);
      if (tagg) {
        // Label the whole hour, not the sub-hour position the pointer happens
        // to sit at — the cursor snaps to hour centres, so "11:30" was a lie.
        const t = svg.querySelector(`#${id}-tagt`) as SVGTextContentElement | null;
        const label = `${hh(idx)} · ${d.score === "—" ? "—" : d.score + " " + d.verd}`;
        let half = TAG_MIN_W / 2;
        if (t) {
          t.textContent = label;
          // Measure the rendered glyphs (mono, but "1" vs "Good" still differ in
          // count) and re-fit the pill so the fill always clears the text.
          const tw = t.getComputedTextLength?.() || label.length * 7.3;
          const w = Math.max(TAG_MIN_W, Math.round(tw + TAG_PAD * 2));
          half = w / 2;
          const rect = svg.querySelector(`#${id}-tagr`);
          if (rect) { rect.setAttribute("width", String(w)); rect.setAttribute("x", (-half).toFixed(1)); }
        }
        const shift = Math.max(x0 + half, Math.min(x1 - half, cursorX)) - cursorX;
        tagg.setAttribute("transform", `translate(${shift.toFixed(1)},0)`);
      }
      const set = (k: string, v: string, fill?: string) => { const e = svg.querySelector(`#${id}-${k}-v`); if (e) { e.textContent = v; if (fill) e.setAttribute("fill", fill); } };
      const sub = (k: string, v: string) => { const e = svg.querySelector(`#${id}-${k}-s`); if (e) e.textContent = v; };
      set("score", d.score, d.col); sub("score", `${d.verd}${d.scoreDeltaTxt}`);
      set("tide", d.tide); sub("tide", d.tideS);
      set("cur", d.curSigned); sub("cur", d.curS);
      set("wind", d.wind); sub("wind", d.windS);
      set("sea", d.sea); sub("sea", d.seaS);
      set("air", d.air); sub("air", d.airS);
    }
    svg.setAttribute("aria-valuenow", String(idx));
    svg.setAttribute("aria-valuetext", `${hh(idx)}, score ${d.score} ${d.verd}, tide ${d.tide}, wind ${d.wind}, sea ${d.seaS}, air ${d.air}`);
  };

  // Build both SVGs when data changes.
  useEffect(() => {
    if (deskRef.current && deskW > 400) deskRef.current.innerHTML = buildSvg(hours, cur, ts, sun, bestWindow, { w: deskW, ...gutters(false), mobile: false, id: "tmd" }, units);
    if (mobRef.current) mobRef.current.innerHTML = buildSvg(hours, cur, ts, sun, bestWindow, { w: mobW, ...gutters(true), mobile: true, id: "tmm" }, units);
    const wire = (host: HTMLDivElement | null, id: string, mob: boolean) => {
      const svg = host?.querySelector("svg") as SVGSVGElement | null; if (!svg) return;
      // Fractional curve-time under the pointer (0–24), clamped to scored cells.
      const tfFromEvt = (e: PointerEvent) => {
        const r = svg.getBoundingClientRect(); const scale = svg.viewBox.baseVal.width / r.width;
        const vx = (e.clientX - r.left) * scale; const { LABEL: x0, READ } = gutters(mob), hw = (svg.viewBox.baseVal.width - x0 - READ) / 24;
        return clampTf((vx - x0) / hw);
      };
      // Light haptic tick while touch-scrubbing; no-op where the vibration
      // API is missing (iOS Safari).
      const haptic = () => { try { navigator.vibrate?.(8); } catch {} };
      const move = (e: PointerEvent) => {
        const tf = tfFromEvt(e);
        // A zero-width svg (hidden across a breakpoint, mid-resize) yields a
        // non-finite time — bail rather than propagate NaN into selectedHour,
        // which would crash the day/hour → ISO conversion downstream.
        if (!Number.isFinite(tf)) return;
        const idx = clampH(Math.floor(tf));
        if (lastHRef.current != null && idx !== lastHRef.current && e.pointerType !== "mouse") haptic();
        lastHRef.current = idx;
        // Magnetic to the hour: the cursor parks at the centre of whichever hour
        // cell the pointer is over rather than tracking the exact pixel, so the
        // line, the outlined score cell and the readouts always agree.
        paint(host, id, mob, idx + 0.5);
        onSelectHour(idx);
      };
      svg.addEventListener("pointerdown", (e) => {
        downRef.current = true;
        // Capture the pointer so a finger slide keeps scrubbing even when it
        // drifts off the short chart — otherwise pointerleave cuts the drag
        // and mobile degrades to hour-by-hour taps.
        try { svg.setPointerCapture(e.pointerId); } catch {}
        if (e.pointerType !== "mouse") haptic();
        lastHRef.current = null;
        move(e);
      });
      svg.addEventListener("pointermove", (e) => { if (downRef.current || e.pointerType === "mouse") move(e); });
      // Keep the scrubbed hour after release (touch can park); only mouse-hover snaps back to now.
      svg.addEventListener("pointerup", () => { downRef.current = false; });
      svg.addEventListener("pointercancel", () => { downRef.current = false; });
      svg.addEventListener("pointerleave", (e) => {
        // Touch fires leave when a captured drag's element is rebuilt or the
        // finger drifts — never mid-gesture reset; up/cancel end the drag.
        if (e.pointerType === "mouse") {
          downRef.current = false;
          const nh = clampH(nowHour);
          paint(host, id, mob, nh + 0.5);
          onSelectHour(nh);
        }
      });
      // Keyboard: arrow keys move the hour; Home/End jump to the ends.
      svg.addEventListener("keydown", (e) => {
        const cur = parseInt(svg.getAttribute("aria-valuenow") || "0", 10);
        let next: number | null = null;
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - 1;
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + 1;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = 23;
        if (next != null) {
          onSelectHour(clampH(next));
          e.preventDefault();
        }
      });
    };
    wire(deskRef.current, "tmd", false);
    wire(mobRef.current, "tmm", true);
    // Depend on the window's endpoints, not the array identity — a parent
    // passing a fresh [start, end] each render must not rebuild the SVG (and
    // tear down an in-flight scrub gesture).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, realCurrent, tideRange, sun, bestWindow?.[0], bestWindow?.[1], deskW, mobW, windUnit, tempUnit, precipUnit, heightUnit]);

  // Move cursor + refresh readouts when the selected hour changes (pointer,
  // keyboard, parent, or a data refresh) — always the selected hour's centre.
  useEffect(() => {
    paint(deskRef.current, "tmd", false, selectedHour + 0.5);
    paint(mobRef.current, "tmm", true, selectedHour + 0.5);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHour, hours, realCurrent, deskW, mobW, windUnit, tempUnit, heightUnit]);

  const d = readAt(selectedHour);
  const isNow = selectedHour === nowHour;
  const cell = (k: string, v: string, sub: string, color?: string, subColor?: string) => (
    <div className="min-w-0">
      <div className="text-[8px] tracking-[0.1em] uppercase text-rc-ink-mute">{k}</div>
      <div className="text-[15px] font-bold font-rc-mono leading-tight tabular-nums" style={color ? { color } : undefined}>{v}</div>
      <div className="text-[8.5px] tracking-[0.05em] uppercase text-rc-ink-mute" style={subColor ? { color: subColor } : undefined}>{sub}</div>
    </div>
  );

  return (
    <div className="tm-scope">
      <style>{`
        .tm-scope .tm-lbl{font-family:var(--rc-font-mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:700;fill:#0F172A}
        .tm-scope .tm-note{font-family:var(--rc-font-mono);font-size:10px;letter-spacing:.04em;fill:#64748B}
        .tm-scope .tm-tick{font-family:var(--rc-font-mono);font-size:10px;fill:#94A3B8}
        .tm-scope .tm-cell{font-family:var(--rc-font-sans);font-size:11px;font-weight:700}
        .tm-scope .tm-ann{font-family:var(--rc-font-mono);font-size:11px;font-weight:700;fill:#334155}
        .tm-scope .tm-ann.tm-sub{fill:#64748B;font-weight:600}
        .tm-scope .tm-ann.tm-slack{fill:#059669;font-weight:600}
        .tm-scope .tm-ax{font-family:var(--rc-font-mono);font-size:11px;fill:#64748B}
        .tm-scope .tm-rv{font-family:var(--rc-font-mono);font-size:16px;font-weight:700;fill:#0F172A}
        .tm-scope .tm-rs{font-family:var(--rc-font-mono);font-size:10px;letter-spacing:.06em;text-transform:uppercase;fill:#64748B}
        .tm-scope .tm-ctag{font-family:var(--rc-font-mono);font-size:12px;font-weight:700;fill:#fff}
        .tm-scope #tmd-score-v,.tm-scope #tmm-score-v{font-family:var(--rc-font-sans)}
        .tm-scope svg:focus{outline:none}
        .tm-scope svg:focus-visible{outline:2px solid #1E40E0;outline-offset:2px;border-radius:3px}
      `}</style>

      {/* Screen-reader live readout of the scrubbed hour. */}
      <div aria-live="polite" className="sr-only">
        {`Hour ${d.hour}. Score ${d.score} ${d.verd}. Tide ${d.tide} ${d.tideS}. Current ${d.curSigned} ${d.curS}. Wind ${d.wind} ${d.windS}. Sea ${d.sea} ${d.seaS}. Air ${d.air}.`}
      </div>

      {/* Mobile readout bar */}
      <div className="lg:hidden grid grid-cols-4 gap-x-3 gap-y-2 px-1 pb-3">
        {cell(
          "Time",
          d.hour,
          isNow ? "Now" : selectedHour > nowHour ? `in ${selectedHour - nowHour}h` : `${nowHour - selectedHour}h ago`,
          "#1E40E0",
        )}
        {cell("Score", d.score, `${d.verd}${d.scoreDeltaTxt}`, d.col)}
        {cell("Tide", d.tide, d.tideS)}
        {cell("Current", d.curSigned, d.curS, undefined, d.curS === "Slack" ? "#059669" : undefined)}
        {cell("Wind", d.wind, d.windS)}
        {cell("Sea", d.sea, d.seaS)}
        {cell("Air", d.air, d.airS, undefined)}
        {cell("Species", speciesName ?? "—", "Driver")}
      </div>

      <div ref={deskRef} className="hidden lg:block" />
      <div ref={mobRef} className="lg:hidden" />
    </div>
  );
}
