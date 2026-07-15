/**
 * Client-side photo preparation for the catch wizard.
 *
 * Three jobs, in order:
 *  1. Read EXIF (GPS, capture time, camera) from the ORIGINAL file — HEIC
 *     conversion and downscaling both strip EXIF, so this must run first.
 *  2. Convert HEIC/HEIF to JPEG (Claude vision can't read HEIC; without
 *     this iPhone photos silently lose species detection).
 *  3. Downscale the ANALYSIS copy to ≤2048px / high-compression JPEG —
 *     Anthropic's vision API rejects images over ~5 MB, while the upload
 *     bucket takes up to 25 MB. The original (or converted JPEG) is what
 *     gets stored; the small copy is what gets analyzed.
 *
 * Browser-only (dynamic imports keep heic2any out of the server bundle).
 */

export interface PreparedPhoto {
  /** Full-quality file for the catch-photos bucket (JPEG if HEIC-converted). */
  uploadFile: File
  /** Downscaled JPEG for the BlueCaster vision preview. */
  analysisFile: File
  /** EXIF read from the original, or null when absent (e.g. screenshots). */
  exif: {
    capturedAtNaive: string | null // "YYYY-MM-DDTHH:mm:ss" wall-clock
    lat: number | null
    lng: number | null
    camera: string | null
  } | null
  /** File mtime as a naive local wall-clock string (weakest time fallback). */
  fileLastModNaive: string | null
  /** Browser tz offset (new Date().getTimezoneOffset()) — minutes to ADD to
   *  naive local time to get UTC. */
  tzOffsetMinutes: number
}

const HEIC_TYPES = new Set(['image/heic', 'image/heif'])
const ANALYSIS_MAX_DIMENSION = 2048
const ANALYSIS_MAX_MB = 3

function isHeic(file: File): boolean {
  if (HEIC_TYPES.has(file.type)) return true
  return /\.hei[cf]$/i.test(file.name || '')
}

function toNaiveLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

async function readExif(file: File): Promise<PreparedPhoto['exif']> {
  try {
    const exifr = (await import('exifr')).default
    const raw = (await exifr.parse(file, true)) as Record<string, unknown> | null
    if (!raw) return null
    const capturedRaw =
      (raw.DateTimeOriginal as Date | string | undefined) ??
      (raw.CreateDate as Date | string | undefined) ??
      (raw.ModifyDate as Date | string | undefined)
    const captured =
      capturedRaw instanceof Date
        ? capturedRaw
        : capturedRaw
          ? new Date(capturedRaw)
          : null
    const make = typeof raw.Make === 'string' ? raw.Make : null
    const model = typeof raw.Model === 'string' ? raw.Model : null
    const exif = {
      capturedAtNaive:
        captured && Number.isFinite(captured.getTime()) ? toNaiveLocal(captured) : null,
      lat: typeof raw.latitude === 'number' ? raw.latitude : null,
      lng: typeof raw.longitude === 'number' ? raw.longitude : null,
      camera: [make, model].filter(Boolean).join(' ') || null,
    }
    return exif.capturedAtNaive || exif.lat !== null || exif.camera ? exif : null
  } catch {
    return null
  }
}

async function heicToJpeg(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default
  const blob = (await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  })) as Blob
  const name = (file.name || 'photo').replace(/\.hei[cf]$/i, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}

async function downscaleForAnalysis(file: File): Promise<File> {
  // Already small enough — skip the canvas round-trip.
  if (file.size <= ANALYSIS_MAX_MB * 1024 * 1024 && file.type === 'image/jpeg') {
    return file
  }
  try {
    const imageCompression = (await import('browser-image-compression')).default
    const compressed = await imageCompression(file, {
      maxSizeMB: ANALYSIS_MAX_MB,
      maxWidthOrHeight: ANALYSIS_MAX_DIMENSION,
      fileType: 'image/jpeg',
      useWebWorker: true,
      // EXIF is intentionally NOT preserved here — the analysis copy's
      // metadata is advisory only; the server gets client-extracted EXIF
      // fields alongside.
    })
    const name = (file.name || 'photo').replace(/\.[a-z0-9]+$/i, '') + '.jpg'
    return new File([compressed], name, { type: 'image/jpeg' })
  } catch {
    // Compression failed — send the original and let the server soft-fail
    // vision if it's too large.
    return file
  }
}

export async function preparePhotoForAnalysis(file: File): Promise<PreparedPhoto> {
  // 1. EXIF from the original, before any conversion strips it.
  const exif = await readExif(file)

  // 2. HEIC → JPEG for both storage-display friendliness and vision.
  const uploadFile = isHeic(file) ? await heicToJpeg(file) : file

  // 3. Small analysis copy.
  const analysisFile = await downscaleForAnalysis(uploadFile)

  return {
    uploadFile,
    analysisFile,
    exif,
    fileLastModNaive: file.lastModified ? toNaiveLocal(new Date(file.lastModified)) : null,
    tzOffsetMinutes: new Date().getTimezoneOffset(),
  }
}
