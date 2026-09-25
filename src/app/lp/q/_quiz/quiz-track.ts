"use client";

import { CLICK_TYPES } from "@/lib/attribution";
import type { Persona, QuizAnswers } from "./persona";

/**
 * The quiz's own record: every answer, posted as it is given, to
 * /api/attribution/quiz and stored one row per quiz.
 *
 * This is separate from the campaign counter (../../_shared/lp-telemetry)
 * and from PostHog and Mixpanel, which already get each answer as an event.
 * Those answer "how many". This answers "which answers go together, and
 * which of them buy": it is the table the result page is tuned from.
 *
 * The quiz id is made here, once per tab, and kept in sessionStorage so a
 * reload continues the same row rather than starting a second one. It is not
 * a user and not a device: it dies with the tab. The same id goes into the
 * rc_quiz cookie at the result (see quiz.tsx) so a trial that follows can be
 * matched back to its answers through Stripe metadata, and nowhere else.
 */

const ENDPOINT = "/api/attribution/quiz";
const ID_KEY = "rc_quiz_id";

/** 16 hex characters. Enough that two tabs never collide; short enough for a cookie. */
function makeId(): string {
  const bytes = new Uint8Array(8);
  try {
    crypto.getRandomValues(bytes);
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

let memoryId: string | null = null;

/** The id for this tab, made on first use. */
export function quizId(): string {
  if (memoryId) return memoryId;
  try {
    const stored = window.sessionStorage.getItem(ID_KEY);
    if (stored && /^[a-f0-9]{16,32}$/.test(stored)) {
      memoryId = stored;
      return stored;
    }
  } catch {
    // Storage blocked: the id lives for the page load only.
  }
  memoryId = makeId();
  try {
    window.sessionStorage.setItem(ID_KEY, memoryId);
  } catch {
    // Same.
  }
  return memoryId;
}

/** A fresh id, for "Start over": the new run is a new row. */
export function resetQuizId(): void {
  memoryId = null;
  try {
    window.sessionStorage.removeItem(ID_KEY);
  } catch {
    // Same.
  }
}

/** The three UTM fields and which network stamped a click id. Never the id. */
function campaignDims(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const norm = (key: string) => (params.get(key) ?? "").trim().toLowerCase().slice(0, 80);
  return {
    utm_source: norm("utm_source"),
    utm_medium: norm("utm_medium"),
    utm_campaign: norm("utm_campaign"),
    click_type: CLICK_TYPES.find((key) => params.get(key)) ?? "",
  };
}

/** Fire and forget: sendBeacon first, keepalive fetch as the fallback. */
function post(payload: Record<string, unknown>): void {
  const body = JSON.stringify({ quiz_id: quizId(), ...campaignDims(), ...payload });
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // Fall through.
  }
  try {
    void fetch(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    // Recording is not worth an error on a page someone is buying from.
  }
}

export function recordAnswer(city: string, question: string, step: number, answer: string): void {
  post({ kind: "answer", city, question, step, answer });
}

export function recordComplete(city: string, persona: Persona, answers: QuizAnswers): void {
  post({ kind: "complete", city, persona, ...answers });
}

export function recordCta(city: string): void {
  post({ kind: "cta", city });
}
