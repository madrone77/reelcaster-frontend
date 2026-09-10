"use client";

import { ArrowUpRight } from "lucide-react";
import { SITE_URL } from "@/lib/site";
import { btn } from "@/app/components/ui/button";
import { trackEvent } from "@/lib/analytics";

/**
 * The preferred-source ask.
 *
 * Google lets a reader name the sites they want to see more of, and gives
 * publishers a deeplink to send them to that setting with the site already
 * filled in. Somebody who has just read a spot forecast, a city page or a
 * guide is the only reader worth asking: they have the answer in hand, so the
 * ask can be about the next time rather than about us.
 *
 * Deeplink rather than Google's `publisher.js` button, deliberately:
 *
 *   - the script renders nothing at all for readers Google does not consider
 *     eligible, which would leave the sentence above it asking for a button
 *     that is not there;
 *   - a third-party <script> on these pages is what broke hydration the last
 *     time we loaded one (see the AdSense head loader);
 *   - the link wears the rc-* system, so it reads as part of the page instead
 *     of a Google widget dropped into it.
 *
 * The tab is new on purpose. Google's own button hands the reader back to the
 * page they came from; a plain link would not, and the page is the thing they
 * were reading.
 */

// Site-level setting, so the host is the whole query. Built from SITE_URL
// rather than typed, for the same reason canonicals are: one host, one place.
const PREFERRED_SOURCE_URL = `https://www.google.com/preferences/source?q=${
  new URL(SITE_URL).host
}`;

export default function PreferredSource({
  /** Which page asked, so the taps can be counted per surface. */
  surface,
  className = "",
}: {
  surface: "spot" | "city" | "species-guide" | "licence-guide";
  className?: string;
}) {
  return (
    <aside
      className={`rounded-xl border border-rc-rule bg-rc-panel px-5 py-5 sm:px-6 sm:py-6 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 ${className}`}
    >
      <div className="max-w-xl">
        <p className="text-[15px] font-medium text-rc-ink text-pretty">
          If we were helpful with your fishing today, let us help you again next
          time.
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-rc-ink-mute text-pretty">
          Make ReelCaster a preferred source on Google and you will see more of
          our forecasts and spot pages when you search.
        </p>
      </div>

      <a
        href={PREFERRED_SOURCE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => trackEvent("Preferred Source Clicked", { surface })}
        className={`shrink-0 gap-2 ${btn.secondary}`}
      >
        Choose us on Google
        <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden />
      </a>
    </aside>
  );
}
