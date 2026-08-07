/**
 * The app's one content gridline.
 *
 * Every signed-in surface hangs its top bar off this, so the mark sits on the
 * same left edge and the trial CTA / avatar on the same right edge no matter
 * which route you're on — chrome that doesn't move when you navigate. Pages
 * whose body is a narrow reading measure (the settings forms, a catch detail)
 * still centre that column inside this one; the gridline is what the *chrome*
 * aligns to, not a cap on how narrow content may be.
 *
 * `px-4 sm:px-6` rather than `lg:px-6` because that's what nearly every body
 * on the site already uses — matching it keeps the bar and the content on the
 * same padding through the tablet range instead of drifting 8px apart.
 *
 * Explore is the deliberate exception: it's a full-bleed map, and a centred row
 * would leave the mark floating over the middle of it. It passes BLEED_MEASURE.
 */
export const PAGE_MEASURE = "max-w-[1200px] mx-auto px-4 sm:px-6";

/** Edge-padded, no cap — for surfaces that genuinely run to the viewport. */
export const BLEED_MEASURE = "px-4 sm:px-6";
