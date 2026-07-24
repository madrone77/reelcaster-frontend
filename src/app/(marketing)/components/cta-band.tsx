import Link from 'next/link';
import { btn } from '@/app/components/ui/button';

export default function CtaBand() {
  return (
    <section data-testid="homepage-final-cta" className="bg-rc-brand">
      {/* Copy left, CTA right from medium up; stacks on compact so the button
          never gets squeezed against the headline on narrow screens. */}
      <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-12">
        <div>
          <h2 className="text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] text-white">
            The next great fishing window is coming.
          </h2>
          <p className="mt-3 text-pretty text-base text-white/80">
            Know when it happens before everyone else.
          </p>
        </div>
        {/* White on brand blue — the band is already the accent, so the CTA
            inverts rather than stacking a second blue on top of it. */}
        <Link href="/signup" className={`shrink-0 ${btn.onBrand}`}>
          Start free trial
        </Link>
      </div>
    </section>
  );
}
