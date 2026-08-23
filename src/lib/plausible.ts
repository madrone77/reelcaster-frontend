/**
 * Plausible, the privacy-friendly pageview counter.
 *
 * Sits alongside GA4, the Meta pixel, and the Google Ads tag rather than
 * replacing any of them: those three exist to feed ad bidding and conversion
 * reporting, and each one is shaped by that. Plausible answers the plain
 * question none of them answer cleanly, which is how many people read a page.
 *
 * The tracker file is per-site and its id is public: it ships in the page HTML
 * of every visit. So it is a constant here rather than an env var, matching
 * `src/lib/google-ads.ts` and `src/lib/adsense.ts`. A constant is reviewable in
 * the diff and travels with the code that renders it.
 *
 * Note what is NOT configured in this repo. The script has the site domain
 * (`reelcaster.com`) and the event endpoint baked into it at Plausible's end,
 * so the dashboard settings, not a code change, decide what it reports. That
 * also means the file name changes if the site is ever recreated in Plausible.
 */
export const PLAUSIBLE_SRC = 'https://plausible.io/js/pa-OrsqKLODABP7zwGw1EOxe.js'

/**
 * Hosts allowed to report.
 *
 * The domain is baked into the tracker, so an event fired from a preview
 * deployment is counted against reelcaster.com exactly like a customer visit.
 * Previews here talk to production data and get clicked through often, so left
 * open that is a steady drip of our own traffic in the numbers.
 *
 * The tracker already drops localhost on its own; this covers `*.vercel.app`.
 */
export function plausibleReports(hostname: string): boolean {
  return hostname === 'reelcaster.com' || hostname.endsWith('.reelcaster.com')
}
