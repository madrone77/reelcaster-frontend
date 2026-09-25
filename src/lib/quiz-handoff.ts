/**
 * What the quiz hands to Explore, so the map can say where it put the
 * reader and why.
 *
 * The quiz result ends on the reader's own spot. Pressing "Show me on the
 * map" opens the framed Explore on that spot, and the first thing they see
 * there is a card written from their answers: the spot, the evidence that
 * picked it, today's score and window, and what the map is. Without it a
 * reader who just answered six questions lands on a map of forty dots and
 * is lost.
 *
 * Carried in sessionStorage, not the URL: the copy needs the pick's
 * evidence and window, which the URL should not carry twenty parameters
 * for. `via=lpq` on the URL is the trigger; a tab with the trigger and no
 * record (a link opened in a new tab) gets the map's ordinary intro.
 *
 * Every access is wrapped: iOS in private mode throws on storage.
 */

import type { Persona, Access } from "@/app/lp/q/_quiz/persona";
import type { EvidenceSource } from "@/app/lp/q/_quiz/evidence";

const KEY = "rc_quiz_handoff";
/** Past this a reader is on a new visit; the map's own intro will do. */
const MAX_AGE_MS = 30 * 60 * 1000;

export interface QuizHandoff {
  citySlug: string;
  cityName: string;
  persona: Persona;
  access: Access;
  /** The fish the plan is for, as the page names it ("Coho Salmon"). */
  species: string;
  /** A shore reader shown a boat spot, because that is where the fish are. */
  boatInstead: boolean;
  spot: {
    slug: string;
    name: string;
    access: "boat" | "shore";
    /** Today's peak, 0..100. */
    score: number;
    /** Local hours of today's best window, -1 when there is none. */
    bestFrom: number;
    bestTo: number;
    source: EvidenceSource;
    areaLabel: string | null;
    distanceKm: number;
  };
  at: number;
}

function store(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function rememberQuizHandoff(rec: Omit<QuizHandoff, "at">): void {
  try {
    store()?.setItem(KEY, JSON.stringify({ ...rec, at: Date.now() }));
  } catch {
    /* storage refused */
  }
}

/** The handoff for this tab, taken so the card shows once, or null. */
export function takeQuizHandoff(): QuizHandoff | null {
  try {
    const s = store();
    const raw = s?.getItem(KEY);
    if (!s || !raw) return null;
    s.removeItem(KEY);
    const rec = JSON.parse(raw) as QuizHandoff;
    if (!rec?.spot?.slug || Date.now() - rec.at > MAX_AGE_MS) return null;
    return rec;
  } catch {
    return null;
  }
}

/** Where "Show me on the map" goes: the framed Explore, opened on the spot. */
export function quizExploreHref(citySlug: string, spotSlug: string): string {
  const q = new URLSearchParams({ loc: citySlug, ad: "day2", spot: spotSlug, via: "lpq" });
  return `/explore?${q.toString()}`;
}
