import type { Metadata } from 'next'
import { Montserrat } from 'next/font/google'
import NotifyForm from './notify-form'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '800'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ReelCaster: Coming Soon',
  description: 'Fishing intelligence for British Columbia. Coming soon.',
  robots: { index: false, follow: false },
}

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

export default function ComingSoonPage() {
  return (
    <main
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 px-6 pb-20 text-center lg:pb-0"
      style={{ backgroundColor: '#1F40E0' }}
    >
      <Wordmark />
      <p
        className={`${montserrat.className} text-lg sm:text-xl font-light tracking-[0.3em] uppercase text-white/90`}
      >
        Fishing Intelligence. Coming Soon.
      </p>
      <p className="max-w-md text-sm sm:text-base text-white/80">
        Get notified when ReelCaster launches in British Columbia.
      </p>
      <NotifyForm />
    </main>
  )
}
