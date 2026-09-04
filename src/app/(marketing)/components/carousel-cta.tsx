'use client';

import { trackEvent } from '@/lib/analytics';

/**
 * The carousel is a server component, so its CTAs cannot carry an onClick of
 * their own. This wraps each one in a display:contents span that hears the
 * click on the way up, which leaves layout and the CTA itself untouched.
 */
export default function CarouselCta({
  slide,
  children,
}: {
  slide: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="contents"
      onClick={() => trackEvent('Carousel CTA Clicked', { slide })}
    >
      {children}
    </span>
  );
}
