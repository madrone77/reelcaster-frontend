"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// The daily report for the angler's home city — first card in the
// dashboard rail, above alerts, catches and regulations.
//
// Two sections of unequal weight, matching how BlueCaster writes them:
// "On the water" (what people are actually catching, last 14 days) carries
// the card, and "Outlook" is a short forecast note underneath.
//
// Type is a step down from the main column: this is a ~360px rail, and the
// reports section is three or four sentences of prose rather than the one
// line the other rail cards carry.
//
// Pro-only, and the gate is server-side in /api/bluecaster/city-daily-report
// — a free caller gets `{ locked: true }` with no body, so there is nothing
// to reveal in the network tab. This component only decides what to render.
//
// The city is derived from the pinned home spot server-side and is never a
// request parameter; without a home spot the card becomes the pin CTA.

interface DailyReport {
  report_date: string;
  headline: string | null;
  reports_md: string | null;
  reports_window_days: number;
  outlook_md: string | null;
  outlook_horizon_days: number;
  tips: Array<{ text: string }>;
  generated_at: string;
}

interface Payload {
  locked?: boolean;
  city?: { slug: string; name: string } | null;
  status?: "ready" | "pending" | "no_home_city";
  report?: DailyReport | null;
}

/**
 * Renders the `**bold**` that BlueCaster puts around spot and species names.
 *
 * A full markdown renderer would be overkill and riskier: this text is
 * LLM-written from scraped forum posts, so the less of it that becomes
 * markup, the better. Bold is the only formatting the prompt emits, and
 * everything else stays literal text.
 */
function BoldNames({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-semibold text-rc-ink">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Paragraphs({ md, className }: { md: string; className: string }) {
  return (
    <>
      {md
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className}>
            <BoldNames text={p} />
          </p>
        ))}
    </>
  );
}

export function DailyReportCard() {
  const [data, setData] = useState<Payload | null>(null);
  // Collapsed by default. Expanded, this card runs ~1160px against ~120px
  // for the other rail cards, which pushes alerts, catches and regulations
  // clean off the fold. "On the water" is the reason the card exists, so
  // that stays open and the forecast note and tips fold away.
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        if (!token) {
          if (!cancelled) setData({ locked: true });
          return;
        }
        const res = await fetch("/api/bluecaster/city-daily-report", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ locked: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Loading: a skeleton rather than nothing, so the card doesn't pop in
  // and shove the rest of the dashboard down.
  if (data === null) {
    return (
      <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
        <div className="px-4 py-4">
          <div className="h-4 w-40 animate-pulse rounded bg-rc-surface" />
          <div className="mt-3 h-20 animate-pulse rounded bg-rc-surface" />
        </div>
      </div>
    );
  }

  // Free / signed-out: render nothing. This is a Pro surface and an empty
  // teaser here would just be noise next to the existing upgrade prompts.
  if (data.locked) return null;

  if (data.status === "no_home_city") {
    return (
      <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
        <div className="px-4 py-4">
          <span className="text-[15px] font-medium text-rc-ink">
            Your daily report
          </span>
          <p className="mt-2 font-rc-mono text-[12px] text-rc-ink-soft">
            Pin a home spot and you&apos;ll get a daily read on what anglers are
            catching around it.
          </p>
          <Link
            href="/explore"
            className="mt-2 inline-block font-rc-mono text-[11px] font-bold text-rc-brand"
          >
            Find your spot ›
          </Link>
        </div>
      </div>
    );
  }

  if (data.status === "pending" || !data.report) {
    return (
      <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
        <div className="px-4 py-4">
          <span className="text-[15px] font-medium text-rc-ink">
            {data.city?.name ? `${data.city.name} daily report` : "Your daily report"}
          </span>
          <p className="mt-2 font-rc-mono text-[12px] text-rc-ink-soft">
            We&apos;re putting together your first report for{" "}
            {data.city?.name ?? "your area"}. Check back shortly.
          </p>
        </div>
      </div>
    );
  }

  const r = data.report;
  const hasMore = Boolean(r.outlook_md) || r.tips.length > 0;

  return (
    <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
      <div className="px-4 pb-4 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[15px] font-medium text-rc-ink">
            {data.city?.name ?? "Your area"} daily report
          </span>
          <span className="shrink-0 rounded bg-rc-surface px-2 py-0.5 font-rc-mono text-[11px] font-bold text-rc-ink-soft">
            {r.reports_window_days}D
          </span>
        </div>

        {r.headline && (
          <p className="mt-2 text-[13.5px] font-medium leading-snug text-rc-ink">
            {r.headline}
          </p>
        )}

        <div className="mt-3 border-t border-rc-rule pt-3">
          <div className="font-rc-mono text-[11px] font-bold uppercase tracking-wide text-rc-brand">
            On the water
          </div>
          {r.reports_md ? (
            <div className="mt-1.5 space-y-2">
              <Paragraphs
                md={r.reports_md}
                className="text-[13px] leading-relaxed text-rc-ink-soft"
              />
            </div>
          ) : (
            <p className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-soft">
              No angler reports around your spot in the last{" "}
              {r.reports_window_days} days.
            </p>
          )}
        </div>

        {hasMore && (
          <div className="mt-3 border-t border-rc-rule pt-3">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls="daily-report-more"
              // -my-1 keeps the padded hit area from adding height to the
              // card; the row still reads as flush with the divider above.
              className="-my-1 flex w-full items-center justify-between gap-2 rounded py-1 font-rc-mono text-[11px] font-bold uppercase tracking-wide text-rc-brand hover:text-rc-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
            >
              <span>
                {expanded
                  ? "Hide outlook & tips"
                  : `Outlook${r.tips.length > 0 ? " & tips" : ""}`}
              </span>
              <span aria-hidden className="text-[13px] leading-none">
                {expanded ? "−" : "+"}
              </span>
            </button>

            {expanded && (
              <div id="daily-report-more">
                {r.outlook_md && (
                  <div className="mt-3">
                    <div className="font-rc-mono text-[11px] font-bold uppercase tracking-wide text-rc-ink-mute">
                      Next {r.outlook_horizon_days} days
                    </div>
                    <div className="mt-1.5 space-y-2">
                      <Paragraphs
                        md={r.outlook_md}
                        className="text-[12.5px] leading-relaxed text-rc-ink-soft"
                      />
                    </div>
                  </div>
                )}

                {r.tips.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {r.tips.map((t, i) => (
                      <li
                        key={i}
                        className="flex gap-2 text-[12.5px] leading-snug text-rc-ink-soft"
                      >
                        <span aria-hidden className="text-rc-brand">
                          →
                        </span>
                        <span>{t.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
