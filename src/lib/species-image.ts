// Per-species illustrations, keyed by the BlueCaster species slug.
//
// The plates are naturalistic colour illustrations on transparent ground, one
// per species we score. They are NOT the navy engravings in
// `public/marketing/species/*-engraving-navy-v2.webp`, which the ?ad= hero
// matches by display name; these are keyed by slug, which every species
// payload already carries (`LiveSpecies.slug`, `BlueCasterGuideLink.species_slug`,
// `HubSpecies.slug`, the guide payload's `species.slug`).
//
// Every plate is 800px wide; heights differ because each fish was cropped to
// its own body. `next/image` needs the intrinsic pair, so the heights are
// recorded here rather than guessed, and a species with no plate returns null
// so the caller can render its text-only shape unchanged.

/** slug → [width, height] of the file in `public/marketing/species/illustrations`. */
const ILLUSTRATIONS: Record<string, [number, number]> = {
  "albacore-tuna": [800, 287],
  "barred-sand-bass": [800, 376],
  "black-rockfish": [800, 415],
  "blue-rockfish": [800, 423],
  "bocaccio": [800, 340],
  "cabezon": [800, 354],
  "california-barracuda": [800, 229],
  "california-halibut": [800, 333],
  "california-scorpionfish": [800, 396],
  "california-sheephead": [800, 406],
  "canary-rockfish": [800, 416],
  "chinook-salmon": [800, 308],
  "chum-salmon": [800, 323],
  "coho-salmon": [800, 310],
  "copper-rockfish": [800, 390],
  "cowcod": [800, 426],
  "dorado": [800, 362],
  "dungeness-crab": [800, 415],
  "kelp-bass": [800, 383],
  "kelp-greenling": [800, 367],
  "leopard-shark": [800, 291],
  "lingcod": [800, 277],
  "mackerel": [800, 307],
  "nearshore-rockfish": [800, 404],
  "ocean-whitefish": [800, 330],
  "pacific-bluefin-tuna": [800, 308],
  "pacific-bonito": [800, 319],
  "pacific-cod": [800, 327],
  "pacific-halibut": [800, 402],
  "pacific-sardine": [800, 293],
  "pink-salmon": [800, 317],
  "quillback-rockfish": [800, 450],
  "rockfish-aggregate": [800, 399],
  "sablefish": [800, 285],
  "sculpin": [800, 350],
  "shelf-rockfish": [800, 449],
  "shiner-perch": [800, 438],
  "shrimp-including-prawn": [800, 327],
  "skipjack-tuna": [800, 324],
  "slope-rockfish": [800, 435],
  "spot-prawn": [800, 313],
  "striped-bass": [800, 321],
  "striped-marlin": [800, 296],
  "surfperch": [800, 423],
  "swordfish": [800, 265],
  "thresher-shark": [800, 258],
  "vermilion-rockfish": [800, 425],
  "wahoo": [800, 197],
  "white-seabass": [800, 305],
  "yellowfin-tuna": [800, 331],
  "yellowtail": [800, 283],
};

export type SpeciesIllustration = {
  src: string;
  width: number;
  height: number;
};

/**
 * The plate for a species slug, or null when we have no art for it.
 *
 * Callers pass the slug straight from their payload. Nothing falls back to a
 * generic fish: a wrong species drawn confidently is worse than none.
 */
export function speciesIllustration(slug: string | null | undefined): SpeciesIllustration | null {
  if (!slug) return null;
  const size = ILLUSTRATIONS[slug];
  if (!size) return null;
  return {
    src: `/marketing/species/illustrations/${slug}.webp`,
    width: size[0],
    height: size[1],
  };
}

/** Every slug we hold a plate for. Useful in tests and coverage checks. */
export function illustratedSpeciesSlugs(): string[] {
  return Object.keys(ILLUSTRATIONS);
}
