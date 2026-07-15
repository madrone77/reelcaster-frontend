import Image from 'next/image';
import Link from 'next/link';

export default function MapSection() {
  return (
    <section className="border-t border-rc-rule/60 bg-rc-page">
      <div className="max-w-6xl mx-auto grid gap-14 px-6 py-16 md:py-24 lg:grid-cols-2 lg:items-center">
        <div className="order-2 lg:order-1">
          <Image
            src="/landing/chart-illustration.svg"
            alt="Nautical chart with depth contours and scored fishing spots"
            width={620}
            height={300}
            className="h-auto w-full rounded-md border border-rc-rule/60 shadow-rc-bar"
          />
        </div>

        <div className="order-1 lg:order-2">
          <h2 className="text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[1.15]">
            <span className="block text-rc-ink">Every reef, bank and ledge.</span>
            <span className="block text-rc-brand">Mapped.</span>
          </h2>
          <p className="mt-5 max-w-lg text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Discover productive fishing structure, save your favorite spots,
            and explore waters with confidence.
          </p>
          <p className="mt-3 max-w-lg text-sm md:text-base leading-relaxed text-rc-ink-soft">
            Whether you&apos;re chasing salmon, halibut, or lingcod, you&apos;ll
            always know where to start.
          </p>
          <Link
            href="/explore"
            className="mt-9 inline-flex items-center justify-center rounded-md bg-rc-brand px-8 py-3 text-sm font-bold text-white transition-colors hover:bg-rc-brand-hover"
          >
            Explore the map
          </Link>
        </div>
      </div>
    </section>
  );
}
