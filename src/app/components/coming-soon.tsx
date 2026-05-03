import Image from 'next/image'

export default function ComingSoon() {
  return (
    <main className="fixed inset-0 overflow-hidden bg-black">
      <Image
        src="/coming-soon-hero.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center opacity-70"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

      <div className="relative z-10 flex h-full flex-col items-center justify-end px-6 pb-[12vh] text-center">
        <Image
          src="/reelcaster-logo.png"
          alt="ReelCaster"
          width={765}
          height={395}
          priority
          className="w-full max-w-xs sm:max-w-sm md:max-w-md"
        />
        <p className="mt-6 text-lg sm:text-xl font-light tracking-[0.3em] uppercase text-white/90">
          Coming Soon
        </p>
      </div>
    </main>
  )
}
