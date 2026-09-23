/**
 * Bake the hero reel's map stills (src/lib/map/reel-still.ts) and upload the
 * missing ones to the `map-stills` bucket.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/capture-reel-stills.mjs
 *
 * BASE      site to capture from (default https://www.reelcaster.com). The
 *           frame list and the capture page both come from it, so the stills
 *           match what that deployment draws.
 * FORCE=1   recapture stills that already exist.
 * ONLY=city|spot   one kind only.
 * LIMIT=n   stop after n captures (for a trial run).
 * SLUGS=a,b only these cities or spots.
 * DRY=1     capture to ./reel-stills-out instead of uploading.
 *
 * Runs nightly from .github/workflows/capture-reel-stills.yml. Paths are
 * content-addressed (the frame's centre, zoom and size, plus STILL_VERSION),
 * so an existing path never needs replacing and the run only fills gaps: a new
 * city or spot, or everything after a STILL_VERSION bump.
 */
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'https://www.reelcaster.com';
const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.env.DRY === '1';
const FORCE = process.env.FORCE === '1';
const ONLY = process.env.ONLY;
const LIMIT = Number(process.env.LIMIT ?? Infinity);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 4);
const BUCKET = 'map-stills';

if (!DRY && (!SUPABASE_URL || !KEY)) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or DRY=1).');
  process.exit(1);
}

const auth = { Authorization: `Bearer ${KEY}`, apikey: KEY };

async function ensureBucket() {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (res.ok) console.log(`created bucket ${BUCKET}`);
  else if (res.status !== 400 && res.status !== 409) {
    throw new Error(`bucket create failed: ${res.status} ${await res.text()}`);
  }
}

const exists = async (path) =>
  (await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`, { method: 'HEAD' })).ok;

async function upload(path, body) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      ...auth,
      'Content-Type': 'image/webp',
      'x-upsert': 'true',
      // The path changes whenever the picture would, so it can be cached forever.
      'Cache-Control': 'max-age=31536000',
    },
    body,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} ${await res.text()}`);
}

const manifest = await (await fetch(`${BASE}/api/reel-stills`)).json();
const SLUGS = process.env.SLUGS ? new Set(process.env.SLUGS.split(',')) : null;
let frames = manifest.frames.filter(
  (f) => (!ONLY || f.kind === ONLY) && (!SLUGS || SLUGS.has(f.slug)),
);
console.log(`${frames.length} frames from ${BASE}`);

if (!DRY) {
  await ensureBucket();
  if (!FORCE) {
    const have = [];
    for (let i = 0; i < frames.length; i += 16) {
      const batch = frames.slice(i, i + 16);
      const hits = await Promise.all(batch.map((f) => exists(f.path)));
      batch.forEach((f, k) => !hits[k] && have.push(f));
    }
    frames = have;
  }
} else {
  fs.mkdirSync('reel-stills-out', { recursive: true });
}
frames = frames.slice(0, LIMIT);
console.log(`${frames.length} to capture`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || undefined });
let done = 0;
let failed = 0;
let next = 0;

async function capture(f) {
  const ctx = await browser.newContext({
    // Wider and taller than the still: the page's scrollbar gutter paints a
    // white stripe down the viewport's right edge, and this keeps it outside
    // the clip. The map itself is exactly f.w x f.h at the top left.
    viewport: { width: f.w + 48, height: f.h + 48 },
    deviceScaleFactor: manifest.dpr,
    userAgent: 'ReelCaster-Still/1.0 (monitor)',
  });
  try {
    const page = await ctx.newPage();
    const q = new URLSearchParams({ lat: f.lat, lng: f.lng, zoom: f.zoom, w: f.w, h: f.h });
    await page.goto(`${BASE}/dev/reel-still?${q}`, { waitUntil: 'load', timeout: 90_000 });
    await page.waitForFunction(() => window.__stillReady === true, null, { timeout: 90_000 });
    // One more frame so the last tiles are on the canvas, not just loaded.
    await page.waitForTimeout(400);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: f.w, height: f.h } });
    const webp = await sharp(png).webp({ quality: 75 }).toBuffer();
    if (DRY) fs.writeFileSync(`reel-stills-out/${f.path.replaceAll('/', '_')}`, webp);
    else await upload(f.path, webp);
    done++;
    if (done % 25 === 0) console.log(`  ${done}/${frames.length}`);
  } finally {
    await ctx.close();
  }
}

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < frames.length) {
      const f = frames[next++];
      try {
        await capture(f);
      } catch (err) {
        failed++;
        console.error(`  failed ${f.path}: ${err.message}`);
      }
    }
  }),
);
await browser.close();
console.log(`captured ${done}, failed ${failed}`);
if (failed > 0 && done === 0) process.exit(1);
