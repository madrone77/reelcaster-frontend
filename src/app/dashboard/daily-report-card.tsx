"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatReportDate } from "@/lib/time-format";

// Loaded on the tap that opens it, for the same reason every other paywall on
// the dashboard defers it: a static import drags the plan matrix, the pricing
// tables and the Stripe checkout client into the first chunk.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

// The report for the angler's home city — the first card on the dashboard.
//
// Called "report" and stamped with its own date, deliberately NOT "daily
// report". The cadence is a function of how much anglers posted, and a city
// with a thin week may not get one: a card that says "daily" turns a quiet
// week into a visible broken promise, while a dated report is simply the most
// recent one. The date is upstream's `report_date`, not the time of the read,
// so a reader can always see how fresh what they are looking at is.
//
// Two sections of unequal weight, matching how BlueCaster writes them:
// "On the water" (what people are actually catching, last 14 days) carries
// the card, and "Outlook" is a short forecast note underneath.
//
// Type is a step down from the main column: this is a ~360px rail, and the
// reports section is three or four sentences of prose rather than the one
// line the other rail cards carry.
//
// The prose is Pro-only, and the gate is server-side in
// /api/bluecaster/city-daily-report: a free caller gets `{ locked: true }`
// with the city and the headline and no body, so there is nothing to reveal
// in the network tab. This component only decides what to render.
//
// The city is resolved server-side from `preferences.homeCitySlug`, falling
// back to the pinned home spot for anglers who set one before the city setting
// existed. It is never a request parameter. With neither, the card becomes the
// prompt to set a city.

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
  /** Locked: only `headline`, `report_date` and `generated_at` arrive. */
  report?: DailyReport | Pick<DailyReport, "headline" | "report_date" | "generated_at"> | null;
}

/** The prose arrived, which only happens for a Pro reader. */
function isFullReport(r: NonNullable<Payload["report"]>): r is DailyReport {
  return "reports_md" in r;
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

/**
 * Exported so ./nearby-reports renders a neighbour's report exactly the way
 * this one does. Two renderers for the same prose would drift, and the
 * `**bold**` handling is the part that must not.
 */
export function Paragraphs({ md, className }: { md: string; className: string }) {
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

export function DailyReportCard({ cityName }: { cityName?: string | null }) {
  const [data, setData] = useState<Payload | null>(null);
  // Headline only until asked. The card now sits in the main column between
  // the home spot and the saved-spot list, where three or four paragraphs of
  // prose would push the spots clean off the fold. The headline is the whole
  // report in one line; "On the water", the outlook and the tips are what the
  // plus is for.
  const [expanded, setExpanded] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  // Free / Member: show the card, locked.
  //
  // It used to render nothing at all, on the reasoning that an empty teaser
  // was noise beside the other upgrade prompts. That was the wrong call for
  // this one card: what anglers are actually catching around you is the single
  // best argument for paying, and a Member who never sees it exists cannot be
  // persuaded by it. So the card keeps its frame, its city, its date and its
  // headline, and withholds only the prose.
  //
  // The headline is the real one, the same line a free reader gets on the
  // public city page. The route sends nothing below it, so the body cannot be
  // read out of the network tab. The city is the one the route resolved for
  // this reader, which for a free account is usually the nearest covered city
  // to where they are; the caller's name is the fallback for a read that came
  // back without one.
  if (data.locked) {
    const lockedCity = data.city?.name ?? cityName;
    const teaser = data.report;
    return (
      <>
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="block w-full overflow-hidden rounded border border-rc-rule bg-rc-panel px-4 py-3.5 text-left transition-colors hover:border-rc-brand/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rc-brand"
        >
          <div className="flex items-center gap-2">
            <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-brand">
              {lockedCity ?? "Your area"} report
            </span>
            {teaser?.report_date && (
              <span className="shrink-0 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[10px] font-bold text-rc-ink-mute">
                {formatReportDate(teaser.report_date)}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-rc-ink">
            {teaser?.headline ??
              `What anglers are catching around ${lockedCity ?? "you"}`}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-rc-ink-soft">
            {/* No cadence claimed: promising "every morning" is the thing this
                card stopped doing. The date above, when there is one, says how
                fresh the report behind the lock is. */}
            Written from the last two weeks of angler reports: which species
            are going, where they came from, and what worked.
          </p>
          <span className="mt-3 flex items-center gap-1.5 border-t border-rc-rule pt-3 text-[13px] font-semibold text-rc-brand">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Read it with Pro
          </span>
        </button>
        <ProTrialModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          feature="catch-reports"
          from="dashboard-daily-report"
          placeName={cityName ?? undefined}
        />
      </>
    );
  }

  if (data.status === "no_home_city") {
    return (
      <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
        <div className="px-4 py-4">
          <span className="text-[15px] font-medium text-rc-ink">
            Your report
          </span>
          {/* The gap is a home CITY now, not a pinned spot — the route
              prefers `homeCitySlug` and only falls back to resolving the pin.
              Telling a reader to go pin a spot would send them to solve the
              harder problem, and the wrong one. */}
          <p className="mt-2 font-rc-mono text-[12px] text-rc-ink-soft">
            Set your home city and you&apos;ll get a daily read on what anglers
            are catching around you.
          </p>
          <Link
            href="/settings/account"
            className="mt-2 inline-block font-rc-mono text-[11px] font-bold text-rc-brand"
          >
            Set your city ›
          </Link>
        </div>
      </div>
    );
  }

  if (data.status === "pending" || !data.report || !isFullReport(data.report)) {
    return (
      <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
        <div className="px-4 py-4">
          <span className="text-[15px] font-medium text-rc-ink">
            {data.city?.name ? `${data.city.name} report` : "Your report"}
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

  return (
    <section className="overflow-hidden rounded border border-rc-rule bg-rc-panel px-5 py-4">
      <div className="flex items-center gap-2">
        <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-brand">
          {data.city?.name ?? cityName ?? "Your area"} report
        </span>
        {/* The report's own date, not today's. The window it covers moved
            inside the body: two badges in a header is one too many, and of the
            two, how fresh this is matters more on arrival than how far back it
            reaches. */}
        <span className="shrink-0 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[10px] font-bold text-rc-ink-mute">
          {formatReportDate(r.report_date)}
        </span>
      </div>

      {/* Headline only until asked. The prose is the payoff, not the hook:
          five sentences open on arrival is a wall on a phone, and it pushed
          everything else on the page below the fold. One line and a control
          that says what is behind it. */}
      <h2 className="mt-1.5 text-[17px] font-semibold leading-snug text-rc-ink">
        {r.headline ??
          `What anglers are catching around ${data.city?.name ?? cityName ?? "you"}`}
      </h2>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="daily-report-body"
        className="mt-2.5 flex w-full items-center justify-between gap-3 text-[13px] font-semibold text-rc-brand focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rc-brand"
      >
        {expanded ? "Hide report" : "See report"}
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border border-rc-rule text-[14px] leading-none transition-transform duration-200 ${
            expanded ? "rotate-45" : ""
          }`}
        >
          +
        </span>
      </button>

      {expanded && (
        <div id="daily-report-body" className="mt-3 border-t border-rc-rule pt-3">
          <p className="mb-2 font-rc-mono text-[10px] uppercase tracking-wide text-rc-ink-mute">
            From the last {r.reports_window_days} days of reports
          </p>
          {r.reports_md ? (
            <div className="space-y-2">
              <Paragraphs
                md={r.reports_md}
                className="text-[14px] leading-relaxed text-rc-ink-soft"
              />
            </div>
          ) : (
            <p className="font-rc-mono text-[12px] text-rc-ink-soft">
              No angler reports around {data.city?.name ?? cityName ?? "you"} in
              the last {r.reports_window_days} days.
            </p>
          )}

          {r.outlook_md && (
            <div className="mt-3 border-t border-rc-rule pt-3">
              <div className="font-rc-mono text-[11px] font-bold uppercase tracking-wide text-rc-ink-mute">
                Next {r.outlook_horizon_days} days
              </div>
              <div className="mt-1.5">
                <Paragraphs
                  md={r.outlook_md}
                  className="text-[13px] leading-relaxed text-rc-ink-soft"
                />
              </div>
            </div>
          )}

          {r.tips.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-rc-rule pt-3">
              {r.tips.map((t, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-[13px] leading-snug text-rc-ink-soft"
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
    </section>
  );
}
