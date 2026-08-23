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

/**
 * The custom event fired when a Pro trial starts.
 *
 * The name is the whole contract with the dashboard: Plausible matches a goal
 * to an event by exact string, case included, so a rename here is a rename in
 * Site Settings → Goals or the goal quietly stops counting. Events keep
 * arriving either way; an unmatched one just has nowhere to show up.
 */
export const PLAUSIBLE_TRIAL_EVENT = 'Trial Start'

type PlausibleProps = Record<string, string | number | boolean>

type PlausibleFn = ((
  event: string,
  options?: { props?: PlausibleProps },
) => void) & { q?: unknown[]; l?: boolean }

declare global {
  interface Window {
    plausible?: PlausibleFn
  }
}

/**
 * Report a custom event.
 *
 * Installs the queueing stub if the tracker has not landed yet, rather than
 * dropping the call. `<Plausible>` loads `afterInteractive`, so on a slow
 * connection there is a window where `window.plausible` does not exist, and the
 * one event worth firing on the checkout return page is exactly the kind that
 * arrives during it. The loader drains `plausible.q` on arrival.
 *
 * Silently does nothing useful off the reporting hosts, where the loader never
 * mounts: the call queues and no request is ever made.
 */
export function plausibleTrack(event: string, props?: PlausibleProps): void {
  if (typeof window === 'undefined') return
  if (!window.plausible) {
    const stub: PlausibleFn = function (...args: unknown[]) {
      ;(stub.q = stub.q || []).push(args)
    } as unknown as PlausibleFn
    window.plausible = stub
  }
  window.plausible(event, props ? { props } : undefined)
}
