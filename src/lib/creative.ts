/**
 * Shared vocabulary for generated imagery.
 *
 * Two routes render branded cards from spot data: the per-spot social card
 * (`opengraph-image.tsx`, landscape, scraped by Facebook and Twitter) and the
 * paid-ad creative (`api/ad-creative/[slug]`, portrait, uploaded to Ads
 * Manager). Their layouts are genuinely different and each owns its own, but
 * the palette and the text-fitting rules must not drift: an ad that names a
 * spot one way and a share card that names it another looks like two products.
 */

export const BRAND = '#1F40E0'
export const INK = '#F5F7FF'
export const MUTED = '#A8B4D8'
export const FOOT = '#7C8AB5'
export const CANVAS = '#0B1020'

/** Card-length species label, matching the card copy on the spot page. */
export function cardSpeciesName(name: string): string {
  return name.replace(/\s+Salmon$/i, '')
}

/**
 * Long names have to shrink or they wrap into the species row. Measured against
 * the real roster: "Colburne Passage (Moresby Island)" is about the worst case,
 * and Seattle contributes "Hat Island (Gedney Island) South End".
 *
 * `base` is the size a short name gets; the two steps down are proportional, so
 * one rule serves both the 1200x630 card and the taller ad creative.
 */
export function nameSize(name: string, base: number): number {
  if (name.length > 34) return Math.round(base * 0.67)
  if (name.length > 22) return Math.round(base * 0.84)
  return base
}
