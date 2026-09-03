"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

const ReportIssueDialog = dynamic(() => import("./report-issue-dialog"), {
  ssr: false,
});

/**
 * "Does this look right to you?" at the foot of a spot page.
 *
 * WHY A THUMB AND NOT A LINK. This started as one line reading "Something look
 * wrong? Tell us." Only people with a complaint ever touch a control like that,
 * which means a spot with three reports against it and a spot with three
 * reports out of two hundred readers produce identical evidence. The up vote is
 * the denominator, and it is the only way we will ever be able to say a spot's
 * data is GOOD rather than merely unreported.
 *
 * It also makes the complaint cheaper to reach. "Will you file a report" is a
 * chore; "will you tap a thumb" is not, and the thumb that comes back down
 * arrives already qualified.
 *
 * A YES/NO QUESTION, BECAUSE TWO THUMBS ARE A YES/NO CONTROL. "How does this
 * page look" is an open question wearing a binary answer, and the reader has to
 * translate. This one they do not.
 *
 * THE DOWN VOTE IS RECORDED BEFORE THE DIALOG OPENS. Somebody who says no and
 * then closes the dialog without picking a reason has still told us something,
 * and recording only on submit throws that away. The id comes back and rides
 * along on the report, so the two can be joined afterwards.
 *
 * Nothing is shown back to the reader but their own answer. The counts are ours.
 */
export default function PageVerdict({
  slug,
  spotName,
}: {
  slug: string;
  spotName: string;
}) {
  const { session } = useAuth();
  const [picked, setPicked] = useState<"up" | "down" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [verdictId, setVerdictId] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  async function vote(verdict: "up" | "down"): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/bluecaster/spots/${encodeURIComponent(slug)}/page-verdict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            verdict,
            surface: "spot_page",
            context: {
              path:
                typeof window !== "undefined" ? window.location.pathname : null,
            },
          }),
        },
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { verdictId?: string | null };
      return body.verdictId ?? null;
    } catch {
      // A vote that does not land is not worth telling anybody about. The thumb
      // has already moved, and there is nothing useful the reader could do.
      return null;
    }
  }

  function onUp() {
    setPicked("up");
    void vote("up");
  }

  function onDown() {
    // The thumb moves and the dialog opens now, on the click, rather than after
    // the round trip. Waiting would make a helpful answer feel like a slow one,
    // and the report does not need the id to be worth having: a throttled vote
    // returns null and the dialog carries on regardless.
    setPicked("down");
    setReportOpen(true);
    void vote("down").then(setVerdictId);
  }

  return (
    <div className="text-sm text-rc-ink-soft">
      {picked === "up" ? (
        <p>Thanks. That helps us know which spots we have right.</p>
      ) : picked === "down" && reported ? (
        // They said no AND said why. Asking again would read as if the report
        // had not landed.
        <p>Thanks. We will check it.</p>
      ) : picked === "down" ? (
        <p>
          Thanks.{" "}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="text-rc-brand font-medium hover:underline"
          >
            Tell us what is off
          </button>{" "}
          if you have a moment.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span>Does this look right to you?</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUp}
              aria-label="Yes, this looks right"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-rc-line-strong text-rc-ink-mute transition-colors hover:bg-rc-surface hover:text-rc-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            >
              <ThumbsUp className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={onDown}
              aria-label="No, something is wrong here"
              className="flex h-11 w-11 items-center justify-center rounded-md border border-rc-line-strong text-rc-ink-mute transition-colors hover:bg-rc-surface hover:text-rc-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            >
              <ThumbsDown className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {reportOpen && (
        <ReportIssueDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          slug={slug}
          spotName={spotName}
          surface="spot_page"
          verdictId={verdictId}
          onSent={() => setReported(true)}
        />
      )}
    </div>
  );
}
