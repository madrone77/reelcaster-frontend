'use client';

import { cityName } from '@/lib/city-name';
import { useHomeCityState } from '@/app/explore/lib/use-home-city';

/**
 * The brand row at the top of a paywall sheet: the round R mark and the word
 * ReelCaster, drawn at the size Stripe Checkout's mobile header draws them
 * (a 28px circle, 16px medium text, 8px apart). The reader taps a buy button
 * under this and lands on that page a moment later, so the sheet wears the
 * same header and the checkout reads as the next screen of the same thing
 * rather than a different site.
 *
 * AND THEN THE CITY: "ReelCaster Tacoma". The sheet is the first screen in
 * the product that asks for money, and the question under a reader's thumb at
 * that moment is whether this thing is about the water they actually fish.
 * The city they are looking at, in the header, answers it before the offer
 * does. Casey's call (2026-09-10). It is set beside the wordmark in the soft
 * ink rather than in it: the brand is still the brand, the city is where it
 * is being read.
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
export default function BrandHeader({ city }: { city?: string | null }) {
  const place = useBrandCity(city);

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
      <span className="min-w-0 truncate text-[16px] leading-none font-medium text-rc-ink">
        ReelCaster
        {place ? <span className="text-rc-ink-soft"> {place}</span> : null}
      </span>
    </div>
  );
}

/**
 * Which city the header names, in the order the answer gets less certain.
 *
 * 1. The one the caller is showing. A wall fires over a spot, a map camera or
 *    a city page, and that place is what the reader was just looking at.
 * 2. The home city they have stated, read from localStorage through the same
 *    hook the rest of the app uses. This covers the walls that carry no place
 *    of their own, the join prompt's chooser among them.
 *
 * The IP-guessed tier of `useEffectiveHomeCity` is deliberately NOT here. It
 * costs a request, and this component renders at the one moment in the
 * product where a header that changes under the reader's thumb is worst. Both
 * sources above are already in hand when the sheet opens.
 */
function useBrandCity(explicit?: string | null): string | null {
  // Stated only, and no hydrate: the local read is synchronous-ish and free,
  // and a server round trip here would land after the sheet has been read.
  const { slug } = useHomeCityState();
  const named = trimCity(explicit);
  if (named) return named;
  return slug ? trimCity(cityName(slug)) : null;
}

/**
 * Just the city. Place names arrive as `place.name` from the map payload,
 * which is usually bare ("Tacoma") but is allowed a qualifier, and a header
 * this size has room for one word and not for "Tacoma, Washington".
 */
function trimCity(value: string | null | undefined): string | null {
  const first = value?.split(',')[0]?.trim();
  return first ? first : null;
}
