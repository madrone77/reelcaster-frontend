"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent, setUserProperties } from "@/lib/analytics";
import { writeAccessFilter } from "@/lib/spot-access";
import { reportCampaignCta, useCampaignHit, type CampaignTarget } from "../../_shared/lp-telemetry";
import { exploreHrefFrom } from "../../_shared/lp-via";
import {
  buildQuestions,
  isAnswer,
  scorePersona,
  wantsShore,
  type Access,
  type Persona,
  type QuizAnswers,
} from "./persona";
import type { QuizData, QuizPick } from "./quiz-data";
import { quizId, recordAnswer, recordComplete, recordCta } from "./quiz-track";

/**
 * The quiz landing page: six taps, a short "building your plan" beat, then
 * straight onto the map (Casey, 2026-09-25: "after they go through the quiz
 * just drop them on the explore map with ad=today at a good spot").
 *
 * One client component on one route. Questions never navigate, so a slow
 * phone on a boat ramp never waits on the network between taps, and the
 * ad's query string (utm_*, fbclid) stays in the address bar the whole way
 * for the attribution code that reads it.
 *
 * The hand-off is Explore in the ad frame on today's scores
 * (`/explore?loc=<city>&ad=today&via=lpq&spot=<slug>`), opened on the best
 * spot for the reader's fish and their way to the water (`exploreHref`):
 * `spot=` both selects it and keeps it unlocked for a signed-out reader
 * (explore/lib/spot-locks.ts), so the spot the quiz just found is the one the
 * map is guaranteed to show a score for. The result page with the email field
 * (FE #816, #826) is gone.
 *
 * Counted three ways. The campaign counter gets a hit under `lpq` and the
 * hand-off as the press with the persona in its angle column (`q:<persona>`),
 * so Campaign results can read quiz traffic beside every other landing page.
 * PostHog and Mixpanel get every answer, for the drop-off by question. And
 * the persona rides on in the `rc_quiz` cookie as `acq_quiz` for whatever
 * checkout follows on the map.
 */

const LANDING = "lpq";
const STORE_KEY = "rc_quiz_state";
const BUILD_MS = 2600;
/** Long enough to see the tile light up, short enough to feel instant. */
const ADVANCE_MS = 220;

type Phase = "questions" | "building";

interface Stored {
  city: string;
  answers: Partial<QuizAnswers>;
  phase: Phase;
  step: number;
}

function readStored(city: string): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return s && s.city === city ? s : null;
  } catch {
    return null;
  }
}

function writeStored(s: Stored): void {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    // Storage blocked: the quiz still works, it just restarts on reload.
  }
}

/** Persona and the quiz row's id for the checkout metadata. 90 days, like
 *  the entry cookie. The id is what lets a trial find its answers. */
function writeQuizCookie(persona: Persona, species: string, access: string): void {
  try {
    const value = `${persona}.${species}.${access}.${quizId()}`.replace(/[^a-z0-9.-]/g, "");
    document.cookie = `rc_quiz=${value}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`;
  } catch {
    // Cookies blocked. The counter and analytics still carry the persona.
  }
}

function metaCustom(event: string, data: Record<string, string>): void {
  try {
    const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
    if (typeof fbq === "function") fbq("trackCustom", event, data);
  } catch {
    // Never let a pixel throw into the page.
  }
}

/** Up to five fish offered to this way of fishing, most evidence first. A
 *  kayak is offered only fish with a spot inside a paddle of the city. */
function speciesFor(data: QuizData, access: Access | undefined): QuizData["species"] {
  const list = data.species.filter((s) => {
    switch (access) {
      case "shore":
        return s.shoreOffer;
      case "kayak":
        return s.kayakOffer;
      case "both":
        return s.boatOffer || s.shoreOffer;
      default:
        return s.boatOffer;
    }
  });
  return list.slice(0, 5);
}

/** The spot to show this reader for this fish, by how they get there. */
function pickFor(fish: QuizData["species"][number], access: Access): QuizPick | null {
  switch (access) {
    case "shore":
      return fish.shore ?? fish.boat;
    case "kayak":
      return fish.kayak ?? fish.shore;
    case "both":
      return fish.boat ?? fish.shore;
    default:
      return fish.boat ?? fish.shore;
  }
}

/** Where the quiz drops the reader: Explore in the ad frame on today's
 *  scores, opened on the best spot for their fish and their way to the water.
 *  `spot=` both selects it and keeps it unlocked for a signed-out reader. */
function exploreHref(data: QuizData, a: QuizAnswers): string {
  const fish =
    (a.species === "any" ? speciesFor(data, a.access)[0] : data.species.find((x) => x.slug === a.species)) ??
    null;
  const pick = fish ? pickFor(fish, a.access) : null;
  const url = new URL(exploreHrefFrom(data.citySlug, LANDING), "http://x");
  url.searchParams.set("ad", "today");
  if (pick) url.searchParams.set("spot", pick.slug);
  return `${url.pathname}${url.search}`;
}

function questionsFor(data: QuizData, access: Access | undefined) {
  return buildQuestions(
    data.cityName,
    speciesFor(data, access).map((s) => ({ slug: s.slug, name: s.name })),
  );
}

export default function Quiz({ data }: { data: QuizData }) {
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  // The species question follows the access answer before it: a shore reader
  // is never offered halibut.
  const questions = useMemo(
    () => questionsFor(data, answers.access),
    [data, answers.access],
  );
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>("questions");
  const [picked, setPicked] = useState<string | null>(null);
  const restored = useRef(false);

  const hitTarget: CampaignTarget = {
    landing: LANDING,
    target_city: data.citySlug,
    target_spot: "",
    wall: "",
    angle: "",
  };
  useCampaignHit(hitTarget);

  // Back button and reload land the reader where they were, not on question 1.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const s = readStored(data.citySlug);
    if (!s) return;
    const clean: Partial<QuizAnswers> = {};
    const stored = questionsFor(data, s.answers.access);
    stored.forEach((q) => {
      const v = s.answers[q.id];
      if (isAnswer(q, v)) (clean as Record<string, string>)[q.id] = v;
    });
    // A finished quiz (the reader came back from the map) reopens on its
    // last question, never on the building beat, which would send them
    // straight back out.
    setAnswers(clean);
    setStep(Math.min(Math.max(0, s.step), stored.length - 1));
  }, [data]);

  useEffect(() => {
    if (!restored.current) return;
    writeStored({ city: data.citySlug, answers, phase, step });
  }, [answers, phase, step, data.citySlug]);

  const complete = questions.every((q) => q.id in answers);
  const full = complete ? (answers as QuizAnswers) : null;
  const persona = full ? scorePersona(full).persona : null;

  // The building beat ends on the map. Once per run: analytics, the pixel,
  // the checkout cookie, the map filter, then the hand-off itself, counted as
  // the quiz's press with the persona in the angle column (`q:<persona>`).
  const reported = useRef(false);
  useEffect(() => {
    if (phase !== "building" || !full || !persona) return;
    const t = window.setTimeout(() => {
      if (reported.current) return;
      reported.current = true;
      trackEvent("Quiz Completed", { landing: LANDING, city: data.citySlug, persona, ...full });
      recordComplete(data.citySlug, persona, full);
      setUserProperties({ quizPersona: persona });
      metaCustom("QuizCompleted", { persona, city: data.citySlug, species: full.species });
      writeQuizCookie(persona, full.species, full.access);
      if (wantsShore(full)) writeAccessFilter("shore");
      const href = exploreHref(data, full);
      reportCampaignCta("hero", {
        landing: LANDING,
        target_city: data.citySlug,
        target_spot: new URLSearchParams(href.split("?")[1]).get("spot") ?? "",
        wall: "",
        angle: `q:${persona}`,
      });
      trackEvent("Quiz CTA Clicked", { landing: LANDING, city: data.citySlug, persona, cta: "map" });
      recordCta(data.citySlug);
      // Back to the questions in the stored state, so the browser's back
      // button lands on the quiz, not on another hand-off.
      writeStored({ city: data.citySlug, answers, phase: "questions", step: questions.length - 1 });
      window.location.assign(href);
    }, BUILD_MS);
    return () => window.clearTimeout(t);
  }, [phase, full, persona, data, answers, questions.length]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step, phase]);


  function choose(value: string) {
    const q = questions[step];
    if (picked) return;
    setPicked(value);
    trackEvent("Quiz Answered", {
      landing: LANDING,
      city: data.citySlug,
      question: q.id,
      step: step + 1,
      answer: value,
    });
    recordAnswer(data.citySlug, q.id, step + 1, value);
    window.setTimeout(() => {
      setAnswers((a) => {
        const next: Partial<QuizAnswers> = { ...a, [q.id]: value };
        // Switching to shore after picking halibut drops the halibut.
        if (
          q.id === "access" &&
          next.species &&
          next.species !== "any" &&
          !speciesFor(data, value as Access).some((x) => x.slug === next.species)
        ) {
          delete next.species;
        }
        return next;
      });
      setPicked(null);
      if (step + 1 < questions.length) setStep(step + 1);
      else setPhase("building");
    }, ADVANCE_MS);
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 pb-28">
      <header className="flex items-center justify-between pb-2 pt-4">
        <Image src="/reelcaster-mark-blue.svg" alt="ReelCaster" width={104} height={48} priority className="h-8 w-auto" />
        {phase === "questions" && step > 0 ? (
          <button type="button" onClick={back} className="rounded-full px-3 py-2 text-sm font-medium text-rc-ink-soft">
            Back
          </button>
        ) : null}
      </header>

      {phase === "questions" ? (
        <QuestionScreen
          key={step}
          data={data}
          index={step}
          total={questions.length}
          question={questions[step]}
          selected={picked ?? (answers[questions[step].id] as string | undefined) ?? null}
          onChoose={choose}
        />
      ) : null}

      {phase === "building" && full ? <BuildingScreen data={data} answers={full} /> : null}
    </div>
  );
}

function QuestionScreen(props: {
  data: QuizData;
  index: number;
  total: number;
  question: ReturnType<typeof buildQuestions>[number];
  selected: string | null;
  onChoose: (v: string) => void;
}) {
  const { data, index, total, question, selected, onChoose } = props;
  const pct = Math.round((index / total) * 100);
  return (
    <main className="flex flex-1 flex-col">
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rc-rule-soft" aria-hidden>
        <div className="h-full rounded-full bg-rc-brand transition-[width] duration-300" style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-rc-ink-mute">
        {index === 0 ? `Your ${data.cityName} fishing plan · 6 quick taps` : `Question ${index + 1} of ${total}`}
      </p>
      <h1 className="mt-3 text-[26px] font-bold leading-tight text-rc-ink">{question.title}</h1>
      {question.sub ? <p className="mt-2 text-base text-rc-ink-soft">{question.sub}</p> : null}

      <div className="mt-6 flex flex-col gap-3" role="radiogroup" aria-label={question.title}>
        {question.options.map((o) => {
          const on = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChoose(o.value)}
              className={
                on
                  ? "flex min-h-[60px] w-full flex-col justify-center rounded-2xl border-2 border-rc-brand bg-rc-brand-soft px-5 py-3 text-left transition-colors"
                  : "flex min-h-[60px] w-full flex-col justify-center rounded-2xl border-2 border-rc-rule bg-rc-panel px-5 py-3 text-left transition-colors hover:border-rc-brand"
              }
            >
              <span className="text-[17px] font-semibold text-rc-ink">{o.label}</span>
              {o.hint ? <span className="mt-0.5 text-sm text-rc-ink-mute">{o.hint}</span> : null}
            </button>
          );
        })}
      </div>

      {index === 0 ? (
        <p className="mt-6 text-center text-sm text-rc-ink-mute">
          {data.spotCount} spots around {data.cityName} scored for today. We&apos;ll find yours.
        </p>
      ) : null}
    </main>
  );
}

function speciesName(data: QuizData, slug: string): string {
  return data.species.find((s) => s.slug === slug)?.name ?? "fish";
}

function BuildingScreen({ data, answers }: { data: QuizData; answers: QuizAnswers }) {
  const lines = [
    `Checking ${data.spotCount} spots around ${data.cityName}`,
    answers.species === "any"
      ? "Scoring every species for today"
      : `Scoring ${speciesName(data, answers.species)} hour by hour`,
    wantsShore(answers) ? "Finding water you can reach on foot" : "Reading wind, tide and current",
    "Building your plan",
  ];
  const [shown, setShown] = useState(1);
  useEffect(() => {
    const t = window.setInterval(() => setShown((n) => Math.min(n + 1, lines.length)), BUILD_MS / lines.length);
    return () => window.clearInterval(t);
  }, [lines.length]);
  return (
    <main className="flex flex-1 flex-col items-center justify-center py-16 text-center" aria-live="polite">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-rc-rule-soft border-t-rc-brand" aria-hidden />
      <h1 className="mt-6 text-2xl font-bold text-rc-ink">Building your {data.cityName} plan</h1>
      <ul className="mt-6 flex w-full max-w-xs flex-col gap-3 text-left">
        {lines.map((l, i) => (
          <li
            key={l}
            className={i < shown ? "flex items-center gap-3 text-base text-rc-ink transition-opacity" : "flex items-center gap-3 text-base text-rc-ink opacity-0"}
          >
            <span className={i < shown - 1 ? "text-rc-good" : "text-rc-ink-mute"} aria-hidden>
              {i < shown - 1 ? "✓" : "•"}
            </span>
            {l}
          </li>
        ))}
      </ul>
    </main>
  );
}
