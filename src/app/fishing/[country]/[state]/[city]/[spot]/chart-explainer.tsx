"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { chartExplainerLines, type LandingTopic } from "@/lib/landing-topic";

/**
 * How to read the 24-hour chart, laid over the chart itself on an ad landing
 * that names a fish (`&species=chinook`).
 *
 * A searcher who typed "active pass chinook" has never seen this chart. It is
 * the densest thing on the page, seven rows against one clock, and it answers
 * the question they searched for only once you know the top row is the fish
 * and the rows under it are the reasons. So the card says that, in the fish's
 * own name, and gets out of the way on the X or "Got it".
 *
 * Sits inside the chart's own box rather than as a page modal: it is about the
 * chart, so the chart stays in view around it and nothing above it is covered.
 * Not an offer, and not routed through the paywall reporter.
 *
 * ONCE PER TAB per spot and species, in sessionStorage. If storage throws
 * (iOS with site data blocked) it shows once per page load.
 */

const KEY = "rc_chart_explainer";

function storageKey(slug: string, speciesId: string): string {
  return `${KEY}:${slug}:${speciesId}`;
}

function alreadyDismissed(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function markDismissed(key: string): void {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Once per page load, then.
  }
}

export default function ChartExplainer({
  slug,
  speciesId,
  speciesName,
  topic = null,
}: {
  slug: string;
  speciesId: string;
  /** The keyword name, e.g. "Chinook". */
  speciesName: string;
  /** Worded around the searched topic ("tides" explains the tide row). */
  topic?: LandingTopic | null;
}) {
  // Decided in an effect: the shell server renders, and storage is a
  // per-browser answer the server HTML cannot match.
  const [open, setOpen] = useState(false);
  const openedAt = useRef<number | null>(null);
  const key = `${storageKey(slug, speciesId)}:${topic ?? ""}`;

  useEffect(() => {
    if (alreadyDismissed(key)) return;
    openedAt.current = Date.now();
    setOpen(true);
    trackEvent("Chart Explainer Shown", { slug, species: speciesId });
  }, [key, slug, speciesId]);

  const dismiss = useCallback(
    (via: "close" | "button") => {
      markDismissed(key);
      setOpen(false);
      trackEvent("Chart Explainer Dismissed", {
        slug,
        species: speciesId,
        via,
        dwell_ms: openedAt.current ? Date.now() - openedAt.current : undefined,
      });
    },
    [key, slug, speciesId],
  );

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-30 flex items-start justify-center bg-rc-panel/60 px-2 pt-6 backdrop-blur-[1px]"
      data-testid="chart-explainer"
    >
      <div
        role="dialog"
        aria-labelledby="chart-explainer-title"
        className="relative w-full max-w-[380px] rounded-2xl border border-rc-rule bg-white px-5 pt-5 pb-4 text-left shadow-rc-panel"
      >
        <button
          type="button"
          onClick={() => dismiss("close")}
          aria-label="Close"
          className="absolute right-2.5 top-2.5 rounded p-1.5 text-rc-ink-mute hover:bg-rc-surface hover:text-rc-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <h2
          id="chart-explainer-title"
          className="pr-8 text-[18px] font-semibold leading-tight tracking-tight text-rc-ink"
        >
          How to read this chart
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[15px] leading-snug text-rc-ink-soft">
          {chartExplainerLines(speciesName, topic).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => dismiss("button")}
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
