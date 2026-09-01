"use client";

/**
 * "Home city: Vancouver (change)" — one line, at the top of the dashboard.
 *
 * The city decides what this whole page is about: which report leads it, which
 * neighbours sit under that, which water gets ranked. A setting with that much
 * reach has to be visible where its effects are, and changeable from there.
 * Buried in /settings/account it was neither.
 *
 * It renders whether or not a city is set, and that is the important half.
 * Until this existed, an angler with no home city saw a dashboard with none of
 * the city blocks on it and no explanation and no way in — the question only
 * ever came round again through a modal they had already dismissed, or not yet
 * received. This line is the standing way to answer it.
 */

import { useState } from "react";
import HomeCityModal from "@/app/components/welcome/home-city-modal";
import { cityName } from "./around-you";
import { useHomeCityState } from "@/app/explore/lib/use-home-city";

export default function HomeCityRow() {
  const { slug, ready } = useHomeCityState(true);
  const [open, setOpen] = useState(false);

  // `ready`, not `slug !== null`: the answer comes back from the profile, so a
  // bare null reads as "not set" for the first moments of every load and would
  // flash "not set" at somebody who has one. Hold the row's space instead.
  if (!ready) return <div className="h-5" aria-hidden />;

  return (
    <>
      <p className="font-rc-mono text-[11px] text-rc-ink-mute">
        Home city:{" "}
        {slug ? (
          <span className="font-semibold text-rc-ink">{cityName(slug)}</span>
        ) : (
          <span className="text-rc-ink-soft">not set</span>
        )}{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded font-semibold text-rc-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
        >
          ({slug ? "change" : "set one"})
        </button>
      </p>

      {/* Mounted only while open: the modal fetches its suggestion on mount, so
          leaving it mounted would put that request on every dashboard load for
          a question nobody asked.

          `pickerOnly` because somebody who came here to change their city is
          not asking to have their current one confirmed. */}
      {open && <HomeCityModal pickerOnly onClose={() => setOpen(false)} />}
    </>
  );
}
