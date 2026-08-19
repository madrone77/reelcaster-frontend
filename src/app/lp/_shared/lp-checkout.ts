import type { LpCard } from "./lp-spot";

/**
 * The checkout link a landing page hands to its CTA.
 *
 * Carries the region, which is not cosmetic: /api/stripe/checkout prices the
 * session with currencyForRegion(), where BC bills in CAD and WA bills in USD.
 * The landing pages used to send `from` alone, leaving the checkout page to
 * infer the region from Vercel geo and falling back to BC, and therefore to
 * Canadian dollars, whenever that inference came up empty.
 *
 * On the American variant that is a real defect rather than a rough edge: a
 * page with a US flag, WDFW regulations and a price anchored in gallons could
 * still open a checkout billed in CAD for anyone whose geo did not resolve.
 * Sending the region we already know removes the guess.
 *
 * The region comes from the card's own spot, which is the same value that
 * decides the regulator and the units elsewhere on the page, so the price and
 * the copy can never disagree about which country the reader is in.
 *
 * `from` stays the attribution key (`lp6-window` and so on) that lands in the
 * conversion columns, so this does not disturb which pitch gets the credit.
 */
export function lpCheckoutHref(variant: string, angleId: string, card: LpCard): string {
  const params = new URLSearchParams({ from: `lp${variant}-${angleId}` });
  // Only send a region we actually resolved. An empty value would be worse
  // than none: the route trims and falls through to the same geo path, but a
  // stray `region=` in the URL reads as a deliberate choice when reviewing an
  // ad link.
  if (card.provinceCode) params.set("region", card.provinceCode);
  return `/plans/checkout?${params.toString()}`;
}

/**
 * The date the first charge lands, rendered on the server.
 *
 * Computed here rather than in the form because the form is a client
 * component: reading a clock during a client render is what makes a date a
 * hydration mismatch. These pages render per request (they read searchParams
 * for the angle), so this is never served stale.
 *
 * en-CA with an explicit Pacific timezone, because every covered city is on
 * Pacific time and the alternative is a date that flips at the server's
 * midnight rather than the customer's.
 */
export function trialChargeDate(trialDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + trialDays);
  return d.toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    timeZone: "America/Vancouver",
  });
}
