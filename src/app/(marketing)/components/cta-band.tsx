import Link from 'next/link';

export default function CtaBand() {
  return (
    <section data-testid="homepage-final-cta" className="bg-rc-brand">
      {/* Copy left, CTA right on desktop; stacks below md so the button never
          gets squeezed against the headline on narrow screens. */}
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20 flex flex-col gap-8 md:flex-row md:items-center md:justify-between md:gap-12">
        <div>
          <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-white">
            The next great fishing window is coming.
          </h2>
          <p className="mt-3 text-base text-white/80">
            Know when it happens before everyone else.
          </p>
        </div>
        {/* White on brand blue — the band is already the accent, so the CTA
            inverts rather than stacking a second blue on top of it. */}
        <Link
          href="/signup"
          className="shrink-0 self-start md:self-auto inline-flex items-center justify-center rounded bg-white px-8 py-3 text-sm font-bold text-rc-brand transition-colors hover:bg-white/90"
        >
          Start free trial
        </Link>
      </div>
    </section>
  );
}
