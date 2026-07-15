import Image from 'next/image';
import Link from 'next/link';

export default function SignalsSection() {
  return (
    <section
      id="how-it-works"
      data-testid="homepage-how-it-works"
      className="bg-rc-band scroll-mt-16"
    >
      <div className="max-w-6xl mx-auto grid gap-14 px-6 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] text-rc-ink">
            One number. <span className="text-rc-brand">Hundreds of signals.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Reelcaster analyzes tides, current, weather, pressure, water
            conditions, and seasonal regulations to generate a daily score from
            0 to 100.
          </p>
          <p className="mt-3 max-w-lg text-sm md:text-base leading-relaxed text-rc-ink-soft">
            The higher the score, the better your opportunity.
          </p>
          <Link
            href="/signup"
            className="mt-9 inline-flex w-full max-w-md items-center justify-center rounded bg-rc-brand px-8 py-3 text-sm font-bold tracking-wide text-white transition-colors hover:bg-rc-brand-hover"
          >
            START FREE
          </Link>
        </div>

        <div className="flex justify-center">
          <div className="flex flex-col items-center">
            <Image
              src="/landing/score-pin.svg"
              alt=""
              width={90}
              height={126}
              className="relative z-10 -mb-9"
            />
            <Image
              src="/landing/signal-stack.svg"
              alt="Layers of tide, weather, water, and regulation data feeding one Reelcaster score"
              width={327}
              height={331}
              className="w-[280px] sm:w-[330px] h-auto"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
