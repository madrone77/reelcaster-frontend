"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CustomLayerInterface, Map as MlMap } from "maplibre-gl";

// Faithful port of bluecaster's bathy-relief flow engine (app/bathy-relief/
// relief.html `startFlow`) — the richer, dual-layer Windy-style overlay seen on
// https://www.bluecaster.co/bathy-relief, NOT the simpler DOM-canvas hook
// (useCurrentsArrows / our old use-currents). It renders as a MapLibre custom
// (WebGL) layer composed of TWO offscreen 2D canvases blitted as fullscreen
// quads every frame:
//   1. FIELD canvas    — a smooth speed→colour heatmap (blue calm → red fast),
//      a low-res grid image stretched over the field bbox with bilinear
//      smoothing. This is "the area changing colour gradiently."
//   2. PARTICLE canvas — WHITE streaks (with a faint dark shadow) advected by the
//      U/V field, leaving fading trails, drawn on top of the colour field.
//
// ONE engine drives both overlays, exactly as relief.html does — currents and
// wind differ only in their source endpoint, their speed→colour ramp, and how
// the coastline treats them. Data comes from the same-origin proxies
// /api/bluecaster/currents/field and /api/bluecaster/wind/field (→ bluecaster's
// auth-free /api/map/*/field), both returning
// { cols, rows, bbox:[w,s,e,n], u, v, max_speed_kn } for the instant asked for,
// so the day/hour scrubber moves either field the same way.

const FLOW_BEFORE_ID = "subarea-lines-casing";

export type FlowKind = "currents" | "wind";

/** Ascending [speed_kn, [r,g,b]] stops. ABSOLUTE — red always means fast. */
type Ramp = Array<[number, [number, number, number]]>;

interface FlowCfg {
  layerId: string;
  endpoint: string;
  /** Field grid resolution requested from the API. */
  cols: number;
  rows: number;
  /** Over-fetch beyond the viewport, as a fraction of its span. */
  pad: number;
  density: number;
  minParticles: number;
  maxParticles: number;
  maxAge: number;
  trailFade: number;
  pxPerKt: number;
  defaultMax: number;
  fieldOpacity: number;
  particleOpacity: number;
  line: number;
  shadow: string;
  shadowW: number;
  ramp: Ramp;
  /**
   * Push the land mask into the translucent pass so it paints AFTER the custom
   * layer and clips the flow at the coastline. True for currents, which must
   * stop at the shore; false for wind, which blows over land.
   */
  clipAtCoast: boolean;
}

// Both configs are verbatim from relief.html FLOW_CFG, except that the fixed
// particle counts became an area-based `density`.
const CFGS: Record<FlowKind, FlowCfg> = {
  currents: {
    layerId: "flow-currents",
    endpoint: "/api/bluecaster/currents/field",
    cols: 64,
    rows: 48,
    pad: 0.2,
    // Particle count follows the map's on-screen AREA rather than being fixed, so
    // every map renders at the same streak density. A fixed 3800 spread over the
    // full-screen Explore map is a sparse drift of hairlines; the same 3800 packed
    // into the spot page's ~378x286 mini-map is 11x denser — a bold white mat that
    // reads as a different animation. `density` is calibrated so a full-viewport
    // Explore map (~1440x840) still gets ~3800, i.e. Explore is unchanged.
    density: 3800 / (1440 * 840),
    minParticles: 250,
    maxParticles: 6000,
    maxAge: 180,
    trailFade: 0.96,
    pxPerKt: 0.175,
    defaultMax: 1.5,
    fieldOpacity: 0.5,
    particleOpacity: 0.85,
    line: 0.9,
    shadow: "rgba(40,55,80,0.16)",
    shadowW: 1.5,
    // tidal speeds are slow (kn): blue(slack)->cyan->green->yellow->orange->red
    ramp: [
      [0, [40, 96, 175]],
      [0.4, [50, 155, 205]],
      [0.9, [70, 190, 120]],
      [1.6, [205, 205, 60]],
      [2.4, [238, 140, 42]],
      [3.5, [216, 55, 45]],
    ],
    clipAtCoast: true,
  },
  wind: {
    layerId: "flow-wind",
    endpoint: "/api/bluecaster/wind/field",
    // Wind is smooth and large-scale, so a coarse grid interpolates cleanly and
    // each node costs one upstream forecast point. 12x9 = 108 cells, inside the
    // endpoint's 300-cell budget at any viewport.
    cols: 12,
    rows: 9,
    pad: 0.35,
    // Denser and longer-lived than relief.html's 1200/0.90/0.028, which were
    // tuned for a full-screen regional view. At the spot mini-map's size, in the
    // 2-6 kn air that BC summer mornings actually deliver, those numbers advance
    // a streak ~0.08 px per frame and fade it inside 10 frames — a mat of static
    // white dots, which is exactly the "the toggle does nothing" reading this
    // layer is here to fix. Speed still scales with the real wind; a calm day is
    // a slow drift, a 25 kn day tears across.
    density: 2600 / (1440 * 840),
    minParticles: 180,
    maxParticles: 3200,
    maxAge: 140,
    trailFade: 0.95,
    // Wind runs an order of magnitude faster than tide (25 kn vs 1.5 kn), so the
    // px-per-knot step is scaled well down to keep streak LENGTH comparable.
    pxPerKt: 0.09,
    defaultMax: 25,
    fieldOpacity: 0.6,
    particleOpacity: 0.85,
    line: 0.9,
    shadow: "rgba(30,30,40,0.18)",
    shadowW: 1.5,
    // Windy's knot ramp: blue(calm)->cyan->green->yellow->orange->red->magenta
    ramp: [
      [0, [58, 110, 190]],
      [6, [60, 175, 205]],
      [11, [70, 190, 120]],
      [15, [170, 205, 70]],
      [19, [240, 205, 60]],
      [24, [240, 140, 45]],
      [30, [222, 60, 45]],
      [40, [150, 35, 80]],
    ],
    clipAtCoast: false,
  },
};

interface Field {
  cols: number;
  rows: number;
  w: number;
  s: number;
  e: number;
  n: number;
  u: (number | null)[];
  v: (number | null)[];
  max: number;
}

// Speed (kn) → RGB via the absolute ramp, linearly interpolated between stops.
function rampRGB(sp: number, ramp: Ramp): [number, number, number] {
  if (sp <= ramp[0][0]) return ramp[0][1];
  for (let i = 1; i < ramp.length; i++) {
    if (sp <= ramp[i][0]) {
      const [k0, a] = ramp[i - 1];
      const [k1, b] = ramp[i];
      const f = (sp - k0) / ((k1 - k0) || 1);
      return [
        Math.round(a[0] + (b[0] - a[0]) * f),
        Math.round(a[1] + (b[1] - a[1]) * f),
        Math.round(a[2] + (b[2] - a[2]) * f),
      ];
    }
  }
  return ramp[ramp.length - 1][1];
}

interface FlowController {
  layer: CustomLayerInterface;
  fetchField: () => void;
}

// Build the flow controller for a given map. Mirrors relief.html `startFlow`;
// only adapted for TS + the proxy endpoint + an optional `time` param.
function startFlow(
  map: MlMap,
  cfg: FlowCfg,
  getTime: () => string | null,
): FlowController {
  const container = map.getContainer();
  const fieldCanvas = document.createElement("canvas");
  const partCanvas = document.createElement("canvas");
  const fctx = fieldCanvas.getContext("2d")!;
  const ctx = partCanvas.getContext("2d")!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  // How many of P's slots are live this frame — recomputed on every resize so a
  // map that changes size (the spot mini-map expanding to fullscreen) keeps the
  // same streak density instead of thinning out or clotting.
  let nParticles = 0;
  const resize = () => {
    W = container.clientWidth;
    H = container.clientHeight;
    for (const cv of [fieldCanvas, partCanvas]) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    nParticles = Math.min(
      cfg.maxParticles,
      Math.max(cfg.minParticles, Math.round(W * H * cfg.density)),
    );
  };
  resize();

  let field: Field | null = null;
  let fieldImg: HTMLCanvasElement | null = null;
  let retries = 0;
  let stopped = false;
  // Allocated once at the cap; only the first `nParticles` slots are simulated.
  const P = new Float64Array(cfg.maxParticles * 3);
  // High-water mark of initialised slots. Growing the count seeds the new slots;
  // shrinking drops the mark so they get fresh positions if the map grows again.
  let seededUpTo = 0;

  const spawn = (i: number) => {
    const b = map.getBounds();
    const w = field ? Math.max(field.w, b.getWest()) : b.getWest();
    const e = field ? Math.min(field.e, b.getEast()) : b.getEast();
    const s = field ? Math.max(field.s, b.getSouth()) : b.getSouth();
    const n = field ? Math.min(field.n, b.getNorth()) : b.getNorth();
    P[i * 3] = w + Math.random() * (e - w);
    P[i * 3 + 1] = s + Math.random() * (n - s);
    P[i * 3 + 2] = Math.random() * cfg.maxAge;
  };

  // Bring the live slot count in line with `nParticles` after a resize (or the
  // very first field). Ages start scattered so the extra streaks fade in over a
  // cycle instead of all appearing and dying together.
  const seedParticles = () => {
    if (seededUpTo > nParticles) seededUpTo = nParticles;
    while (seededUpTo < nParticles) spawn(seededUpTo++);
  };

  const sampleUV = (lng: number, lat: number): [number, number] | null => {
    if (!field) return null;
    const { cols, rows, w, s, e, n, u, v } = field;
    if (lng < w || lng > e || lat < s || lat > n) return null;
    const fx = ((lng - w) / (e - w)) * (cols - 1);
    const fy = ((lat - s) / (n - s)) * (rows - 1);
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const x1 = Math.min(x0 + 1, cols - 1);
    const y1 = Math.min(y0 + 1, rows - 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const id = (yy: number, xx: number) => yy * cols + xx;
    const u00 = u[id(y0, x0)], u10 = u[id(y0, x1)], u01 = u[id(y1, x0)], u11 = u[id(y1, x1)];
    const v00 = v[id(y0, x0)], v10 = v[id(y0, x1)], v01 = v[id(y1, x0)], v11 = v[id(y1, x1)];
    if (u00 == null || u10 == null || u01 == null || u11 == null ||
        v00 == null || v10 == null || v01 == null || v11 == null) return null;
    const uu = (u00 * (1 - tx) + u10 * tx) * (1 - ty) + (u01 * (1 - tx) + u11 * tx) * ty;
    const vv = (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty;
    return [uu, vv];
  };

  // Rasterise the field into a low-res RGBA image (1 px per grid node), north-up,
  // transparent where the model has no value. drawImage upscales it with bilinear
  // smoothing into a continuous gradient.
  const buildFieldImg = () => {
    if (!field) {
      fieldImg = null;
      return;
    }
    const { cols, rows, u, v } = field;
    const oc = document.createElement("canvas");
    oc.width = cols;
    oc.height = rows;
    const octx = oc.getContext("2d")!;
    const im = octx.createImageData(cols, rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c; // field row 0 = south
        const p = ((rows - 1 - r) * cols + c) * 4; // image row 0 = north
        const uu = u[idx];
        const vv = v[idx];
        if (uu == null || vv == null || !isFinite(uu) || !isFinite(vv)) {
          im.data[p + 3] = 0;
          continue;
        }
        const col = rampRGB(Math.hypot(uu, vv), cfg.ramp);
        im.data[p] = col[0];
        im.data[p + 1] = col[1];
        im.data[p + 2] = col[2];
        im.data[p + 3] = 255;
      }
    }
    octx.putImageData(im, 0, 0);
    fieldImg = oc;
  };

  const drawField = () => {
    fctx.clearRect(0, 0, W, H);
    if (!fieldImg || !field) return;
    const a = map.project([field.w, field.n]); // NW (top-left)
    const b = map.project([field.e, field.s]); // SE (bottom-right)
    fctx.imageSmoothingEnabled = true;
    fctx.drawImage(fieldImg, a.x, a.y, b.x - a.x, b.y - a.y);
  };

  const fetchField = async () => {
    const b = map.getBounds();
    // Over-fetch beyond the viewport so the colour field always OVERFILLS the
    // screen — hard rectangle edges stay off-screen during pan/zoom and the
    // field never reads as a floating tile.
    const padX = (b.getEast() - b.getWest()) * cfg.pad;
    const padY = (b.getNorth() - b.getSouth()) * cfg.pad;
    const qs = new URLSearchParams({
      bbox: `${b.getWest() - padX},${b.getSouth() - padY},${b.getEast() + padX},${b.getNorth() + padY}`,
      cols: String(cfg.cols),
      rows: String(cfg.rows),
    });
    const time = getTime();
    if (time) qs.set("time", time);
    try {
      const g = await fetch(`${cfg.endpoint}?${qs}`).then((r) => (r.ok ? r.json() : null));
      if (!g) throw new Error("no field");
      field = {
        cols: g.cols,
        rows: g.rows,
        w: g.bbox[0],
        s: g.bbox[1],
        e: g.bbox[2],
        n: g.bbox[3],
        u: g.u,
        v: g.v,
        max: g.max_speed_kn || cfg.defaultMax,
      };
      buildFieldImg();
      retries = 0;
    } catch {
      // Self-heal with a bounded backoff if we have NOTHING to show yet.
      if (!field && retries < 6) {
        retries++;
        setTimeout(() => {
          if (!stopped) fetchField();
        }, 10000);
      }
    }
  };

  let moving = false;
  const onMoveStart = () => {
    moving = true;
    ctx.clearRect(0, 0, W, H);
    fctx.clearRect(0, 0, W, H);
  };
  const onMoveEnd = () => {
    moving = false;
    resize();
    fetchField();
  };

  // One simulation step — redraw the colour field and advect the white particle
  // streaks onto the offscreen 2D canvases.
  const step = () => {
    if (moving || !field) return;
    seedParticles();
    drawField(); // colour heatmap (own canvas)
    // particle canvas: fade old trails, then draw fresh WHITE streaks
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = `rgba(0,0,0,${cfg.trailFade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    const pxPerDeg = (256 * Math.pow(2, map.getZoom())) / 360;
    const scale = cfg.pxPerKt / pxPerDeg;
    for (let i = 0; i < nParticles; i++) {
      const lng = P[i * 3];
      const lat = P[i * 3 + 1];
      const age = P[i * 3 + 2];
      const uv = sampleUV(lng, lat);
      if (!uv || age > cfg.maxAge) {
        spawn(i);
        continue;
      }
      const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
      const nlng = lng + (uv[0] * scale) / cosLat;
      const nlat = lat + uv[1] * scale;
      const p0 = map.project([lng, lat]);
      const p1 = map.project([nlng, nlat]);
      // faint dark shadow then a white streak -> ribbons lift off the field.
      ctx.strokeStyle = cfg.shadow;
      ctx.lineWidth = cfg.shadowW;
      ctx.beginPath();
      ctx.moveTo(p0.x + 0.4, p0.y + 0.5);
      ctx.lineTo(p1.x + 0.4, p1.y + 0.5);
      ctx.stroke();
      ctx.strokeStyle = "rgb(255,255,255)";
      ctx.lineWidth = cfg.line;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
      P[i * 3] = nlng;
      P[i * 3 + 1] = nlat;
      P[i * 3 + 2] = age + 1;
    }
  };

  // MapLibre custom (WebGL) layer: each frame upload the two offscreen canvases
  // as textures and draw them as fullscreen quads.
  let prog: WebGLProgram;
  let quadBuf: WebGLBuffer;
  let texField: WebGLTexture;
  let texPart: WebGLTexture;
  let aPos: number;
  let uTex: WebGLUniformLocation | null;
  let uOp: WebGLUniformLocation | null;
  let glRef: WebGLRenderingContext | WebGL2RenderingContext | null = null;

  const compile = (
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    type: number,
    src: string,
  ) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const mkTex = (gl: WebGLRenderingContext | WebGL2RenderingContext) => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  };

  const layer: CustomLayerInterface = {
    id: cfg.layerId,
    type: "custom",
    onAdd(_m, gl) {
      glRef = gl;
      const vs = compile(
        gl,
        gl.VERTEX_SHADER,
        "attribute vec2 a_pos; varying vec2 v_uv;" +
          "void main(){ v_uv = vec2((a_pos.x+1.0)*0.5, 1.0-(a_pos.y+1.0)*0.5); gl_Position = vec4(a_pos,0.0,1.0); }",
      );
      const fs = compile(
        gl,
        gl.FRAGMENT_SHADER,
        "precision mediump float; uniform sampler2D u_tex; uniform float u_op; varying vec2 v_uv;" +
          "void main(){ gl_FragColor = texture2D(u_tex, v_uv) * u_op; }",
      );
      prog = gl.createProgram()!;
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      aPos = gl.getAttribLocation(prog, "a_pos");
      uTex = gl.getUniformLocation(prog, "u_tex");
      uOp = gl.getUniformLocation(prog, "u_op");
      quadBuf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      texField = mkTex(gl);
      texPart = mkTex(gl);
      map.on("movestart", onMoveStart);
      map.on("moveend", onMoveEnd);
      window.addEventListener("resize", resize);
      resize();
      fetchField();
    },
    render(gl) {
      step();
      gl.useProgram(prog);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
      gl.disable(gl.DEPTH_TEST);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
      const blit = (tex: WebGLTexture, canvas: HTMLCanvasElement, op: number) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
        gl.uniform1i(uTex, 0);
        gl.uniform1f(uOp, op);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      blit(texField, fieldCanvas, cfg.fieldOpacity);
      blit(texPart, partCanvas, cfg.particleOpacity);
      map.triggerRepaint();
    },
    onRemove() {
      stopped = true;
      map.off("movestart", onMoveStart);
      map.off("moveend", onMoveEnd);
      window.removeEventListener("resize", resize);
      const gl = glRef;
      if (gl) {
        gl.deleteProgram(prog);
        gl.deleteBuffer(quadBuf);
        gl.deleteTexture(texField);
        gl.deleteTexture(texPart);
      }
    },
  };

  return { layer, fetchField };
}

/**
 * The one-flow-at-a-time rule, shared by every surface that offers both
 * controls.
 *
 * Currents and Wind used to be two independent booleans per surface, so a map
 * could run both engines over the same water: two sets of white streaks moving
 * at different speeds, reading as one field that belongs to neither dataset.
 * They are one choice, so they get one piece of state. Picking either turns the
 * other off, and picking the one already running turns it off.
 */
export function useFlowLayer(initial: FlowKind | null = null) {
  const [flow, setFlow] = useState<FlowKind | null>(initial);
  const toggleCurrents = useCallback(
    () => setFlow((f) => (f === "currents" ? null : "currents")),
    [],
  );
  const toggleWind = useCallback(
    () => setFlow((f) => (f === "wind" ? null : "wind")),
    [],
  );
  return {
    flow,
    currents: flow === "currents",
    wind: flow === "wind",
    toggleCurrents,
    toggleWind,
    setFlow,
  };
}

/**
 * Mounts the bathy-relief WebGL flow overlay on the map while `enabled`,
 * rendering either the tidal-current field or the surface-wind field. The
 * custom layer goes below the regulatory grid so land and regs paint over it;
 * for currents the land mask is additionally pushed into the translucent pass
 * so the flow stops at the coastline, which wind deliberately does not do.
 */
export function useFlow({
  map,
  kind,
  enabled,
  timeIso,
}: {
  map: MlMap | null;
  kind: FlowKind;
  enabled: boolean;
  /** Scrubber instant the field is sampled at; null = model "now". */
  timeIso: string | null;
}) {
  const timeRef = useRef<string | null>(timeIso);
  timeRef.current = timeIso;
  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!map || !enabled) return;
    const cfg = CFGS[kind];

    const { layer, fetchField } = startFlow(map, cfg, () => timeRef.current);
    fetchRef.current = fetchField;

    // Land mask → translucent pass so it renders AFTER the custom layer and
    // clips the currents at the coastline. Wind is allowed over land, so it
    // leaves the mask in the opaque pass, where it paints BEFORE the flow.
    if (cfg.clipAtCoast && map.getLayer("land")) {
      map.setPaintProperty("land", "fill-opacity", 0.999);
    }
    map.addLayer(layer, map.getLayer(FLOW_BEFORE_ID) ? FLOW_BEFORE_ID : undefined);

    return () => {
      if (map.getLayer(cfg.layerId)) map.removeLayer(cfg.layerId);
      if (cfg.clipAtCoast && map.getLayer("land")) {
        map.setPaintProperty("land", "fill-opacity", 1);
      }
      fetchRef.current = () => {};
    };
  }, [map, kind, enabled]);

  // Re-fetch the field when the scrubber time changes (no rebuild). Debounced
  // so dragging across hours coalesces into one fetch per pause, not 24.
  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(() => fetchRef.current?.(), 180);
    return () => clearTimeout(t);
  }, [timeIso, enabled]);
}
