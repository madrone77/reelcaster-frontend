"use client";

// "Create custom spots" — the answer to the question the map above it raises.
//
// A reader who has just scrolled a map of every mark we cover has exactly one
// thought left: what about MY spot. This section is placed there to answer it
// while it is being asked, and it is three steps rather than a paragraph
// because the whole point is that it takes about twenty seconds.
//
// The steps are the real flow on /explore: arm pin-drop, drop it, name it,
// pick the species it gets scored for. Nothing here promises a step the
// product does not have.
//
// It is a Pro feature, so the button forks: a Pro viewer goes to the place
// they can actually do it, and everyone else opens the same trial modal every
// other wall on this page opens, credited to THIS wall.

import Link from "next/link";
import dynamic from "next/dynamic";
import { useState } from "react";
import { MapPin, Tag, Fish } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useMountedOnce } from "@/hooks/use-mounted-once";
// Inert off /lp/<n>/<city>. See the note in city-instrument.tsx.
import {
  reportCampaignCta,
  type CampaignTarget,
} from "@/app/lp/_shared/lp-telemetry";

const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

const STEPS = [
  {
    icon: MapPin,
    head: "Drop a pin",
    body: "Anywhere on the water. The ledge you found, the bay nobody talks about.",
  },
  {
    icon: Tag,
    head: "Name it",
    body: "Your name for it, not ours. It stays private to your account.",
  },
  {
    icon: Fish,
    head: "Choose species",
    body: "Pick what you fish there, and it starts scoring from the next run.",
  },
] as const;

export default function CustomSpots({
  cityName,
  citySlug,
  campaign,
}: {
  cityName: string;
  citySlug: string;
  /** What to credit a press to. Passed down from CityInstrument, which
   *  resolves it from the path or from the landing page that rendered it.
   *  Null on the public city page, where there is nothing to count. */
  campaign?: CampaignTarget | null;
}) {
  const { isPaid, loading: tierLoading } = useSubscription();
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const upgradeMounted = useMountedOnce(upgradeOpen);

  return (
    <section className="rounded border border-rc-rule bg-rc-panel px-4 py-5 lg:px-6 lg:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[19px] font-semibold text-rc-ink leading-tight">
          Create custom spots
        </h2>
      </div>
      {/* Casey's line, kept verbatim. It is the same promise the plan matrix
          makes ("your pin, our full model"), said the way a reader would hear
          it — the point is not that you get a bookmark, it is that the pin is
          scored by everything the rest of this page is scored by. */}
      <p className="mt-1.5 text-[15px] leading-relaxed text-rc-ink">
        Our full model on your custom private spots.
      </p>

      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, head, body }, i) => (
          <li key={head} className="flex gap-3">
            {/* Numbered, because this is a sequence and not three features.
                The numeral carries the order and the icon carries the action,
                so neither has to be read twice. */}
            <span
              aria-hidden
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rc-brand-soft text-rc-brand font-rc-mono text-[12px] font-bold"
            >
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <Icon className="h-4 w-4 shrink-0 text-rc-ink-soft" aria-hidden />
                <span className="text-[15px] font-semibold text-rc-ink leading-snug">
                  {head}
                </span>
              </span>
              <span className="block text-[13px] leading-relaxed text-rc-ink-soft mt-1">
                {body}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {/* Held until the tier resolves rather than guessing. `isPaid` starts
          false, so rendering on it immediately would offer a paying customer a
          trial for something they already have, for as long as it takes the
          subscription to load. */}
      {!tierLoading &&
        (isPaid ? (
          <Link
            href="/explore"
            className="mt-5 inline-flex items-center rounded bg-rc-brand-soft px-4 py-2.5 text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] hover:bg-rc-brand-soft/70 transition-colors"
          >
            Add a spot near {cityName}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              // "secondary": a different reason to buy than the locked day,
              // and the report is only worth reading if the two stay apart.
              if (campaign) reportCampaignCta("secondary", campaign);
              setUpgradeOpen(true);
            }}
            className="mt-5 inline-flex items-center rounded bg-rc-brand-soft px-4 py-2.5 text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] hover:bg-rc-brand-soft/70 transition-colors"
          >
            Add your own spot
          </button>
        ))}

      {/* Its own `from`, like every other wall on this page. A custom-spot
          click and a locked-day click are different reasons to buy, and one
          shared name would hide which of them actually converts. */}
      {upgradeMounted && (
        <ProTrialModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          feature="custom-spots"
          from={`city-${citySlug}-custom-spots`}
        />
      )}
    </section>
  );
}
