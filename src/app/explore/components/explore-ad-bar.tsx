"use client";

import { PRICE } from "@/app/lp/_shared/lp-content";
import type { CampaignTarget } from "@/app/lp/_shared/lp-telemetry";
import { useAdCheckout } from "@/app/components/paywall/use-ad-checkout";
import type { AdWall } from "@/lib/ad-mode";

/**
 * The card ask on the ad-framed map.
 *
 * A bar rather than a card, because the map is the product and covering it
 * with a panel argues against the ad that just promised it. It is pinned to
 * the bottom and the map's box is shortened by exactly its height, so it never
 * overlays water and never has to be dismissed.
 *
 * It also carries the mark. The frame drops the top bar entirely — on a phone
 * that bar was 64px of logo and one avatar over a surface with about 500px to
 * give, and everything in it was a way off a page that cost money to land on —
 * so the brand rides here, in the one piece of chrome the page keeps.
 *
 * ANCHOR_ID is what every locked thing on the map points at instead of opening
 * a modal: a locked forecast day, a locked strip row. One offer, one place it
 * lives, one `from` in the conversion row.
 */

export const ANCHOR_ID = "explore-ad-offer";

/**
 * What the wall is holding back, in two lengths.
 *
 * A phone gives this line about forty characters before it collides with the
 * button, and a sentence cut off mid-word reads as a broken page rather than a
 * long one. So the short form is a whole thought at phone width and the long
 * one is what a desktop bar has room to say, instead of one string truncated
 * with CSS.
 */
function pitchFor(
  wall: AdWall,
  cityName: string | null,
): { short: string; full: string } {
  const where = cityName ?? "here";
  // The long forms used to open by saying which days were free, and on this
  // surface that clause is redundant: the day strip directly above the bar is
  // already showing the reader exactly which cells are open and which are
  // locked. It also cost the sentence its ending — at 1440 the line truncated
  // at "SEE ALL 14 DAYS AT EVER…", which is the offer itself getting cut.
  // What is left is the offer, which fits.
  if (wall === "today") {
    return {
      short: "Today is free",
      full: `See all 14 days at every spot in ${where}.`,
    };
  }
  if (wall === "day2") {
    return {
      short: "Two days free",
      full: `See all 14 days at every spot in ${where}.`,
    };
  }
  return {
    short: "Get a text when it turns on",
    full: `Get a text when a spot in ${where} comes good.`,
  };
}

export default function ExploreAdBar({
  wall,
  region,
  chargeDate,
  cityName,
  dims,
}: {
  wall: AdWall;
  /** Billing region, e.g. "WA" — decides the currency. */
  region: string;
  /** Server-rendered charge date. Reading a clock in a client render is what
   *  turns a date into a hydration mismatch. */
  chargeDate: string;
  /** The city the map opened on, for the one line of copy. */
  cityName: string | null;
  dims: CampaignTarget;
}) {
  const { email, setEmail, submitting, error, submit, from } = useAdCheckout({
    wall,
    region,
    cta: "sticky",
    dims,
  });

  const pitch = pitchFor(wall, cityName);

  return (
    <div
      id={ANCHOR_ID}
      /* Tells the app's bottom-pinned things (the map sheet, the filter sheet,
         the location menu) how much room this takes, through the same variable
         the mobile tab bar uses. Without it the bar sits on top of the spot
         sheet, which is the first thing a phone visitor drags. */
      data-ad-bar
      className="fixed inset-x-0 bottom-0 z-50 border-t border-rc-rule bg-rc-panel/97 backdrop-blur"
    >
      {/*
        A grid on lg, not a flex row, and that is a bug fix rather than taste.
        Three flex children were competing for one line with the pitch marked
        shrink-0, so the pitch took 614px whatever the window was and the form
        got the remainder: at 1440 the email field was 130px, and at 1024 it
        was TWENTY-SIX. The bar was unusable across a whole band of laptop
        widths, and nothing about it looked broken enough to notice.

        Fixed columns for the two that have a job to do — the form and the
        disclosure — and the flexible one goes to the pitch, which is the only
        piece that can lose words without losing meaning. Below lg it is the
        same three stacked rows it always was.
      */}
      <div className="mx-auto flex h-[var(--rc-ad-bar-h)] max-w-[1200px] flex-col justify-center gap-2 px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem_17rem] lg:items-center lg:gap-4 lg:pb-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="rc-title-lg text-[15px] tracking-tight text-rc-ink">
            ReelCaster
          </span>
          <span className="truncate font-rc-mono text-[10px] uppercase tracking-[0.08em] text-rc-ink-mute">
              {/* The long form needs about 290px and the pitch column only has
                that from xl. Below it the short form says the same thing in
                three words rather than the long one arriving with its ending
                cut off. */}
            <span className="xl:hidden">{pitch.short}</span>
            <span className="hidden xl:inline">{pitch.full}</span>
          </span>
        </div>

        <form className="flex min-w-0 flex-1 items-center gap-2" onSubmit={submit}>
          <label className="sr-only" htmlFor="explore-ad-email">
            Your email
          </label>
          <input
            id="explore-ad-email"
            /* A floor as well as a share: a field narrower than its own
               placeholder tells the reader nothing about what goes in it. */
            className="min-w-[9rem] flex-1 rounded border border-rc-rule bg-rc-panel px-3 py-2 text-[14px] text-rc-ink placeholder:text-rc-ink-mute focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
          <button
            type="submit"
            disabled={submitting}
            className="shrink-0 rounded bg-rc-brand px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-rc-brand/90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
          >
            {submitting ? "Starting…" : `Start ${PRICE.trialDays}-day trial`}
          </button>
        </form>

        {/* The disclosure. A card-required trial that auto-charges has to state
            the amount, the date and how to cancel before the customer
            consents, and "clear and conspicuous" means beside the button they
            are pressing. In a bar this tight that is the line directly under
            it, which is why the phone layout is three rows rather than one. */}
        <p className="font-rc-mono text-[10px] leading-tight text-rc-ink-mute">
          {error ? (
            <span className="text-rc-poor-ink" role="alert">
              {error}{" "}
              <a className="underline" href={`/plans/checkout?from=${from}`}>
                Use the checkout page instead.
              </a>
            </span>
          ) : (
            <>
              Free until <strong className="text-rc-ink-soft">{chargeDate}</strong>, then{" "}
              <strong className="text-rc-ink-soft">{PRICE.year}</strong> until you cancel.
              Cancel any time before then and pay nothing.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
