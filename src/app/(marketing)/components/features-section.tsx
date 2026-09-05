import Link from 'next/link';
import {
  BellRing,
  CalendarRange,
  Camera,
  Layers,
  MapPinned,
  MessageSquareText,
  ScrollText,
  Waves,
  type LucideIcon,
} from 'lucide-react';

// The inventory. By this point the page has shown the map, one spot, one day,
// the alert, and the two prices. This block is the answer to "and what else
// is in there": the breadth of the product, in the words the plan table on
// /plans uses, so a reader who goes on to compare plans meets the same
// features under the same names (src/lib/plan-features.ts).
//
// Each feature carries the tier it belongs to. The pricing block sits right
// above this one, and the question a reader brings down from it is "which of
// these do I get". A row of Pro features over a row of free ones answers that
// without a table: what paying adds first, then everything that costs
// nothing. Both rows are the trust signal; the free row is what makes the
// product read as deep rather than gated.
//
// Ruled cells rather than boxed cards: the three grey cards this replaced
// read as a template, and with a navy band above and a brand band below the
// section wants to be quiet. Hairlines are the same treatment as the data
// sources strip near the top of the page.

type Tier = 'pro' | 'free';

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  tier: Tier;
}

const FEATURES: Feature[] = [
  // ── what paying adds ──
  {
    icon: CalendarRange,
    title: '14 days, every hour',
    body: 'The next two weeks scored out of 100, hour by hour, at every spot on the map.',
    tier: 'pro',
  },
  {
    icon: BellRing,
    title: 'Alerts when it turns on',
    body: "Pick the score you'd get up for. We check every morning and text or email you when a day clears it.",
    tier: 'pro',
  },
  {
    icon: MapPinned,
    title: 'Your own spots',
    body: "Drop a pin where we don't publish a spot and the full model runs on it, same as the rest.",
    tier: 'pro',
  },
  {
    icon: MessageSquareText,
    title: 'Catch reports',
    body: 'What anglers are actually catching, updated daily, spot by spot.',
    tier: 'pro',
  },
  // ── free ──
  {
    icon: Layers,
    title: 'Read the bottom',
    body: 'Depth and structure drawn under every spot, so you fish the ledge instead of the mud.',
    tier: 'free',
  },
  {
    icon: Waves,
    title: 'Tide and current, by the hour',
    body: 'Watch the tide push through and the current at your spot, on the same hour as the score.',
    tier: 'free',
  },
  {
    icon: ScrollText,
    title: 'Regs before you go',
    body: "Openings, closures and limits for the water you're on, from DFO and WDFW.",
    tier: 'free',
  },
  {
    icon: Camera,
    title: 'Log a catch from a photo',
    body: 'Snap the fish and the log fills in species, spot and conditions for you.',
    tier: 'free',
  },
];

const TIER_TAG: Record<Tier, { label: string; className: string }> = {
  pro: { label: 'Pro', className: 'bg-rc-brand-soft text-rc-brand' },
  free: { label: 'Free', className: 'bg-rc-surface text-rc-ink-soft' },
};

// `className` carries the display value too, so a caller can hide the tag at
// one range: a display utility in the base string would outrank `hidden`.
function TierTag({
  tier,
  className = 'inline-flex',
}: {
  tier: Tier;
  className?: string;
}) {
  const { label, className: tone } = TIER_TAG[tier];
  return (
    <span
      className={`items-center rounded px-1.5 py-0.5 font-rc-mono text-[10px] font-semibold uppercase leading-none tracking-[0.14em] ${tone} ${className}`}
    >
      {label}
    </span>
  );
}

export default function FeaturesSection() {
  return (
    <section
      id="features"
      data-testid="homepage-features"
      className="bg-rc-panel scroll-mt-16"
    >
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between md:gap-12">
          <div className="max-w-2xl">
            <p className="font-rc-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-rc-ink-mute">
              What&rsquo;s inside
            </p>
            <h2 className="mt-3 text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] leading-[1.15] text-rc-ink">
              Everything you need in one place.
            </h2>
            <p className="mt-4 text-pretty text-sm md:text-base leading-relaxed text-rc-ink-soft">
              Tides, weather, water and regulations for the BC and Washington
              coasts, on one map. Every spot is checked by a local guide before
              it goes live.
            </p>
          </div>
          {/* The key to the tags. Reads as a gift, not a hedge: the paid tier
              is an addition to a product that already works for free. */}
          <p className="shrink-0 text-sm leading-relaxed text-rc-ink-soft md:max-w-xs md:text-right">
            <TierTag tier="pro" />
            <span className="ml-2">marks what the paid plan adds.</span>
            <br className="hidden md:block" />{' '}
            The rest is free.{' '}
            <Link
              href="/plans"
              className="font-semibold text-rc-brand underline decoration-rc-brand/30 underline-offset-4 hover:decoration-rc-brand"
            >
              Compare plans
            </Link>
          </p>
        </div>

        {/* One hairline grid: the outer top and left edges on the container,
            the bottom and right edges on every cell, so no line is ever drawn
            twice and the rules meet cleanly at every corner. */}
        <ul className="mt-12 grid border-t border-l border-rc-rule sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body, tier }) => (
            // On a phone the eight cells stack, so each one folds into a row:
            // icon beside the words, tag beside the title. From sm up the
            // icon and tag take the top line and the words sit under them.
            <li
              key={title}
              className="flex gap-4 border-b border-r border-rc-rule p-5 sm:flex-col sm:gap-0 sm:p-6"
            >
              <div className="flex shrink-0 items-start sm:items-center sm:justify-between">
                <Icon
                  className="mt-0.5 h-6 w-6 text-rc-brand sm:mt-0"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <TierTag tier={tier} className="hidden sm:inline-flex" />
              </div>
              <div className="min-w-0 flex-1 sm:mt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-base font-bold tracking-[-0.01em] text-rc-ink">
                    {title}
                  </h3>
                  <TierTag tier={tier} className="inline-flex sm:hidden" />
                </div>
                <p className="mt-1.5 text-pretty text-sm leading-relaxed text-rc-ink-soft sm:mt-2">
                  {body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Plain statement that there is no app to install. It sits under the
            feature grid because the phone frames above it read as a native
            app, and search and AI answers have been confusing ReelCaster with
            an unrelated app called Reelcast. Same wording as the FAQ entry and
            the marketing footer. */}
        <p
          data-testid="homepage-no-app-note"
          className="mt-8 text-pretty text-sm leading-relaxed text-rc-ink-soft"
        >
          <span className="font-semibold text-rc-ink">No app to install.</span>{' '}
          ReelCaster runs in the browser on any phone, tablet or computer at
          www.reelcaster.com. Add it to your home screen and it opens like an
          app. ReelCaster is not related to Reelcast.
        </p>
      </div>
    </section>
  );
}
