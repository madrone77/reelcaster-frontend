import Link from 'next/link';
import HeroScoreCard from './hero-score-card';
import { btn } from '@/app/components/ui/button';

export default function Hero() {
  return (
    <section data-testid="homepage-hero" className="bg-rc-band">
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-16 md:pt-20 md:pb-24 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <h1
            data-testid="marketing-hero-headline"
            className="text-balance text-5xl md:text-6xl font-black tracking-[-0.03em] leading-[1.04]"
          >
            <span className="block text-rc-ink">Know the bite.</span>
            <span className="block text-rc-brand">Before you go.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg md:text-xl leading-relaxed text-rc-ink-mute">
            Reelcaster combines tides, weather, water conditions, and
            regulations into one simple score, so you know exactly when and
            where to fish.
          </p>
          {/* compact: two full-width fills stacked, primary on top; medium+
              they hug (per the button system). */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" data-testid="marketing-primary-cta" className={btn.primary}>
              Start Free
            </Link>
            <Link href="#how-it-works" className={btn.secondary}>
              How It Works
            </Link>
          </div>
        </div>

        <HeroScoreCard />
      </div>
    </section>
  );
}
