import { tierFor } from '@/app/explore/lib/explore-data';

// Static demo scores (the landing page makes no API calls). Cities and their
// marquee spots alternate so the strip reads as coverage across BC and
// Washington, not one town. Every name is a real place we publish.
const TICKER_ENTRIES = [
  { name: 'Vancouver', place: 'BC', score: 78 },
  { name: 'Sandheads', place: 'Vancouver', score: 84 },
  { name: 'Seattle', place: 'WA', score: 72 },
  { name: 'Possession Point', place: 'Seattle', score: 80 },
  { name: 'Victoria', place: 'BC', score: 81 },
  { name: 'Race Rocks', place: 'Victoria', score: 85 },
  { name: 'Nanaimo', place: 'BC', score: 69 },
  { name: 'Dodd Narrows', place: 'Nanaimo', score: 74 },
  { name: 'Friday Harbor', place: 'WA', score: 76 },
  { name: 'Salmon Bank', place: 'Friday Harbor', score: 82 },
  { name: 'Prince Rupert', place: 'BC', score: 83 },
  { name: 'Skeena Bar', place: 'Prince Rupert', score: 88 },
  { name: 'Sooke', place: 'BC', score: 76 },
  { name: 'Point No Point', place: 'Sooke', score: 79 },
  { name: 'Bamfield', place: 'BC', score: 80 },
  { name: 'Swiftsure Bank', place: 'Bamfield', score: 86 },
  { name: 'Sidney', place: 'BC', score: 68 },
  { name: 'Cowichan', place: 'BC', score: 71 },
];

// The marquee scrolls one full row's width per cycle, so the duration has to
// grow with the row or a longer list just whips past faster.
const MARQUEE_SECONDS = 4.2 * TICKER_ENTRIES.length;

const TIER_DOT: Record<string, string> = {
  good: 'bg-rc-good',
  fair: 'bg-rc-fair',
  poor: 'bg-rc-poor',
  none: 'bg-rc-rule',
};

function TickerRow({ hidden }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden} className="flex shrink-0 items-center gap-10 pr-10">
      {TICKER_ENTRIES.map(({ name, place, score }) => (
        <li
          key={`${name}-${place}`}
          className="flex items-center gap-2 whitespace-nowrap font-rc-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-white"
        >
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${TIER_DOT[tierFor(score)]}`}
          />
          {name}
          <span className="font-normal text-white/50">{place}</span>
          {score}
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
      <div
        className="flex w-max animate-rc-marquee motion-reduce:animate-none"
        style={{ animationDuration: `${MARQUEE_SECONDS}s` }}
      >
        <TickerRow />
        <TickerRow hidden />
      </div>
    </div>
  );
}
