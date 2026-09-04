"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";
import { trackEvent } from "@/lib/analytics";
import { dayLabel, windowLabel, type ShareCard } from "@/lib/share-cards";

interface MintedShare {
  token: string;
  url: string;
  title: string;
  message: string;
  card: ShareCard;
}

/**
 * The sharer's modal: "send this to a fishing buddy".
 *
 * TWO GESTURES, ON PURPOSE. The card is minted when this OPENS, not when Send
 * is tapped, because `navigator.share()` needs transient activation and iOS
 * Safari refuses it if the handler has awaited anything. Opening is gesture
 * one, sending is gesture two, and by then the URL is already in hand.
 */
export default function ShareCardDialog({
  open,
  onOpenChange,
  slug,
  speciesId,
  targetDate,
  /** Set when arriving from an alert, whose card was minted at send time. */
  existingToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  speciesId?: string | null;
  targetDate?: string | null;
  existingToken?: string | null;
}) {
  const { session } = useAuth();
  const [share, setShare] = useState<MintedShare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const requested = useRef<string | null>(null);

  // Desktop browsers mostly have no share sheet, so the primary action becomes
  // Copy link there rather than a button that silently does nothing. Checked in
  // an effect because `navigator` does not exist during the server render.
  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function",
    );
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = existingToken ?? `${slug}:${speciesId ?? ""}:${targetDate ?? ""}`;
    if (requested.current === key) return;
    requested.current = key;
    setError(null);

    const run = async () => {
      try {
        const res = existingToken
          ? await fetch(`/api/share-cards/${existingToken}`)
          : await fetch("/api/share-cards", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(session?.access_token
                  ? { Authorization: `Bearer ${session.access_token}` }
                  : {}),
              },
              body: JSON.stringify({ slug, speciesId, targetDate }),
            });
        if (!res.ok) {
          setError("There is nothing scored to share here yet.");
          return;
        }
        setShare((await res.json()) as MintedShare);
      } catch {
        setError("Could not build a share link. Try again in a moment.");
      }
    };
    void run();
  }, [open, slug, speciesId, targetDate, existingToken, session?.access_token]);

  const markSent = useCallback((token: string) => {
    fetch(`/api/share-cards/${token}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "sent" }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  // No `await` before navigator.share — see the note on this component.
  const onSend = () => {
    if (!share) return;
    navigator
      .share({ title: share.title, text: share.message, url: share.url })
      .then(() => {
        markSent(share.token);
        trackEvent("Share Sent", { method: "share-sheet", token: share.token });
        onOpenChange(false);
      })
      // A dismissed share sheet rejects. That is a person changing their mind,
      // not a failure, and it must not surface as an error.
      .catch(() => {});
  };

  const onCopy = async () => {
    if (!share) return;
    try {
      await navigator.clipboard.writeText(`${share.message} ${share.url}`);
      setCopied(true);
      markSent(share.token);
      trackEvent("Share Sent", { method: "copy", token: share.token });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy. Long-press the link to copy it by hand.");
    }
  };

  const card = share?.card;
  const win = card ? windowLabel(card.windowStartHour, card.windowEndHour) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <DialogTitle className="text-[17px] font-semibold">
          Send this to a fishing buddy
        </DialogTitle>
        <DialogDescription className="text-[13px] text-rc-ink-soft">
          {card
            ? `${dayLabel(card.targetDate)} at ${card.spotName}${
                win ? `, best around ${win}` : ""
              }.`
            : "Building your card."}
        </DialogDescription>

        {error ? (
          <p className="py-6 text-center text-[13px] text-rc-ink-soft">{error}</p>
        ) : !share ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-rc-ink-mute" />
          </div>
        ) : (
          <>
            {/* Straight from the OG route, so what they preview is exactly what
                lands in the thread. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/s/${share.token}/opengraph-image`}
              alt={share.title}
              width={1200}
              height={630}
              className="w-full rounded-lg border border-rc-rule"
            />

            {/* Showing the prefilled message matters: people are wary of a
                button that sends something on their behalf without saying
                what. They can edit every word of it in Messages. */}
            <p className="border-l-2 border-rc-rule pl-3 text-[12px] leading-relaxed text-rc-ink-mute">
              {share.message}
            </p>

            {canNativeShare && (
              <button
                type="button"
                onClick={onSend}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
              >
                <Share2 className="h-4 w-4" aria-hidden />
                Send to a buddy
              </button>
            )}

            <button
              type="button"
              onClick={onCopy}
              className={`flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand ${
                canNativeShare
                  ? "border border-rc-line-strong text-rc-ink hover:bg-rc-surface"
                  : "bg-rc-brand text-white hover:bg-rc-brand-hover"
              }`}
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy link"}
            </button>

            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full text-center text-[13px] text-rc-ink-soft hover:text-rc-ink"
            >
              Not now
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
