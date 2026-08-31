import Link from "next/link";
import { dayLabel, shareTitle, windowLabel, type ShareCard } from "@/lib/share-cards";

/**
 * A share whose spot can no longer be read.
 *
 * Cards outlive spots: one can be unpublished, deleted, or be a private custom
 * spot that an anonymous server render is not allowed to see. The person
 * holding the link did nothing wrong and was sent something real, so they get
 * the card and a way onward rather than a 404 for someone else's housekeeping.
 */
export default function OrphanShareView({ card }: { card: ShareCard }) {
  const win = windowLabel(card.windowStartHour, card.windowEndHour);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-rc-bg px-4 py-10">
      <div className="w-full max-w-md">
        {card.sharerName && (
          <p className="mb-3 text-[13px] text-rc-ink-soft">
            {card.sharerName} shared this with you
          </p>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/s/${card.token}/opengraph-image`}
          alt={shareTitle(card)}
          width={1200}
          height={630}
          className="w-full rounded-lg border border-rc-rule"
        />

        <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-soft">
          {card.spotName} on {dayLabel(card.targetDate)}
          {win ? `, best around ${win}` : ""}. This spot is no longer public, so
          there is nothing live to show behind it.
        </p>

        <Link
          href="/explore"
          className="mt-5 block rounded-md bg-rc-brand px-4 py-3 text-center text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
        >
          Find spots near you
        </Link>
      </div>
    </main>
  );
}
