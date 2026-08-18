/**
 * /lp/3 hero photography, per angle.
 *
 * ⚠️ Do NOT reuse the hero URLs seeded onto city_pages by
 * bluecaster/scripts/seed-demo-content.ts. Both were checked while building
 * this page and neither matches its own alt text: the "coastal harbour near
 * Victoria" photo is Big Ben in London, and the "forested coastline near
 * Vancouver" photo is a wheat field at sunset. They are wrong on the live city
 * pages too — worth fixing there separately.
 *
 * DEFAULT below was checked by eye at the size it renders: a downrigger and a
 * loaded rod silhouetted against first light over saltwater, with a headland on
 * the horizon. It reads as BC salmon trolling rather than as generic scenery,
 * and the dark foreground is what lets the white headline sit on it. Two other
 * candidates were rejected — a lake boat (wrong water) and a dawn fjord whose
 * circular net pens are open-net salmon farms, which is not an image to put in
 * front of BC sport anglers.
 *
 * Unsplash's licence covers commercial use with no attribution required. Even
 * so, a real photo of a customer's fish will almost certainly beat stock on a
 * cold audience, and a local file under /public beats a remote fetch on LCP —
 * which matters on a page whose whole job is surviving the first two seconds.
 * Swapping is one line per angle.
 *
 * `images.unsplash.com` is already allowed in next.config.ts remotePatterns.
 */

export interface Hero {
  url: string;
  /** Describes the photo for screen readers; never repeats the headline. */
  alt: string;
}

/** Downrigger and loaded rod against first light over open saltwater. */
const DEFAULT: Hero = {
  url: "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?w=1200&q=80&auto=format&fit=crop",
  alt: "A downrigger and a loaded fishing rod silhouetted against sunrise over open water",
};

/**
 * Angle id → hero photo. Anything unmapped falls back to DEFAULT, so adding an
 * angle in lp-angles.ts can never leave /lp/3 with an empty hero.
 *
 * Every angle currently points at the same verified photo. That is deliberate:
 * one image checked properly beats four picked on a filename. Give an angle its
 * own photo here when you have one worth testing — the loss-framing angle
 * ("burning Saturdays") in particular wants flat water and no fish, which is
 * the opposite of what this image shows.
 */
const BY_ANGLE: Record<string, Hero> = {
  window: DEFAULT,
  wasted: DEFAULT,
  local: DEFAULT,
  alerts: DEFAULT,
};

export function heroFor(angleId: string): Hero {
  return BY_ANGLE[angleId] ?? DEFAULT;
}
