/**
 * How many spots the marketing map's card walks through, and how long it holds
 * on each. Slow enough to read the card, quick enough to feel alive.
 *
 * Kept out of marketing-map.tsx because that is a client module: a server
 * component importing a constant from it gets a client reference, not the
 * number. ad-reel.tsx (a server component) sizes the walk and the map
 * screen's hold from these.
 */
export const FEATURED_COUNT = 5;
export const ROTATE_MS = 4200;
