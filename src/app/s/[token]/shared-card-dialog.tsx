"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
 * favour ahead of the value. The sharer's modal is the one that asks.
 *
 * The whole flow assumes a cold visitor: signed out, never heard of us,
 * arriving because a friend sent them a fishing day. So it names what this is
 * before it asks for anything, and the ask it makes is the one the page it
 * sits on has actually earned.
 */
export default function SharedCardDialog({
  card,
  /** Is the card's day past the anonymous forecast horizon? Resolved server-side. */
  dayLocked,
}: {
  card: ShareCard;
  dayLocked: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState(false);
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
  const day = dayLabel(card.targetDate);
  const signupHref = `/signup?next=${encodeURIComponent(`/s/${card.token}`)}`;

  // The conversion moment, and it is the NORMAL case rather than an edge one.
  // Alerts fire up to 6 days out, anonymous visitors see 2 days, and a free
  // account sees 7 — so the day a friend sent almost always sits in the gap.
  // That makes the ask specific and true: not "sign up for more", but "the day
  // you were sent is one free account away". A stale card has nothing left to
  // unlock, so it never asks.
  const askForAccount = dayLocked && !stale;

  const close = () => {
    setOpen(false);
    setDismissed(true);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDismissed(true);
        }}
      >
        <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
          <DialogTitle className="sr-only">{shareTitle(card)}</DialogTitle>
          <DialogDescription className="sr-only">
            A fishing forecast for {card.spotName} on {day}, shared with you.
          </DialogDescription>

          {/* Attribution is a real trust signal, but roughly one account in
              four has no name on it. The line disappears rather than degrading
              to "Someone shared this", which reads worse than no line at all. */}
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

          {/* The card art itself, straight from the OG route, so the thing in
              the modal and the thing in the chat thread cannot drift apart. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/s/${card.token}/opengraph-image`}
            alt={shareTitle(card)}
            width={1200}
            height={630}
            className="w-full rounded-lg border border-rc-rule"
          />

          {/* Says what this IS. The reader may never have heard of us, and one
              plain sentence is the difference between a forecast and a website
              they were sent for no obvious reason. */}
          <p className="text-[13px] leading-relaxed text-rc-ink-soft">
            {stale ? (
              <>
                {day} has passed. ReelCaster scores every day at a spot on tide,
                wind, current and light, so here is how the days ahead at{" "}
                {card.spotName} look.
              </>
            ) : (
              <>
                ReelCaster scores every day at {card.spotName} on tide, wind,
                current and light{win ? `, and ${win} is the window` : ""}.
              </>
            )}
          </p>

          {askForAccount ? (
            <>
              <Link
                href={signupHref}
                className="block w-full rounded-md bg-rc-brand px-4 py-3 text-center text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
              >
                Unlock {day}
              </Link>
              {/* Names the wall honestly and says what it costs, which is
                  nothing. A vague "sign up for more" invites the assumption
                  that a card is about to be asked for. */}
              <p className="text-center text-[12px] leading-relaxed text-rc-ink-mute">
                A Member account opens the next 7 days. No card, no trial.
              </p>
              <button
                type="button"
                onClick={close}
                className="w-full text-center text-[13px] text-rc-ink-soft hover:text-rc-ink"
              >
                Look around first
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={close}
                className="w-full rounded-md bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
              >
                {stale ? "See the days ahead" : `See ${day} at ${card.spotName}`}
              </button>
              <p className="text-center text-[12px] text-rc-ink-mute">
                Free to look around. No account needed.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Once the card is dismissed the reason they are here disappears, and a
          stranger is left on a page of numbers with no context. This keeps the
          invitation, and the ask, one tap away. */}
      {dismissed && (
        <div className="sticky bottom-0 z-40 border-t border-rc-rule bg-rc-panel/95 backdrop-blur supports-[backdrop-filter]:bg-rc-panel/80">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-rc-ink">
                {card.sharerName
                  ? `${card.sharerName} sent you ${day}`
                  : `Shared with you: ${day}`}
                {card.speciesName ? ` · ${card.speciesName}` : ""}
              </p>
              {askForAccount && (
                <p className="truncate text-[11px] text-rc-ink-mute">
                  {day} is in the free 7-day forecast
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded border border-rc-line-strong px-3 py-1.5 text-[12px] font-semibold text-rc-ink hover:bg-rc-surface"
            >
              View card
            </button>
            {askForAccount && (
              <Link
                href={signupHref}
                className="shrink-0 rounded bg-rc-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-rc-brand-hover"
              >
                Unlock it free
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
