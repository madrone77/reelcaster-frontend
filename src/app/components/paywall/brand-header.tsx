'use client';

/**
 * The brand row at the top of a paywall sheet: the round R mark and the word
 * ReelCaster, drawn at the size Stripe Checkout's mobile header draws them
 * (a 28px circle, 16px medium text, 8px apart). The reader taps a buy button
 * under this and lands on that page a moment later, so the sheet wears the
 * same header and the checkout reads as the next screen of the same thing
 * rather than a different site.
 *
 * No back arrow. Stripe's arrow returns to us; on a sheet the way back is the
 * X and the swipe, and a second control for the same thing at the same size
 * as the brand would only pull the eye off it.
 *
 * The mark is the app icon's R on a circle instead of a rounded square,
 * because a circle is the shape Stripe cuts our uploaded icon to.
 *
 * Lifted out of ./trial-sheet-stripe when the plan chooser needed the same
 * row: the two screens are consecutive steps of one flow, and a header that
 * drifted between them would be the most visible place for it to show.
 */
export default function BrandHeader() {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-rc-brand"
      >
        <svg viewBox="0 0 512 512" className="size-7" fill="#fff">
          <path
            fillRule="evenodd"
            d="M121 106h180q45 0 65.357 20.357t20.357 65.357v38.572q0 35.571-11.786 55.285-11.786 19.715-37.5 26.143L391 406h-83.571l-49.286-90h-60v90H121ZM309.571 191.714q0-25.714-25.714-25.714h-85.714v90h85.714q25.714 0 25.714-25.714Z"
          />
        </svg>
      </span>
      <span className="text-[16px] leading-none font-medium text-rc-ink">
        ReelCaster
      </span>
    </div>
  );
}
