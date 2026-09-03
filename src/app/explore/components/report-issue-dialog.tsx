"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";

/**
 * "Something look wrong?" — the one place an angler can tell us our data is
 * wrong.
 *
 * Everything on a spot page is derived from something we scraped or inferred.
 * The person standing at the ramp knows in one second what the pipeline cannot
 * work out at all: that the pin is on the wrong side of the point, that the
 * launch has been closed since spring, that nobody has caught that species
 * there in years. This dialog is the only path that information has into the
 * system.
 *
 * NO SIGN-IN, AND NO NUDGE TO SIGN IN. Most wrong pins will be found by
 * somebody who arrived from a search result ten minutes ago. Asking them for an
 * account first turns a favour into a chore, and we lose the report.
 *
 * ONE TAP IS A COMPLETE REPORT. Picking a reason and sending is enough: the
 * note and the email are both optional, because a bare "wrong location" on a
 * spot is already more than we had. The only exception is "Something else",
 * which says nothing on its own.
 */

/** Must match `reason` in BlueCaster's lib/bluecaster/spot-issues/reasons.ts,
 *  which is also the CHECK constraint on spot_issue_reports. Slugs are the
 *  contract between the two repos; these labels are ours to reword. */
const REASONS = [
  { slug: "location", label: "Wrong location" },
  { slug: "regulations", label: "Rules are wrong or out of date" },
  { slug: "access", label: "Access or launch is wrong" },
  { slug: "species", label: "Wrong fish listed" },
  { slug: "conditions", label: "Conditions look wrong" },
  { slug: "name", label: "Wrong name or details" },
  { slug: "other", label: "Something else" },
] as const;

export type ReportSurface = "spot_page" | "spot_card";

export default function ReportIssueDialog({
  open,
  onOpenChange,
  slug,
  spotName,
  surface = "spot_page",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  spotName: string;
  /** Which surface it was opened from. A card shows a fraction of what the
   *  page does, so a report from one is a claim about far less evidence. */
  surface?: ReportSurface;
}) {
  const { session, user } = useAuth();
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [email, setEmail] = useState("");
  // Honeypot. Hidden from people, irresistible to form-filling bots. Never
  // shown, never focusable, never announced.
  const [website, setWebsite] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh dialog every time it opens. Reopening with the last report still in
  // it reads as if the send did not take.
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setReason(null);
      setNote("");
      setEmail("");
      setWebsite("");
      setSent(false);
      setError(null);
    }, 200);
    return () => clearTimeout(t);
  }, [open]);

  const needsNote = reason === "other";
  const canSend = Boolean(reason) && (!needsNote || note.trim().length > 0);

  async function send() {
    if (!reason || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bluecaster/spots/${encodeURIComponent(slug)}/issue-report`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            reason,
            note: note.trim() || null,
            surface,
            contactEmail: email.trim() || user?.email || null,
            website,
            // What they were looking at, so whoever reads this can open the
            // same screen instead of guessing which page it came from.
            context: {
              path:
                typeof window !== "undefined" ? window.location.pathname : null,
            },
          }),
        },
      );
      if (!res.ok) {
        setError("That did not send. Give it another try in a moment.");
        return;
      }
      setSent(true);
    } catch {
      setError("That did not send. Give it another try in a moment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-rc-panel border-rc-rule text-rc-ink sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        {sent ? (
          <>
            <DialogTitle className="text-[17px] font-semibold flex items-center gap-2">
              <Check className="h-4 w-4 text-rc-brand" aria-hidden />
              Thanks, we got it
            </DialogTitle>
            <DialogDescription className="text-[13px] text-rc-ink-soft">
              A person reads every one of these. If {spotName} needs fixing, we
              will fix it.
            </DialogDescription>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full rounded-md bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            >
              Done
            </button>
          </>
        ) : (
          <>
            <DialogTitle className="text-[17px] font-semibold">
              Something look wrong?
            </DialogTitle>
            <DialogDescription className="text-[13px] text-rc-ink-soft">
              Tell us what is off at {spotName} and we will check it. No account
              needed.
            </DialogDescription>

            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => {
                const picked = reason === r.slug;
                return (
                  <button
                    key={r.slug}
                    type="button"
                    onClick={() => setReason(picked ? null : r.slug)}
                    aria-pressed={picked}
                    className={`rounded-full border px-3 py-2 text-[13px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand ${
                      picked
                        ? "border-rc-brand bg-rc-brand text-white"
                        : "border-rc-line-strong text-rc-ink hover:bg-rc-surface"
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            <label className="block">
              <span className="sr-only">What is wrong</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={
                  needsNote
                    ? "Tell us what you saw."
                    : "Anything you can add helps. Optional."
                }
                className="w-full rounded-md border border-rc-line-strong bg-rc-surface px-3 py-2 text-[14px] text-rc-ink placeholder:text-rc-ink-mute focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rc-brand"
              />
            </label>

            {/* Only asked of people we cannot already reach. */}
            {!user?.email && (
              <label className="block">
                <span className="sr-only">Your email, optional</span>
                <input
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email, if you want an answer back. Optional."
                  className="w-full rounded-md border border-rc-line-strong bg-rc-surface px-3 py-2 text-[14px] text-rc-ink placeholder:text-rc-ink-mute focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-rc-brand"
                />
              </label>
            )}

            {/* Bots fill this. People never see it. */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute left-[-9999px] h-0 w-0 opacity-0"
            />

            {error && (
              <div className="rounded-lg bg-rc-poor-bg px-3 py-2 text-[13px] text-rc-poor-ink">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={send}
              disabled={!canSend || sending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-rc-brand px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            >
              {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {sending ? "Sending" : "Send report"}
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
