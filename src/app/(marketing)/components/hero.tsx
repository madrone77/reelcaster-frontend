import Link from 'next/link';
import HeroScoreCard from './hero-score-card';

export default function Hero() {
  return (
    <section data-testid="homepage-hero" className="bg-rc-band">
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-16 md:pt-20 md:pb-24 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <h1
            data-testid="marketing-hero-headline"
            className="text-5xl md:text-6xl font-black tracking-[-0.03em] leading-[1.04]"
          >
            <span className="block text-rc-ink">Know the bite.</span>
            <span className="block text-rc-brand">Before you go.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg md:text-xl leading-relaxed text-rc-ink-mute">
            Reelcaster combines tides, weather, water conditions, and
            regulations into one simple score, so you know exactly when and
            where to fish.
          </p>
          {/* compact: two full-width fills stacked, primary on top; medium+
              they hug (per the button system). */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              data-testid="marketing-primary-cta"
              className="inline-flex min-h-11 w-full min-w-20 items-center justify-center rounded bg-rc-brand px-5 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-rc-brand-hover sm:w-auto"
            >
              Start Free
            </Link>
            <Link
              href="#how-it-works"
              className="inline-flex min-h-11 w-full min-w-20 items-center justify-center rounded border border-rc-brand bg-rc-panel px-5 py-3 text-sm font-bold uppercase tracking-wide text-rc-brand transition-colors hover:bg-rc-brand-soft sm:w-auto"
            >
              How It Works
            </Link>
          </div>
        </div>

        <HeroScoreCard />
      </div>
    </section>
  );
}
