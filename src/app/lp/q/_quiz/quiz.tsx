"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { trackEvent, setUserProperties } from "@/lib/analytics";
import { writeAccessFilter } from "@/lib/spot-access";
import { useCampaignHit, type CampaignTarget } from "../../_shared/lp-telemetry";
import { PRO_TESTIMONIAL_LABEL, proofQuoteFor } from "../../_shared/lp-content";
import {
  buildQuestions,
  isAnswer,
  personaCopy,
  recapLine,
  scorePersona,
  wantsShore,
  type Persona,
  type QuizAnswers,
} from "./persona";
import type { QuizData } from "./quiz-data";
import QuizTrialForm from "./quiz-trial-form";

/**
 * The quiz landing page: six taps, a short "building your plan" beat, then a
 * result page written for the persona the answers add up to, ending in the
 * 7-day Pro trial.
 *
 * One client component on one route. Questions never navigate, so a slow
 * phone on a boat ramp never waits on the network between taps, and the
 * ad's query string (utm_*, fbclid) stays in the address bar the whole way
 * for the attribution code that reads it.
 *
 * The result recommends no spot (Casey, 2026-09-24). It is the reader's plan:
 * their answers read back, what Pro does for their kind of fishing, and one
 * email field that goes straight to Stripe (./quiz-trial-form.tsx).
 *
 * Counted three ways. The campaign counter gets a hit under `lpq` and the
 * trial submit with the persona in its angle column (`q:<persona>`), so
 * Campaign results can read quiz traffic beside every other landing page.
 * PostHog and Mixpanel get every answer, for the drop-off by question. And
 * the persona rides to Stripe twice: `from=lpq-<persona>` on the checkout,
 * and the `rc_quiz` cookie as `acq_quiz`.
 */

const LANDING = "lpq";
const STORE_KEY = "rc_quiz_state";
const BUILD_MS = 2600;
/** Long enough to see the tile light up, short enough to feel instant. */
const ADVANCE_MS = 220;

type Phase = "questions" | "building" | "result";

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

/** Persona for the checkout metadata. 90 days, like the entry cookie. */
function writeQuizCookie(persona: Persona, species: string, access: string): void {
  try {
    const value = `${persona}.${species}.${access}`.replace(/[^a-z0-9.-]/g, "");
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

export default function Quiz({ data }: { data: QuizData }) {
  const questions = useMemo(
    () => buildQuestions(data.cityName, data.species.map((s) => ({ slug: s.slug, name: s.name }))),
    [data],
  );

  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
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
    questions.forEach((q) => {
      const v = s.answers[q.id];
      if (isAnswer(q, v)) (clean as Record<string, string>)[q.id] = v;
    });
    const complete = questions.every((q) => q.id in clean);
    setAnswers(clean);
    if (complete && s.phase !== "questions") setPhase("result");
    else setStep(Math.min(Math.max(0, s.step), questions.length - 1));
  }, [data.citySlug, questions]);

  useEffect(() => {
    if (!restored.current) return;
    writeStored({ city: data.citySlug, answers, phase, step });
  }, [answers, phase, step, data.citySlug]);

  useEffect(() => {
    if (phase !== "building") return;
    const t = window.setTimeout(() => setPhase("result"), BUILD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step, phase]);

  const complete = questions.every((q) => q.id in answers);
  const full = complete ? (answers as QuizAnswers) : null;
  const persona = full ? scorePersona(full).persona : null;

  // Once per result: analytics, the pixel, the checkout cookie, the map filter.
  const reported = useRef(false);
  useEffect(() => {
    if (phase !== "result" || !full || !persona || reported.current) return;
    reported.current = true;
    const props = {
      landing: LANDING,
      city: data.citySlug,
      persona,
      ...full,
    };
    trackEvent("Quiz Completed", props);
    setUserProperties({ quizPersona: persona });
    metaCustom("QuizCompleted", { persona, city: data.citySlug, species: full.species });
    writeQuizCookie(persona, full.species, full.access);
    if (wantsShore(full)) writeAccessFilter("shore");
  }, [phase, full, persona, data.citySlug]);

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
    window.setTimeout(() => {
      setAnswers((a) => ({ ...a, [q.id]: value }));
      setPicked(null);
      if (step + 1 < questions.length) setStep(step + 1);
      else setPhase("building");
    }, ADVANCE_MS);
  }

  function back() {
    if (phase === "result") {
      setPhase("questions");
      setStep(questions.length - 1);
      reported.current = false;
      return;
    }
    if (step > 0) setStep(step - 1);
  }

  function restart() {
    setAnswers({});
    setStep(0);
    setPhase("questions");
    reported.current = false;
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

      {phase === "result" && full && persona ? (
        <ResultScreen data={data} answers={full} persona={persona} onRestart={restart} />
      ) : null}
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

function ResultScreen(props: {
  data: QuizData;
  answers: QuizAnswers;
  persona: Persona;
  onRestart: () => void;
}) {
  const { data, answers, persona, onRestart } = props;
  const picked = answers.species === "any" ? null : speciesName(data, answers.species);
  const copy = personaCopy(persona, {
    species: picked ?? "every species",
    regulator: data.regulator,
    cityName: data.cityName,
  });
  const quote = proofQuoteFor(data.provinceCode);
  const emailRef = useRef<HTMLInputElement>(null);
  // Every plan gets the horizon; the Die-Hard's own list already says it.
  const benefits =
    persona === "hardcore"
      ? copy.benefits
      : [...copy.benefits, "A 14-day forecast for every spot, so you can plan your trips ahead."];

  // The sticky bar takes the reader to the one field on the page. Focus only
  // on a tap, never on load: an autofocused email field throws a phone
  // keyboard over the plan before anyone has read it.
  function toForm() {
    emailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    emailRef.current?.focus({ preventScroll: true });
  }

  return (
    <main className="flex flex-1 flex-col">
      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-rc-brand">Your {data.cityName} fishing plan</p>
      <h1 className="mt-2 text-[30px] font-bold leading-tight text-rc-ink">{copy.name}</h1>
      <p className="mt-2 text-lg text-rc-ink-soft">{copy.promise}</p>

      <p className="mt-5 rounded-2xl bg-rc-band px-4 py-3 text-[15px] leading-snug text-rc-ink-soft">
        {recapLine(answers, picked ?? "fish")}
      </p>

      <section className="mt-6 rounded-2xl border border-rc-rule bg-rc-panel p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-rc-ink-mute">Your plan includes</p>
        <ul className="mt-3 flex flex-col gap-3">
          {benefits.map((b) => (
            <li key={b} className="flex gap-3 text-[15px] leading-snug text-rc-ink">
              <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rc-good-bg text-xs font-bold text-rc-good-ink" aria-hidden>
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-rc-ink-mute">
          Built on {data.spotCount} spots around {data.cityName}, scored every hour.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold text-rc-ink">Start your plan free for 7 days</h2>
        <div className="mt-3">
          <QuizTrialForm
            ref={emailRef}
            citySlug={data.citySlug}
            region={data.provinceCode}
            persona={persona}
            inputId="quiz-email"
            cta="hero"
            ctaLabel="Start my 7-day free trial"
          />
        </div>
      </section>

      <figure className="mt-8 rounded-2xl border border-rc-rule bg-rc-panel p-5">
        {quote.pro ? (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-rc-ink-mute">{PRO_TESTIMONIAL_LABEL}</p>
        ) : null}
        {quote.rating ? (
          <p className="mt-1 text-rc-pro-gold" aria-label={`${quote.rating} out of 5`}>
            {"★".repeat(quote.rating)}
          </p>
        ) : null}
        <blockquote className="mt-2 text-[15px] leading-snug text-rc-ink">&ldquo;{quote.text}&rdquo;</blockquote>
        <figcaption className="mt-2 text-sm font-medium text-rc-ink-mute">{quote.attr}</figcaption>
      </figure>

      <button type="button" onClick={onRestart} className="mx-auto mt-6 px-3 py-2 text-sm text-rc-ink-mute underline">
        Start over
      </button>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-rc-rule bg-rc-panel/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          type="button"
          onClick={toForm}
          className="mx-auto flex min-h-[52px] w-full max-w-[528px] items-center justify-center rounded-2xl bg-rc-brand px-6 text-base font-bold text-white hover:bg-rc-brand-hover"
        >
          Start my 7-day free trial
        </button>
      </div>
    </main>
  );
}
