"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { formatHour12 } from "@/lib/time-format";
import { takeQuizHandoff, type QuizHandoff } from "@/lib/quiz-handoff";
import type { AdWall } from "@/lib/ad-mode";
import AdIntroCard from "./ad-intro-card";

/**
 * The card a quiz reader sees when the map opens on their spot.
 *
 * They answered six questions and were shown one spot; then "Show me on the
 * map" put them on a live map of forty dots. This says, in their own terms:
 * where the map put them and why (the evidence that picked the spot), what
 * today looks like there (score and best window), what the map is, and what
 * to press next (the full report, which is where the best times are).
 *
 * Written from the handoff the quiz left in sessionStorage
 * (src/lib/quiz-handoff.ts). A `via=lpq` arrival with no handoff (a link
 * opened in a new tab, storage blocked) gets the map's ordinary intro.
 *
 * NOT AN OFFER, same as AdIntroCard: no trial, no price. The frame's own
 * paywall flow runs after it exactly as it would without it.
 */

const NEW = new Set(["newcomer", "shore"]);

function evidenceLine(h: QuizHandoff): string {
  const fish = h.species;
  switch (h.spot.source) {
    case "reports":
      return `anglers have been landing ${fish} there recently`;
    case "kept":
      return h.spot.areaLabel
        ? `${fish} are being kept in ${h.spot.areaLabel} right now, and it's the best water in it`
        : `${fish} are being kept in that area right now`;
    default:
      return `it's the best-scoring ${fish} water near ${h.cityName} today`;
  }
}

function todayLine(h: QuizHandoff): string {
  const { score, bestFrom, bestTo } = h.spot;
  const when =
    bestFrom >= 0 && bestTo >= 0
      ? ` The best time to go is ${formatHour12(bestFrom)} to ${formatHour12((bestTo + 1) % 24)}.`
      : "";
  return `Today it scores ${score}/100 for ${h.species}.${when}`;
}

function mapLine(h: QuizHandoff): string {
  if (h.boatInstead) {
    return `${h.spot.name} is a boat spot, because that's where the ${h.species} are being caught. The dots along the shoreline are shore spots; each number is today's top score there.`;
  }
  if (NEW.has(h.persona)) {
    return "Every dot is a fishing spot and the number is today's top score there, 0 to 100. Green means go. Tap a dot to see when.";
  }
  return "Every dot is a scored mark. The number is today's peak; tap one for the hour-by-hour with tide, current and wind.";
}

export default function QuizIntroCard({
  wall,
  cityName,
  onReport,
}: {
  wall: AdWall;
  cityName?: string;
  /** Open the reader's spot in full. Called with its slug. */
  onReport: (slug: string) => void;
}) {
  // Decided in an effect: storage is per browser and must not reach SSR.
  const [handoff, setHandoff] = useState<QuizHandoff | null | undefined>(undefined);
  const openedAt = useRef<number | null>(null);

  useEffect(() => {
    const rec = takeQuizHandoff();
    setHandoff(rec);
    if (!rec) return;
    openedAt.current = Date.now();
    trackEvent("Quiz Intro Shown", {
      city: rec.citySlug,
      persona: rec.persona,
      spot: rec.spot.slug,
      source: rec.spot.source,
    });
  }, []);

  const dismiss = useCallback(
    (via: "button" | "outside" | "esc" | "report") => {
      if (!handoff) return;
      trackEvent("Quiz Intro Dismissed", {
        city: handoff.citySlug,
        persona: handoff.persona,
        via,
        dwell_ms: openedAt.current ? Date.now() - openedAt.current : undefined,
      });
      setHandoff(null);
    },
    [handoff],
  );

  useEffect(() => {
    if (!handoff) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss("esc");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handoff, dismiss]);

  // Not decided yet: draw nothing, so the ordinary intro cannot flash first.
  if (handoff === undefined) return null;
  // No handoff for this tab: the map's own intro.
  if (handoff === null) return <AdIntroCard wall={wall} cityName={cityName} />;

  const h = handoff;
  const km = h.spot.distanceKm > 0 ? ` (${h.spot.distanceKm} km from ${h.cityName})` : "";

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-6 lg:pl-[420px]"
      onPointerDown={() => dismiss("outside")}
      data-testid="quiz-intro-overlay"
    >
      <div
        role="dialog"
        aria-labelledby="quiz-intro-title"
        aria-describedby="quiz-intro-body"
        onPointerDown={(e) => e.stopPropagation()}
        className="animate-in fade-in-0 zoom-in-95 w-full max-w-[340px] rounded-2xl bg-white/95 px-5 pt-5 pb-4 text-left shadow-rc-panel backdrop-blur"
        data-testid="quiz-intro-card"
        data-quiz-spot={h.spot.slug}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wider text-rc-brand">Your spot today</p>
        <h2 id="quiz-intro-title" className="mt-1 text-[19px] font-semibold leading-tight tracking-tight text-rc-ink">
          {h.spot.name}
        </h2>
        <p id="quiz-intro-body" className="mt-2 text-[14.5px] leading-relaxed text-rc-ink-soft">
          We put you here{km} because {evidenceLine(h)}.
        </p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-rc-ink">{todayLine(h)}</p>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-rc-ink-soft">{mapLine(h)}</p>
        <button
          type="button"
          onClick={() => {
            dismiss("report");
            onReport(h.spot.slug);
          }}
          autoFocus
          data-testid="quiz-intro-report"
          className="mt-4 flex w-full items-center justify-center rounded-xl bg-rc-brand px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-rc-brand-hover"
        >
          See the full report
        </button>
        <button
          type="button"
          onClick={() => dismiss("button")}
          data-testid="quiz-intro-dismiss"
          className="mt-2 flex w-full items-center justify-center rounded-xl px-4 py-2 text-[14px] font-medium text-rc-ink-mute hover:text-rc-ink"
        >
          Look around first
        </button>
      </div>
    </div>
  );
}
