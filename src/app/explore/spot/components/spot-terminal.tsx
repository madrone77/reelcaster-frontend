"use client";

import { useEffect, useRef, useState } from "react";
import type { SunHours } from "@/lib/bluecaster/live-spot-types";
import { niceCurrentScale } from "../../lib/current-series";

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
 * Monotone cubic (Fritsch–Carlson) interpolation between adjacent hourly
 * samples. Unlike per-segment cosine easing — whose slope is forced to zero at
 * every sample, scalloping a steadily rising/falling tide — the tangents come
 * from neighbouring secants, so the curve is smooth through each hour and only
 * flattens at true highs/lows. The limiter keeps it from overshooting the
 * sampled values, so the curve never exceeds an annotated H/L.
 */
function interp(arr: (number | null)[], t: number): number | null {
  const n = arr.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(t)));
  const j = Math.min(n - 1, i + 1);
  const a = num(arr[i]), b = num(arr[j]);
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  const d = b - a;
  // One-sided secants stand in at array ends and null gaps.
  const prev = i > 0 ? num(arr[i - 1]) : null;
  const next = j < n - 1 ? num(arr[j + 1]) : null;
  const d0 = prev == null ? d : a - prev;
  const d2 = next == null ? d : next - b;
  let m0 = d0 * d <= 0 ? 0 : (d0 + d) / 2;
  let m1 = d * d2 <= 0 ? 0 : (d + d2) / 2;
  if (d === 0) {
    m0 = 0; m1 = 0;
  } else {
    m0 = Math.sign(d) * Math.min(Math.abs(m0), 3 * Math.abs(d));
    m1 = Math.sign(d) * Math.min(Math.abs(m1), 3 * Math.abs(d));
  }
  const f = t - i, f2 = f * f, f3 = f2 * f;
  return (
    (2 * f3 - 3 * f2 + 1) * a + (f3 - 2 * f2 + f) * m0 +
    (-2 * f3 + 3 * f2) * b + (f3 - f2) * m1
  );
}

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

/** Local extremes (peaks/troughs) with hour + value. */
function extremes(arr: (number | null)[]): { i: number; v: number; hi: boolean }[] {
  const out: { i: number; v: number; hi: boolean }[] = [];
  for (let i = 1; i < arr.length - 1; i++) {
    const p = num(arr[i - 1]), c = num(arr[i]), nx = num(arr[i + 1]);
    if (p == null || c == null || nx == null) continue;
    if (c > p && c >= nx) out.push({ i, v: c, hi: true });
    else if (c < p && c <= nx) out.push({ i, v: c, hi: false });
  }
  return out;
}

type Dims = { w: number; LABEL: number; READ: number; mobile: boolean; id: string };

function buildSvg(
  hours: TerminalHours,
  cur: CurrentRow,
  sun: SunHours,
  best: [number, number] | null,
  d: Dims,
): string {
  const current = cur.v;
  const { LABEL, READ, w: W, mobile: mob, id } = d;
  const x0 = LABEL, x1 = W - READ, cw = x1 - x0, hw = cw / 24;
  const base = mob ? 0.62 : 1;
  const rows = [
    { k: "score", l: "Score", n: "colour = rating", h: mob ? 20 : 34 },
    { k: "tide", l: "Tide", n: "m · 0–3 fixed", h: 116 * base },
    { k: "cur", l: "Current", n: "kn · +flood −ebb", h: 128 * base },
    { k: "wind", l: "Wind", n: "kn · bar+gust", h: mob ? 84 : 122 },
    { k: "arrow", l: "", n: "", h: mob ? 22 : 32 },
    { k: "sea", l: "Sea State", n: "wave m · 0–1", h: 70 * base },
    { k: "sky", l: "Sky", n: "cloud + mm · 0–4", h: mob ? 42 : 58 },
    { k: "air", l: "Air Temp", n: "°C · 5–25 fixed", h: mob ? 42 : 56 },
  ] as { k: string; l: string; n: string; h: number; y0?: number; y1?: number }[];
  const gap = mob ? 10 : 15, top = 21;
  const Y: Record<string, { y0: number; y1: number }> = {};
  let cy = top;
  rows.forEach((r) => { r.y0 = cy; r.y1 = cy + r.h; Y[r.k] = { y0: r.y0, y1: r.y1 }; cy += r.h + (r.k === "arrow" ? 4 : gap); });
  const axisY = cy + 2, H = axisY + (mob ? 16 : 22);
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

  let s = `<svg id="${id}" viewBox="0 0 ${W} ${H}" width="100%" tabindex="0" role="slider" aria-label="24-hour conditions — arrow keys to scrub by hour" aria-valuemin="0" aria-valuemax="23" aria-valuenow="0" style="touch-action:none;cursor:crosshair">`;
  s += `<defs><linearGradient id="${id}tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.brand}" stop-opacity=".13"/><stop offset="1" stop-color="${C.brand}" stop-opacity="0"/></linearGradient></defs>`;

  TW.forEach((t) => { if (t[1] <= t[0]) return; s += `<rect x="${xAt(t[0]).toFixed(1)}" y="${cTop}" width="${((t[1] - t[0]) * hw).toFixed(1)}" height="${cBot - cTop}" fill="#334155" opacity="${t[2]}"/>`; });
  if (best) s += `<rect x="${xAt(best[0]).toFixed(1)}" y="${cTop}" width="${((best[1] - best[0] + 1) * hw).toFixed(1)}" height="${cBot - cTop}" fill="${C.brand}" opacity=".045"/>`;
  for (let g = 0; g <= 24; g += mob ? 6 : 3) s += `<line x1="${xAt(g).toFixed(1)}" y1="${cTop}" x2="${xAt(g).toFixed(1)}" y2="${cBot}" stroke="${C.ruleSoft}" stroke-width="1"/>`;

  // SCORE — cells carry only their tier tint; the selected hour is outlined by
  // the movable cursor group (below), so no static range highlight here.
  { const r = Y.score; for (let i = 0; i < 24; i++) { const cx = xAt(i); const sc = num(hours.score[i]);
    s += `<rect x="${(cx + 0.8).toFixed(1)}" y="${r.y0}" width="${(hw - 1.6).toFixed(1)}" height="${r.y1 - r.y0}" rx="1.5" fill="${ratingBg(sc)}"/>`;
    if (!mob && sc != null) s += `<text class="tm-cell" fill="${ratingInk(sc)}" x="${(cx + hw / 2).toFixed(1)}" y="${(r.y0 + (r.y1 - r.y0) / 2 + 4)}" text-anchor="middle">${sc}</text>`;
  } }

  // TIDE 0-3
  { const r = Y.tide; const line = curve((t) => interp(hours.tide, t), r.y0, r.y1, 0, 3);
    if (line) { s += `<path d="${line} L${x1.toFixed(1)},${r.y1} L${x0.toFixed(1)},${r.y1} Z" fill="url(#${id}tg)"/><path d="${line}" fill="none" stroke="${C.brand}" stroke-width="1.5"/>`; }
    [0, 1.5, 3].forEach((tk) => { s += `<text class="tm-tick" x="${x0 - 5}" y="${yIn(tk, r.y0, r.y1, 0, 3) + 3}" text-anchor="end">${tk}</text>`; });
    extremes(hours.tide).slice(0, 4).forEach((e) => { const px = xAt(e.i), py = yIn(e.v, r.y0, r.y1, 0, 3);
      s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="${C.brand}"/>`;
      if (!mob) { const a = annAt(px); s += `<text class="tm-ann" x="${a.x.toFixed(1)}" y="${py + (e.hi ? -6 : 14)}" text-anchor="${a.anchor}">${e.hi ? "H" : "L"} ${e.v.toFixed(1)}m ${hh(e.i)}</text>`; } }); }

  // CURRENT ±scale (adaptive to the day's real peak; ±2 for the fallback)
  { const r = Y.cur; const sc = cur.scale, thr = cur.thr; const zy = yIn(0, r.y0, r.y1, -sc, sc);
    for (let i = 0; i < 24; i++) { const v = num(current[i]); if (v == null || Math.abs(v) >= thr) continue;
      let a = i, b = i; while (a > 0 && Math.abs(num(current[a - 1]) ?? 9) < thr) a--; while (b < 23 && Math.abs(num(current[b + 1]) ?? 9) < thr) b++;
      s += `<rect x="${xAt(a).toFixed(1)}" y="${r.y0}" width="${((b - a + 1) * hw).toFixed(1)}" height="${r.y1 - r.y0}" fill="${C.slack}" opacity=".065"/>`;
      const mid = (a + b) / 2, px = xAt(mid + 0.5);
      s += `<path d="M${px.toFixed(1)},${zy - 4} L${(px + 4).toFixed(1)},${zy} L${px.toFixed(1)},${zy + 4} L${(px - 4).toFixed(1)},${zy} Z" fill="${C.slack}"/>`;
      if (!mob) { const a = annAt(px); s += `<text class="tm-ann tm-slack" x="${a.x.toFixed(1)}" y="${r.y1 - 4}" text-anchor="${a.anchor}">SLACK ${hh(mid + 0.5)}</text>`; }
      i = b;
    }
    s += `<line x1="${x0}" y1="${zy.toFixed(1)}" x2="${x1}" y2="${zy.toFixed(1)}" stroke="${C.faint}" stroke-width="1"/>`;
    const line = curve((t) => interp(current, t), r.y0, r.y1, -sc, sc); if (line) s += `<path d="${line}" fill="none" stroke="${C.ink}" stroke-width="1.5"/>`;
    [sc, 0, -sc].forEach((tk) => { s += `<text class="tm-tick" x="${x0 - 5}" y="${yIn(tk, r.y0, r.y1, -sc, sc) + 3}" text-anchor="end">${tk > 0 ? "+" : ""}${tk}</text>`; });
    if (!mob) extremes(current).filter((e) => Math.abs(e.v) > 0.4 * sc).slice(0, 3).forEach((e) => {
      const a = annAt(xAt(e.i + 0.5));
      s += `<text class="tm-ann" x="${a.x.toFixed(1)}" y="${yIn(e.v, r.y0, r.y1, -sc, sc) + (e.hi ? -8 : 14)}" text-anchor="${a.anchor}">${e.hi ? "FLOOD" : "EBB"} ${Math.abs(e.v).toFixed(1)}</text>`; }); }

  // WIND 0-24 + arrows
  { const r = Y.wind, vmax = 24;
    [10, 20].forEach((tk) => { const yy = yIn(tk, r.y0, r.y1, 0, vmax); s += `<line x1="${x0}" y1="${yy.toFixed(1)}" x2="${x1}" y2="${yy.toFixed(1)}" stroke="${C.ruleSoft}" stroke-width="1" stroke-dasharray="3 3"/><text class="tm-tick" x="${x0 - 5}" y="${yy + 3}" text-anchor="end">${tk}</text>`; });
    const scy = yIn(15, r.y0, r.y1, 0, vmax); s += `<line x1="${x0}" y1="${scy.toFixed(1)}" x2="${x1}" y2="${scy.toFixed(1)}" stroke="${C.r[4]}" stroke-width="1" stroke-dasharray="4 3" opacity=".8"/>`;
    if (!mob) s += `<text class="tm-note" x="${x0 + 3}" y="${scy - 4}" style="fill:${C.r[4]}">15 KN SMALL CRAFT</text>`;
    for (let i = 0; i < 24; i++) { const cx = xAt(i), bw = hw * 0.56, v = num(hours.wind[i]); if (v == null) continue; const by = yIn(v, r.y0, r.y1, 0, vmax);
      s += `<rect x="${(cx + hw / 2 - bw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${(r.y1 - by).toFixed(1)}" rx="1.5" fill="${C.wind}"/>`;
      const gv = num(hours.gust[i]); if (gv != null) { const gy = yIn(gv, r.y0, r.y1, 0, vmax); s += `<line x1="${(cx + hw / 2 - bw / 2 - 1).toFixed(1)}" y1="${gy.toFixed(1)}" x2="${(cx + hw / 2 + bw / 2 + 1).toFixed(1)}" y2="${gy.toFixed(1)}" stroke="${C.soft}" stroke-width="1.4"/>`; } }
    const ar = Y.arrow, ay = (ar.y0 + ar.y1) / 2, step = mob ? 2 : 1;
    for (let k = 0; k < 24; k += step) { const dv = num(hours.windDir[k]); if (dv == null) continue; const ax = xAt(k) + hw / 2, dir = (dv + 180) % 360;
      s += `<g transform="translate(${ax.toFixed(1)},${ay.toFixed(1)}) rotate(${dir})"><path d="M0,-6 L0,6 M0,6 L-3,2 M0,6 L3,2" stroke="${C.soft}" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`;
      if (!mob && k % 3 === 0) s += `<text class="tm-tick" x="${ax.toFixed(1)}" y="${ar.y1 + 2}" text-anchor="middle">${windName(dv)}</text>`; } }

  // SEA 0-1
  { const r = Y.sea; s += `<line x1="${x0}" y1="${yIn(0.5, r.y0, r.y1, 0, 1).toFixed(1)}" x2="${x1}" y2="${yIn(0.5, r.y0, r.y1, 0, 1).toFixed(1)}" stroke="${C.ruleSoft}" stroke-width="1" stroke-dasharray="3 3"/>`;
    s += `<text class="tm-tick" x="${x0 - 5}" y="${r.y0 + 7}" text-anchor="end">1</text><text class="tm-tick" x="${x0 - 5}" y="${r.y1}" text-anchor="end">0</text>`;
    for (let i = 0; i < 24; i++) { const v = num(hours.sea[i]); if (v == null) continue; const cx = xAt(i), bw = hw * 0.56, col = v < 0.35 ? C.faint : v < 0.65 ? C.r[2] : C.r[3], by = yIn(v, r.y0, r.y1, 0, 1);
      s += `<rect x="${(cx + hw / 2 - bw / 2).toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1.5, r.y1 - by).toFixed(1)}" rx="1" fill="${col}"/>`; } }

  // SKY cloud strip + precip 0-4
  { const r = Y.sky, stripH = 6, vmax = 4;
    for (let i = 0; i < 24; i++) { const cx = xAt(i), cl = num(hours.cloud[i]) ?? 0; s += `<rect x="${(cx + 0.6).toFixed(1)}" y="${r.y0}" width="${(hw - 1.2).toFixed(1)}" height="${stripH}" fill="${C.muted}" opacity="${(0.1 + (cl / 100) * 0.7).toFixed(2)}"/>`; }
    let anyRain = false;
    for (let i = 0; i < 24; i++) { const p = num(hours.precip[i]); if (p == null || p <= 0) continue; anyRain = true; const cx = xAt(i), bw = hw * 0.56, bh = (Math.min(p, vmax) / vmax) * (r.y1 - (r.y0 + stripH + 4)); s += `<rect x="${(cx + hw / 2 - bw / 2).toFixed(1)}" y="${(r.y1 - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1" fill="${C.brand}" opacity=".7"/>`; }
    if (!mob && !anyRain) s += `<text class="tm-note" x="${(x0 + cw * 0.28).toFixed(1)}" y="${((r.y0 + r.y1) / 2 + 3)}" text-anchor="middle" style="fill:${C.faint};letter-spacing:.1em">DRY ALL DAY</text>`; }

  // AIR 5-25
  { const r = Y.air; const line = curve((t) => interp(hours.air, t), r.y0, r.y1, 5, 25); if (line) s += `<path d="${line}" fill="none" stroke="${C.r[3]}" stroke-width="1.6"/>`;
    [25, 15, 5].forEach((tk) => { s += `<text class="tm-tick" x="${x0 - 5}" y="${yIn(tk, r.y0, r.y1, 5, 25) + 3}" text-anchor="end">${tk}</text>`; });
    if (!mob) { const ex = extremes(hours.air); const hiE = ex.filter((e) => e.hi)[0], loE = ex.filter((e) => !e.hi)[0];
      [loE, hiE].forEach((e) => { if (!e) return; const px = xAt(e.i), py = yIn(e.v, r.y0, r.y1, 5, 25), a = annAt(px); s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.2" fill="${C.r[3]}"/><text class="tm-ann tm-sub" x="${a.x.toFixed(1)}" y="${py + (e.hi ? -7 : 14)}" text-anchor="${a.anchor}">${e.hi ? "H" : "L"} ${e.v.toFixed(1)}° ${hh(e.i)}</text>`; }); } }

  // labels
  rows.forEach((r) => { if (r.k === "arrow") return;
    if (mob) s += `<text class="tm-lbl" x="${x0}" y="${(r.y0 ?? 0) - 4}">${r.l.toUpperCase()}</text>`;
    else { s += `<text class="tm-lbl" x="12" y="${(r.y0 ?? 0) + 14}">${r.l.toUpperCase()}</text>`; if (r.n) s += `<text class="tm-note" x="12" y="${(r.y0 ?? 0) + 30}">${r.n}</text>`; } });

  // hour axis + sun ticks
  for (let a = 0; a <= 24; a += mob ? 6 : 3) s += `<text class="tm-ax" x="${xAt(a).toFixed(1)}" y="${axisY + 12}" text-anchor="middle">${String(a).padStart(2, "0")}</text>`;
  [sun.sunrise, sun.sunset].forEach((t) => { s += `<text x="${xAt(t).toFixed(1)}" y="${axisY + 12}" text-anchor="middle" style="font-size:${mob ? 8 : 9}px;fill:${C.r[2]}">☀</text>`; });

  // right-gutter readouts (desktop)
  if (!mob) { const rx = x1 + 14;
    ([["score", Y.score], ["tide", Y.tide], ["cur", Y.cur], ["wind", Y.wind], ["sea", Y.sea], ["air", Y.air]] as const).forEach(([k, r]) => {
      const midy = (r.y0 + r.y1) / 2;
      s += `<text class="tm-rv" id="${id}-${k}-v" x="${rx}" y="${midy}">—</text><text class="tm-rs" id="${id}-${k}-s" x="${rx}" y="${midy + 13}">—</text>`; });
  }

  // cursor — the group translates to the selected hour's cell centre, so its
  // score-cell outline highlights only the selected cell (relative to origin
  // 0, the cell spans 0.8-hw/2 wide by hw-1.6).
  const selX = (0.8 - hw / 2).toFixed(1), selW = (hw - 1.6).toFixed(1);
  s += `<g id="${id}-cur"><rect x="${selX}" y="${(Y.score.y0 - 1).toFixed(1)}" width="${selW}" height="${(Y.score.y1 - Y.score.y0 + 2).toFixed(1)}" rx="2" fill="none" stroke="${C.brand}" stroke-width="2"/><line x1="0" y1="${cTop}" x2="0" y2="${mob ? cBot : axisY + 2}" stroke="${C.brand}" stroke-width="1.5"/><rect x="-24" y="${cTop - 21}" width="48" height="18" rx="2" fill="${C.brand}"/><text class="tm-ctag" x="0" y="${cTop - 7}" text-anchor="middle">00:00</text></g>`;
  s += "</svg>";
  return s;
}

export default function SpotTerminal({
  hours, realCurrent, sun, nowHour, selectedHour, onSelectHour, bestWindow, speciesName,
}: {
  hours: TerminalHours;
  /** Signed real current (kn, +flood −ebb) for the day; null → tide-derived fallback. */
  realCurrent?: (number | null)[] | null;
  sun: SunHours;
  nowHour: number;
  selectedHour: number;
  onSelectHour: (h: number) => void;
  bestWindow: [number, number] | null;
  speciesName: string | null;
}) {
  const deskRef = useRef<HTMLDivElement>(null);
  const mobRef = useRef<HTMLDivElement>(null);
  const cur = currentRow(realCurrent, hours.tide);
  const current = cur.v;

  // Render the desktop terminal 1:1 (viewBox width = pixel width) so font sizes
  // are true CSS px and match the app's type scale — not scaled fractions.
  const [deskW, setDeskW] = useState(1120);
  useEffect(() => {
    const el = deskRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 400) setDeskW(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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
    return {
      hour: hh(hi), score: sc == null ? "—" : String(sc), verd: verdict(sc), col: ratingCol(sc), scoreDeltaTxt,
      tide: (num(hours.tide[hi]) ?? 0).toFixed(1) + "m", tideS: tR ? "Rising ▲" : "Falling ▼",
      curSigned: (cv >= 0 ? "+" : "") + cv.toFixed(1) + "kn", curS: cs,
      wind: (num(hours.wind[hi]) ?? 0).toFixed(0) + "kn", windS: windName(hours.windDir[hi]) + " G" + (num(hours.gust[hi]) ?? 0).toFixed(0),
      sea: (num(hours.sea[hi]) ?? 0).toFixed(1) + "m", seaS: seaWord(num(hours.sea[hi])),
      air: (num(hours.air[hi]) ?? 0).toFixed(1) + "°", airS: airWord(num(hours.air[hi])),
    };
  };

  // Build both SVGs when data changes.
  useEffect(() => {
    if (deskRef.current && deskW > 400) deskRef.current.innerHTML = buildSvg(hours, cur, sun, bestWindow, { w: deskW, LABEL: 132, READ: 72, mobile: false, id: "tmd" });
    if (mobRef.current) mobRef.current.innerHTML = buildSvg(hours, cur, sun, bestWindow, { w: 414, LABEL: 12, READ: 8, mobile: true, id: "tmm" });
    // Scrub only over scored hours: leading/trailing hours with no fishing score
    // (e.g. today's 00:00, which has tide but no weather forecast yet) render as
    // empty cells and must not hold the cursor — clamp the selectable range to
    // the first…last scored hour so the readout never lands on an empty cell.
    let loH = hours.score.findIndex((v) => num(v) != null);
    if (loH < 0) loH = 0;
    let hiH = 23; while (hiH > loH && num(hours.score[hiH]) == null) hiH--;
    const clampH = (h: number) => Math.max(loH, Math.min(hiH, h));
    const wire = (host: HTMLDivElement | null, id: string, mob: boolean) => {
      const svg = host?.querySelector("svg") as SVGSVGElement | null; if (!svg) return;
      const hFromEvt = (e: PointerEvent) => {
        const r = svg.getBoundingClientRect(); const scale = svg.viewBox.baseVal.width / r.width;
        const vx = (e.clientX - r.left) * scale; const x0 = mob ? 12 : 132, hw = (svg.viewBox.baseVal.width - x0 - (mob ? 8 : 72)) / 24;
        return (vx - x0) / hw - 0.5;
      };
      const move = (e: PointerEvent) => onSelectHour(clampH(Math.round(hFromEvt(e))));
      let down = false;
      svg.addEventListener("pointerdown", (e) => { down = true; move(e); });
      svg.addEventListener("pointermove", (e) => { if (down || e.pointerType === "mouse") move(e); });
      // Keep the scrubbed hour after release (touch can park); only mouse-hover snaps back to now.
      svg.addEventListener("pointerup", () => { down = false; });
      svg.addEventListener("pointerleave", (e) => {
        down = false;
        if (e.pointerType === "mouse") onSelectHour(clampH(nowHour));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, realCurrent, sun, bestWindow, deskW]);

  // Move cursor + refresh readouts when the selected hour changes.
  useEffect(() => {
    const apply = (host: HTMLDivElement | null, id: string, mob: boolean) => {
      const svg = host?.querySelector("svg") as SVGSVGElement | null; if (!svg) return;
      const x0 = mob ? 12 : 132, hw = (svg.viewBox.baseVal.width - x0 - (mob ? 8 : 72)) / 24;
      const g = svg.querySelector(`#${id}-cur`) as SVGGElement | null; if (!g) return;
      const cx = x0 + selectedHour * hw + hw / 2;
      g.setAttribute("transform", `translate(${cx.toFixed(1)},0)`);
      const tag = g.querySelector("text"); if (tag) tag.textContent = hh(selectedHour);
      const rd = readAt(selectedHour);
      svg.setAttribute("aria-valuenow", String(selectedHour));
      svg.setAttribute(
        "aria-valuetext",
        `${rd.hour}, score ${rd.score} ${rd.verd}, tide ${rd.tide}, wind ${rd.wind}, sea ${rd.seaS}, air ${rd.air}`,
      );
      if (!mob) { const d = readAt(selectedHour);
        const set = (k: string, v: string, fill?: string) => { const e = svg.querySelector(`#${id}-${k}-v`); if (e) { e.textContent = v; if (fill) e.setAttribute("fill", fill); } };
        const sub = (k: string, v: string) => { const e = svg.querySelector(`#${id}-${k}-s`); if (e) e.textContent = v; };
        set("score", d.score, d.col); sub("score", `${d.verd}${d.scoreDeltaTxt}`);
        set("tide", d.tide); sub("tide", d.tideS);
        set("cur", d.curSigned); sub("cur", d.curS);
        set("wind", d.wind); sub("wind", d.windS);
        set("sea", d.sea); sub("sea", d.seaS);
        set("air", d.air); sub("air", d.airS);
      }
    };
    apply(deskRef.current, "tmd", false);
    apply(mobRef.current, "tmm", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHour, hours, realCurrent, deskW]);

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
        {cell("Cursor", d.hour, isNow ? "Now" : selectedHour < nowHour ? "Past" : "Ahead", "#1E40E0")}
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
