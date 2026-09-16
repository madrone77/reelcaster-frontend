import Link from 'next/link';
import HeroScoreCard from './hero-score-card';
import { btn } from '@/app/components/ui/button';
import TrialModalButton from '@/app/components/paywall/trial-modal-button';

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
            ReelCaster combines tides, weather, water conditions, and
            regulations into one simple score, so you know exactly when and
            where to fish.
          </p>
          {/* compact: full-width fills stacked, primary on top; medium+ they
              hug (per the button system). Three of them no longer fit the left
              column on one line at exactly lg — where the grid splits in two
              while the viewport is at its narrowest — so the row wraps and the
              labels stay whole instead of breaking mid-phrase. */}
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <TrialModalButton
              from="marketing-hero"
              data-testid="marketing-primary-cta"
              className={`${btn.primary} whitespace-nowrap`}
            >
              Start Free
            </TrialModalButton>
            {/* The free-account door. Every other CTA on this page — this
                row's primary, the header, and even the $0 MEMBER card in the
                pricing section — opens the trial modal, which sells Pro. An
                angler who only wants a Member account had no way in from the
                homepage; /signup has existed all along, unlinked. */}
            <Link
              href="/signup"
              data-testid="marketing-free-signup-cta"
              className={`${btn.secondary} whitespace-nowrap`}
            >
              Create free account
            </Link>
            <Link
              href="#how-it-works"
              className={`${btn.secondary} whitespace-nowrap`}
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
