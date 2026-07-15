import { tierFor } from '@/app/explore/lib/explore-data';

// Static demo scores (the landing page makes no API calls).
const TICKER_SPOTS = [
  { name: 'Race Rocks', score: 85 },
  { name: 'Sooke', score: 76 },
  { name: 'Pedder Bay', score: 82 },
  { name: 'Oak Bay', score: 71 },
  { name: 'Sidney', score: 68 },
  { name: 'Trial Is.', score: 74 },
  { name: 'Becher Bay', score: 79 },
];

const TIER_DOT: Record<string, string> = {
  good: 'bg-rc-good',
  fair: 'bg-rc-fair',
  poor: 'bg-rc-poor',
  none: 'bg-rc-rule',
};

function TickerRow({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center gap-12 pr-12">
      {TICKER_SPOTS.map(({ name, score }) => (
        <li
          key={name}
          className="flex items-center gap-2 whitespace-nowrap font-rc-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[tierFor(score)]}`}
          />
          {name} {score}
        </li>
      ))}
    </ul>
  );
}

export default function ScoreTicker() {
  return (
    <div
      data-testid="homepage-ticker"
      className="overflow-hidden bg-rc-navy-deep py-3.5"
    >
      <div className="flex w-max animate-rc-marquee motion-reduce:animate-none">
        <TickerRow />
        <TickerRow hidden />
      </div>
    </div>
  );
}
