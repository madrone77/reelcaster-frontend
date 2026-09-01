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
// Fetched client-side rather than server-rendered, because the response varies
// by reader and the page is prerendered. The static render carries no report,
// which is what keeps it cacheable.

import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpCircle } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

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
  onUpgrade,
}: {
  citySlug: string;
  cityName: string;
  onUpgrade: () => void;
}) {
  const [data, setData] = useState<ReportPayload | null>(null);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bluecaster/city-report?city=${encodeURIComponent(citySlug)}`)
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
  }, [citySlug, userId]);

  // Nothing to show, or nothing worth showing. Renders no section at all.
  if (!data || data.status !== "ready" || !data.report?.headline) return null;

  const { report, locked } = data;

  return (
    <section className="rounded-lg border border-rc-rule bg-rc-panel p-5 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="rc-label text-[9px] text-rc-ink-mute">
          {cityName} report
        </h2>
        <span className="font-rc-mono text-[10px] text-rc-ink-mute">
          {report.report_date}
        </span>
      </div>

      <p className="text-[17px] sm:text-[19px] font-semibold text-rc-ink leading-snug">
        {report.headline}
      </p>

      {locked ? (
        <button
          type="button"
          onClick={onUpgrade}
          className="w-full flex items-center gap-2 rounded bg-rc-brand-soft text-rc-brand font-rc-mono text-xs font-semibold tracking-[0.04em] px-4 py-3 hover:bg-rc-brand-soft/70 transition-colors"
        >
          <ArrowUpCircle className="w-4 h-4" aria-hidden />
          Read what anglers are catching around {cityName}
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
