// The lead capture: one field, one button.
//
// It takes an email address or a mobile number in the same input because
// asking someone to pick a channel before they have agreed to anything is a
// decision that buys nothing — the server can tell which is which. A phone
// number adds a code step; an email does not.
//
// Consent is stated at the field, not buried in a footer. That is both the
// decent thing and the requirement: this list is built from cold traffic and
// the only defence against a complaint is the record of what the person was
// told when they typed.

"use client";

import { useState } from "react";
import { PANEL, TYPE } from "./ui";

type Phase = "idle" | "sending" | "check-email" | "code-sent" | "confirmed";

export default function WeekendAlert({
  citySlug,
  cityName,
  provinceCode,
  speciesSlug,
}: {
  citySlug: string;
  cityName: string;
  provinceCode: string;
  /** The chip the reader had selected, so the digest can lead with the fish
   *  they came for. Null on "All". */
  speciesSlug: string | null;
}) {
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("sending");

    const res = await fetch("/api/weekend-alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contact,
        city: citySlug,
        cityName,
        province: provinceCode,
        species: speciesSlug,
        // Read here rather than on the server: the page is prerendered, so
        // the route never sees the landing URL's query string.
        source:
          typeof window === "undefined"
            ? null
            : new URLSearchParams(window.location.search).get("source"),
      }),
    }).catch(() => null);

    const body = await res?.json().catch(() => null);

    if (!res?.ok) {
      setError(body?.error ?? "Something went wrong. Try again.");
      setPhase("idle");
      return;
    }
    setPhase(body.status === "code-sent" ? "code-sent" : "check-email");
  }

  async function confirmCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("sending");

    const res = await fetch("/api/weekend-alert", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contact, city: citySlug, code }),
    }).catch(() => null);

    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "That code did not match.");
      setPhase("code-sent");
      return;
    }
    setPhase("confirmed");
  }

  const done = phase === "check-email" || phase === "confirmed";

  return (
    <section
      aria-labelledby="weekend-alert"
      className={`border border-rc-brand/20 bg-rc-brand/[0.04] p-5 ${PANEL}`}
    >
      <h2 id="weekend-alert" className="text-[19px] font-bold text-rc-ink">
        Never miss a {cityName} slack tide window
      </h2>
      <p className={`${TYPE.body} text-rc-ink-soft mt-2 max-w-[54ch]`}>
        {/* Describes the Thursday digest and nothing else. Score-threshold
            alerts are the Pro product below; promising them on a form that
            takes an address and creates no account would be selling the
            wrong thing. */}
        Every Thursday afternoon: the windows worth fishing this weekend, which
        water is scoring, and anything the regulator has changed since last
        week.
      </p>

      {done ? (
        <p className={`mt-4 rounded-lg border border-rc-good-border bg-rc-good-bg px-4 py-3 ${TYPE.body} text-rc-good-ink`}>
          {phase === "confirmed"
            ? `You are on the list. The first ${cityName} report lands Thursday.`
            : "Check your inbox and tap the link to confirm. Nothing is sent until you do."}
        </p>
      ) : phase === "code-sent" ? (
        <form onSubmit={confirmCode} className="mt-4 space-y-2">
          <label htmlFor="wa-code" className="block text-[13px] text-rc-ink-soft">
            Enter the code we texted to {contact}
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="wa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className="flex-1 rounded-lg border border-rc-rule bg-white px-4 py-3 text-[16px] text-rc-ink placeholder:text-rc-ink-soft focus:border-rc-brand focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-rc-brand px-5 py-3 text-[15px] font-semibold text-white hover:bg-rc-brand-hover transition-colors"
            >
              Confirm
            </button>
          </div>
          {error && <p className="text-[13px] text-rc-poor-ink">{error}</p>}
        </form>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-2">
          <label htmlFor="wa-contact" className="sr-only">
            Email address or mobile number
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="wa-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              // 16px, because anything smaller makes iOS Safari zoom the
              // whole page on focus and the reader loses the form.
              className="flex-1 rounded-lg border border-rc-rule bg-white px-4 py-3 text-[16px] text-rc-ink placeholder:text-rc-ink-soft focus:border-rc-brand focus:outline-none"
              placeholder="Email or mobile number"
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={phase === "sending"}
              className="rounded-lg bg-rc-brand px-5 py-3 text-[15px] font-semibold text-white hover:bg-rc-brand-hover disabled:opacity-60 transition-colors"
            >
              {phase === "sending" ? "Sending" : "Get the free report"}
            </button>
          </div>
          {error && <p className="text-[13px] text-rc-poor-ink">{error}</p>}
          <p className="text-[11px] text-rc-ink-soft">
            One email a week, or one text. Unsubscribe from any of them. Message
            and data rates may apply for texts.
          </p>
        </form>
      )}
    </section>
  );
}
