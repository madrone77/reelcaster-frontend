import type { Metadata } from 'next'
import HomeClient from './home-client'

export const metadata: Metadata = {
  title: 'REEL Caster - Coming soon',
  description: 'Fishing Spots, Forecasts & Reports',
}

export default function Page() {
  return <HomeClient />
}
