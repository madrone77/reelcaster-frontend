import { Montserrat } from 'next/font/google'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '800'],
  display: 'swap',
})

function Wordmark() {
  return (
    <div
      role="img"
      aria-label="ReelCaster"
      className={`${montserrat.className} border-[3px] border-white/95 px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 select-none`}
    >
      <div className="font-extrabold text-white leading-[0.85] tracking-tight text-6xl sm:text-7xl md:text-8xl">
        REEL
      </div>
      <div className="mt-2 sm:mt-3 text-[0.65rem] sm:text-xs md:text-sm font-light text-white tracking-[0.55em] uppercase text-center">
        Caster
      </div>
    </div>
  )
}

export default function ComingSoon() {
  return (
    <main
      className="fixed inset-0 flex flex-col items-center justify-center gap-8 px-6 text-center"
      style={{ backgroundColor: '#1F40E0' }}
    >
      <Wordmark />
      <p
        className={`${montserrat.className} text-lg sm:text-xl font-light tracking-[0.3em] uppercase text-white/90`}
      >
        Fishing Intelligence. Coming Soon.
      </p>
    </main>
  )
}
