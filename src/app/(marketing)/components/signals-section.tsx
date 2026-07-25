import Image from 'next/image';
import Link from 'next/link';
import { btn } from '@/app/components/ui/button';

export default function SignalsSection() {
  return (
    <section
      id="how-it-works"
      data-testid="homepage-how-it-works"
      className="bg-rc-band scroll-mt-16"
    >
      <div className="max-w-6xl mx-auto grid gap-14 px-6 py-16 sm:grid-cols-2 sm:items-center sm:gap-8 lg:gap-14 lg:py-24">
        <div>
          <h2 className="text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[1.15]">
            <span className="block text-rc-ink">One number.</span>
            <span className="block text-rc-brand">Hundreds of signals.</span>
          </h2>
          <p className="mt-5 max-w-lg text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Reelcaster analyzes tides, current, weather, pressure, water
            conditions, and seasonal regulations to generate a daily score{' '}
            <span className="whitespace-nowrap">from 0 to 100</span>.
          </p>
          <p className="mt-3 max-w-lg text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
            The higher the score, the better your opportunity.
          </p>
          <Link href="/signup" className={`mt-9 ${btn.primaryLarge}`}>
            Start Free
          </Link>
        </div>

        <div className="flex justify-center">
          {/* Fluid illustration — fills the column up to 330px, so it stays
              beside the text through the whole medium range without a 3rd
              breakpoint (grid column narrows; the art scales with it). */}
          <div className="flex w-full max-w-[330px] flex-col items-center">
            <Image
              src="/landing/score-pin.svg"
              alt=""
              width={90}
              height={126}
              className="relative z-10 -mb-9 w-[80px] sm:w-[90px] h-auto"
            />
            <Image
              src="/landing/signal-stack.svg"
              alt="Layers of tide, weather, water, and regulation data feeding one Reelcaster score"
              width={327}
              height={331}
              className="w-full h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
