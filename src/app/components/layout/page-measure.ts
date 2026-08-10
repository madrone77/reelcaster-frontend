/**
 * The app's one content gridline.
 *
 * Every signed-in surface hangs its top bar *and its body* off this, so the
 * mark sits on the same left edge and the trial CTA / avatar on the same right
 * edge no matter which route you're on — chrome that doesn't move when you
 * navigate.
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

/**
 * A narrow reading column for form and detail bodies — settings, profile, a
 * single catch, the log-a-catch wizard.
 *
 * Nest it *inside* PAGE_MEASURE and leave it left-aligned (no `mx-auto`). That
 * last part is the whole point: a narrow column centred in the gridline lands
 * in exactly the same place as one centred in the viewport, so centring buys no
 * alignment at all — every page's first heading still starts at a different x
 * than the mark above it, and the bar reads as though it shifts when you move
 * between routes. Pinned left, the heading starts on the mark's edge on every
 * surface, and a page that needs a wider canvas for one step (the wizard's map
 * picker) grows to the right without moving anything you were already reading.
 *
 * Pages whose content genuinely fills the gridline — Explore's spot page, the
 * dashboard, Notifications — just use PAGE_MEASURE and skip this.
 */
export const READING_MEASURE = "max-w-3xl";
