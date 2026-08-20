/**
 * Hero photography for the photo-led variants (/lp/3 and /lp/5), per angle.
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
  /**
   * Same photograph, same crop, more pixels — for the desktop layout, whose
   * photo column is roughly twice the phone one. Next's optimizer can only
   * shrink what the remote URL gives it, so a source cut for a 375px column
   * comes out soft on a 560px one at 2x. Identical crop and focal-point
   * parameters, because a second URL is a second chance to reframe the picture
   * by accident. Optional: falls back to `url`.
   */
  urlWide?: string;
  /** Describes the photo for screen readers; never repeats the headline. */
  alt: string;
}

/** Downrigger and loaded rod against first light over open saltwater. */
const DEFAULT: Hero = {
  url: "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?w=1200&q=80&auto=format&fit=crop",
  urlWide:
    "https://images.unsplash.com/photo-1541742425281-c1d3fc8aff96?w=1800&q=80&auto=format&fit=crop",
  alt: "A downrigger and a loaded fishing rod silhouetted against sunrise over open water",
};

/**
 * Puget Sound: Mount Rainier catching the last light over a marina full of
 * boats, water across the foreground.
 *
 * Used only by the American variant. A Rainier photo over a Victoria headline
 * would be the same defect as the DFO line on a Seattle page, pointed the
 * other way, which is why this is keyed on market rather than swapped into
 * DEFAULT.
 *
 * Checked by eye at the crop it actually renders (w=1200&h=800), not picked
 * off a search title. That matters here: the city_pages heroes seeded by
 * bluecaster/scripts/seed-demo-content.ts are captioned "coastal harbour near
 * Victoria" over a photo of Big Ben, and "forested coastline near Vancouver"
 * over a wheat field. A caption is not evidence.
 *
 * Rainier is what makes this verifiable. A fishing photo with no landmark
 * cannot be confirmed as Puget Sound at all, so an unmarked boat-and-sunrise
 * shot could only ever be *claimed* local. The mountain is the proof.
 *
 * The exact marina is not named in the alt text on purpose. Rainier fixes the
 * photo to Washington beyond argument; the specific basin does not read with
 * certainty at this size, and a wrong marina named in an alt attribute is the
 * kind of small false detail this audience notices.
 *
 * The crop is near-square with an explicit focal point rather than the usual
 * centred landscape one. The hero box is portrait on a phone (375 wide by a
 * clamped 300-440 tall) and object-fit: cover crops the SIDES, so a 3:2 source
 * loses its outer thirds. Rainier sits right of centre in this frame, which
 * put it exactly in the discarded strip: the first crop rendered a photo whose
 * entire subject had been cropped away. fp-x pulls the peak back into the part
 * that survives, and the marina fills the dark bottom band under the type.
 */
const PUGET_SOUND: Hero = {
  url: "https://images.unsplash.com/photo-1656906121782-915466b8f68f?w=900&h=1000&q=80&auto=format&fit=crop&crop=focalpoint&fp-x=0.72&fp-y=0.63",
  urlWide:
    "https://images.unsplash.com/photo-1656906121782-915466b8f68f?w=1440&h=1600&q=80&auto=format&fit=crop&crop=focalpoint&fp-x=0.72&fp-y=0.63",
  alt: "Mount Rainier catching the last light at dusk beyond a marina full of moored boats",
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

/**
 * The market a page is selling to. Only the American variant has its own
 * photography today; everything else takes the neutral saltwater shot, which
 * is true on either side of the border.
 */
export type HeroMarket = "default" | "us";

export function heroFor(angleId: string, market: HeroMarket = "default"): Hero {
  if (market === "us") return PUGET_SOUND;
  return BY_ANGLE[angleId] ?? DEFAULT;
}
