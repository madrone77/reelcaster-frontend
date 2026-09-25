"use client";

// The daily city report, on a public page.
//
// Headline free, body Pro. The headline is a real sentence about real water
// today ("Chinook keepers coming steady along the inner waterfront while
// Halibut stays slow"), which is both the strongest thing on the page and the
// most honest possible advertisement for what the rest of it contains.
//
// Two rules this component inherits and must not undo:
//
//   1. NOTHING HERE MAY IDENTIFY A SOURCE. The prose is scraped from angling
//      forums and is deliberately written to be un-attributable, and the
//      structured audit fields are already projected out upstream. Do not add
//      a "based on N reports" line, a source list, or a post count. The count
//      the route returns is a visibility switch, not a thing to print.
//
//   2. THE SECTION DISAPPEARS WHEN THERE IS NOTHING CURRENT. The route
//      answers `no_signals` for a city whose chatter has dried up, and this
//      renders nothing at all rather than an empty state. A stale briefing
//      presented as today's is worse than no section.
//
// The BODY is fetched client-side, because it varies by reader and the page
// is prerendered. The HEADLINE is free to everyone, so the server hands it in
// as `teaser` and the band is in the static HTML: it sits above the 14-day
// strip, and a band that arrived after the strip painted would shove the
// whole instrument down under the reader's thumb. Until the fetch answers,
// the space under the headline holds the same grey lines the locked state
// shows, so a free reader sees no change and a Pro reader sees them fill.
//
// THE TEASER, when locked: the headline in full, then three grey lines
// standing where the report's prose would be, then the ask. The lines are
// fixed widths and say nothing; they are not a blur of the real text (which
// would put the body in the HTML) and they carry no counts (rule 1). The same
// shape as the spot page's locked report preview, which beat the plain
// upgrade row there.

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Lock } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

/** The one part of the report the server may put in a prerendered page. */
export interface ReportTeaser {
  headline: string;
  reportDate: string;
}

interface ReportPayload {
  locked: boolean;
  status: "ready" | "pending" | "no_signals";
  report: {
    report_date: string;
    headline: string | null;
    reports_md?: string | null;
    outlook_md?: string | null;
    tips?: Array<{ text: string }>;
    generated_at: string;
  } | null;
}

const prose =
  "text-[15px] leading-relaxed text-rc-ink-soft [&_p]:mb-3 [&_p:last-child]:mb-0";

export default function CityReport({
  citySlug,
  cityName,
  teaser = null,
  onUpgrade,
}: {
  citySlug: string;
  cityName: string;
  /** Today's headline as the server saw it, or null when it saw none. */
  teaser?: ReportTeaser | null;
  onUpgrade: () => void;
}) {
  const [data, setData] = useState<ReportPayload | null>(null);
  const { session } = useAuth();
  const token = session?.access_token ?? null;

  useEffect(() => {
    let cancelled = false;
    // The route gates the body on a Bearer token, not a cookie: without this
    // header every reader, Pro included, is answered as free.
    fetch(`/api/bluecaster/city-report?city=${encodeURIComponent(citySlug)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((p: ReportPayload | null) => {
        if (!cancelled) setData(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Re-runs on the session: the gate reads the access token, so a pass fired
    // before Supabase rehydrates would leave a Pro reader holding the locked
    // payload.
  }, [citySlug, token]);

  // What to draw. The fetch is the authority once it has answered; before
  // that, the server's headline holds the band open. A fetch that answers
  // "nothing current" takes the band down even where the server had a
  // headline (the signals dried up between the render and the visit), and a
  // fetch that finds a report where the server had none puts it up.
  const settled = data !== null;
  const ready = settled ? data.status === "ready" && !!data.report?.headline : !!teaser;
  if (!ready) return null;

  const headline = settled ? data.report!.headline! : teaser!.headline;
  const reportDate = settled ? data.report!.report_date : teaser!.reportDate;
  // Locked until the server says otherwise: a Pro reader sees the grey lines
  // for the round trip, a free reader sees the same lines become the ask.
  const locked = settled ? data.locked : true;
  const report = settled ? data.report! : null;

  return (
    <section className="rounded-lg border border-rc-rule bg-rc-panel p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="rc-label text-[9px] text-rc-ink-mute">
          {cityName} report
        </h2>
        <span className="font-rc-mono text-[10px] text-rc-ink-mute">
          {reportDate}
        </span>
      </div>

      <p className="text-[17px] sm:text-[19px] font-semibold text-rc-ink leading-snug">
        {headline}
      </p>

      {locked || !report ? (
        <button
          type="button"
          onClick={settled ? onUpgrade : undefined}
          aria-disabled={!settled}
          className="group block w-full text-left pt-1"
        >
          {/* Where the prose would be. Fixed widths, no words, no counts. */}
          <div aria-hidden className="space-y-2.5 select-none">
            <span className="block h-2.5 w-[94%] rounded-full bg-rc-surface" />
            <span className="block h-2.5 w-[88%] rounded-full bg-rc-surface" />
            <span className="block h-2.5 w-[61%] rounded-full bg-rc-surface" />
          </div>
          <span
            className={`mt-4 flex items-center gap-3 rounded border border-rc-brand/40 bg-rc-brand-soft px-4 py-3 transition-opacity duration-200 group-hover:bg-rc-brand-soft/70 ${
              settled ? "opacity-100" : "opacity-0"
            }`}
          >
            <Lock className="h-4 w-4 shrink-0 text-rc-brand" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-rc-ink">
                Read what anglers are catching around {cityName}
              </span>
              <span className="block font-rc-mono text-[11px] text-rc-ink-mute">
                What is being caught, what worked, and the best windows ahead
              </span>
            </span>
            <span className="shrink-0 font-rc-mono text-[13px] font-bold text-rc-brand">→</span>
          </span>
        </button>
      ) : (
        <div className="space-y-4 pt-1">
          {report.reports_md && (
            <div className={prose}>
              <Markdown remarkPlugins={[remarkGfm]}>
                {report.reports_md}
              </Markdown>
            </div>
          )}
          {report.outlook_md && (
            <div className="border-t border-rc-rule pt-3">
              <div className="rc-label text-[9px] text-rc-ink-mute mb-1.5">
                Outlook
              </div>
              <div className={prose}>
                <Markdown remarkPlugins={[remarkGfm]}>
                  {report.outlook_md}
                </Markdown>
              </div>
            </div>
          )}
          {!!report.tips?.length && (
            <ul className="border-t border-rc-rule pt-3 space-y-1.5">
              {report.tips.map((t) => (
                <li
                  key={t.text}
                  className="text-[14px] text-rc-ink-soft flex gap-2"
                >
                  <span className="text-rc-brand" aria-hidden>
                    ·
                  </span>
                  {t.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
