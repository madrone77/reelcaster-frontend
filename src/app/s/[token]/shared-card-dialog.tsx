"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  dayLabel,
  isPastDay,
  shareTitle,
  windowLabel,
  type ShareCard,
} from "@/lib/share-cards";

/**
 * What the recipient sees, over the live spot page.
 *
 * Deliberately has NO share button. This person was handed something, and
 * asking them to pass it on before they have seen what it is asks for the
 * favour ahead of the value. The sharer's modal is the one that asks; this one
 * only opens the door.
 */
export default function SharedCardDialog({ card }: { card: ShareCard }) {
  const [open, setOpen] = useState(true);
  const counted = useRef(false);

  // Counted from the browser, not the server render. RSC prefetches and
  // repeated server renders would inflate a count taken in the page component,
  // and an open is the one number in this funnel that has to mean a person.
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    fetch(`/api/share-cards/${card.token}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "opened" }),
      keepalive: true,
    }).catch(() => {});
  }, [card.token]);

  const stale = isPastDay(card);
  const win = windowLabel(card.windowStartHour, card.windowEndHour);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">{shareTitle(card)}</DialogTitle>
        <DialogDescription className="sr-only">
          A fishing forecast for {card.spotName} on {dayLabel(card.targetDate)},
          shared with you.
        </DialogDescription>

        {/* Attribution is a real trust signal, but roughly one account in four
            has no name on it. The line disappears rather than degrading to
            "Someone shared this", which reads worse than no line at all. */}
        {card.sharerName && (
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-rc-brand-soft text-[11px] font-semibold text-rc-brand"
            >
              {card.sharerName.charAt(0).toUpperCase()}
            </span>
            <span className="text-[13px] text-rc-ink-soft">
              {card.sharerName} shared this with you
            </span>
          </div>
        )}

        {/* The card art itself, straight from the OG route, so the thing in the
            modal and the thing in the chat thread cannot drift apart. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/s/${card.token}/opengraph-image`}
          alt={shareTitle(card)}
          width={1200}
          height={630}
          className="w-full rounded-lg border border-rc-rule"
        />

        {stale ? (
          <p className="text-[13px] leading-relaxed text-rc-ink-soft">
            {dayLabel(card.targetDate)} has passed. Here is how the days ahead
            at {card.spotName} are looking.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-rc-ink-soft">
            ReelCaster scores every day at a spot on tide, wind, current and
            light{win ? `. The window is ${win}` : ""}.
          </p>
        )}

        <button
          type="button"
          onClick={() => setOpen(false)}
          className="w-full rounded-md bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
        >
          {stale ? "See the days ahead" : `Open ${card.spotName}`}
        </button>

        {/* Not "see the full week": an anonymous visitor gets two days. The
            card shows fourteen bars, and that gap is the strongest upgrade
            prompt in the whole loop — but only if nothing here promised more
            than the page behind it delivers. */}
        <p className="text-center text-[12px] text-rc-ink-mute">
          Free to look around. No account needed.
        </p>
      </DialogContent>
    </Dialog>
  );
}
