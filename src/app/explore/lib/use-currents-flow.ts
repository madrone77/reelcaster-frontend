"use client";

import { useEffect, useRef } from "react";
import type { CustomLayerInterface, Map as MlMap } from "maplibre-gl";

// Faithful port of bluecaster's bathy-relief flow engine (app/bathy-relief/
// relief.html `startFlow`) — the richer, dual-layer Windy-style currents seen on
// https://www.bluecaster.co/bathy-relief, NOT the simpler DOM-canvas hook
// (useCurrentsArrows / our old use-currents). It renders as a MapLibre custom
// (WebGL) layer composed of TWO offscreen 2D canvases blitted as fullscreen
// quads every frame:
//   1. FIELD canvas    — a smooth speed→colour heatmap (blue calm → red fast),
//      a low-res grid image stretched over the field bbox with bilinear
//      smoothing. This is "the area changing colour gradiently."
//   2. PARTICLE canvas — WHITE streaks (with a faint dark shadow) advected by the
//      U/V field, leaving fading trails, drawn on top of the colour field.
// Inserted just below the regulatory grid (`subarea-lines-casing`) so land + regs
// render after and mask the flow — currents stop at the coastline. The land mask
// is forced into the translucent pass (fill-opacity 0.999) while currents are on
// so it draws AFTER the custom layer; reset to 1 when off.
//
// Data comes from the same-origin proxy /api/bluecaster/currents/field
// (→ bluecaster's auth-free /api/map/currents/field), returning
// { cols, rows, bbox:[w,s,e,n], u, v, max_speed_kn }.

const FLOW_BEFORE_ID = "subarea-lines-casing";

// Currents config — verbatim from relief.html FLOW_CFG.currents. ramp is
// ABSOLUTE knots breakpoints (red always = fast), not normalized to the field max.
const CFG = {
  endpoint: "/api/bluecaster/currents/field",
  cols: 64,
  rows: 48,
  pad: 0.2,
  particles: 3800,
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
  ] as Array<[number, [number, number, number]]>,
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
function rampRGB(sp: number, ramp: typeof CFG.ramp): [number, number, number] {
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
function startFlow(map: MlMap, getTime: () => string | null): FlowController {
  const container = map.getContainer();
  const fieldCanvas = document.createElement("canvas");
  const partCanvas = document.createElement("canvas");
  const fctx = fieldCanvas.getContext("2d")!;
  const ctx = partCanvas.getContext("2d")!;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let W = 0;
  let H = 0;
  const resize = () => {
    W = container.clientWidth;
    H = container.clientHeight;
    for (const cv of [fieldCanvas, partCanvas]) {
      cv.width = W * dpr;
      cv.height = H * dpr;
    }
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  let field: Field | null = null;
  let fieldImg: HTMLCanvasElement | null = null;
  let retries = 0;
  let stopped = false;
  const P = new Float64Array(CFG.particles * 3);
  let seeded = false;

  const spawn = (i: number) => {
    const b = map.getBounds();
    const w = field ? Math.max(field.w, b.getWest()) : b.getWest();
    const e = field ? Math.min(field.e, b.getEast()) : b.getEast();
    const s = field ? Math.max(field.s, b.getSouth()) : b.getSouth();
    const n = field ? Math.min(field.n, b.getNorth()) : b.getNorth();
    P[i * 3] = w + Math.random() * (e - w);
    P[i * 3 + 1] = s + Math.random() * (n - s);
    P[i * 3 + 2] = Math.random() * CFG.maxAge;
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
        const col = rampRGB(Math.hypot(uu, vv), CFG.ramp);
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
    const padX = (b.getEast() - b.getWest()) * CFG.pad;
    const padY = (b.getNorth() - b.getSouth()) * CFG.pad;
    const qs = new URLSearchParams({
      bbox: `${b.getWest() - padX},${b.getSouth() - padY},${b.getEast() + padX},${b.getNorth() + padY}`,
      cols: String(CFG.cols),
      rows: String(CFG.rows),
    });
    const time = getTime();
    if (time) qs.set("time", time);
    try {
      const g = await fetch(`${CFG.endpoint}?${qs}`).then((r) => (r.ok ? r.json() : null));
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
        max: g.max_speed_kn || CFG.defaultMax,
      };
      buildFieldImg();
      if (!seeded) {
        for (let i = 0; i < CFG.particles; i++) spawn(i);
        seeded = true;
      }
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
    drawField(); // colour heatmap (own canvas)
    // particle canvas: fade old trails, then draw fresh WHITE streaks
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = `rgba(0,0,0,${CFG.trailFade})`;
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.lineCap = "round";
    const pxPerDeg = (256 * Math.pow(2, map.getZoom())) / 360;
    const scale = CFG.pxPerKt / pxPerDeg;
    for (let i = 0; i < CFG.particles; i++) {
      const lng = P[i * 3];
      const lat = P[i * 3 + 1];
      const age = P[i * 3 + 2];
      const uv = sampleUV(lng, lat);
      if (!uv || age > CFG.maxAge) {
        spawn(i);
        continue;
      }
      const cosLat = Math.cos((lat * Math.PI) / 180) || 1;
      const nlng = lng + (uv[0] * scale) / cosLat;
      const nlat = lat + uv[1] * scale;
      const p0 = map.project([lng, lat]);
      const p1 = map.project([nlng, nlat]);
      // faint dark shadow then a white streak -> ribbons lift off the field.
      ctx.strokeStyle = CFG.shadow;
      ctx.lineWidth = CFG.shadowW;
      ctx.beginPath();
      ctx.moveTo(p0.x + 0.4, p0.y + 0.5);
      ctx.lineTo(p1.x + 0.4, p1.y + 0.5);
      ctx.stroke();
      ctx.strokeStyle = "rgb(255,255,255)";
      ctx.lineWidth = CFG.line;
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
    id: "flow",
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
      blit(texField, fieldCanvas, CFG.fieldOpacity);
      blit(texPart, partCanvas, CFG.particleOpacity);
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
 * Mounts the bathy-relief WebGL currents flow on the map while `enabled`.
 * Inserts the custom layer below the regulatory grid and forces the land mask
 * into the translucent pass so currents stop at the coastline.
 */
export function useCurrentsFlow({
  map,
  enabled,
  timeIso,
}: {
  map: MlMap | null;
  enabled: boolean;
  timeIso: string | null;
}) {
  const timeRef = useRef<string | null>(timeIso);
  timeRef.current = timeIso;
  const fetchRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!map || !enabled) return;

    const { layer, fetchField } = startFlow(map, () => timeRef.current);
    fetchRef.current = fetchField;

    // Land mask → translucent pass so it renders AFTER the custom layer and
    // clips the currents at the coastline.
    if (map.getLayer("land")) map.setPaintProperty("land", "fill-opacity", 0.999);
    map.addLayer(layer, map.getLayer(FLOW_BEFORE_ID) ? FLOW_BEFORE_ID : undefined);

    return () => {
      if (map.getLayer("flow")) map.removeLayer("flow");
      if (map.getLayer("land")) map.setPaintProperty("land", "fill-opacity", 1);
      fetchRef.current = () => {};
    };
  }, [map, enabled]);

  // Re-fetch the field when the scrubber time changes (no rebuild).
  useEffect(() => {
    if (enabled) fetchRef.current?.();
  }, [timeIso, enabled]);
}
