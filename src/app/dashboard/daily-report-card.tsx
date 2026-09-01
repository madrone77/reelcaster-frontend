"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Loaded on the tap that opens it, for the same reason every other paywall on
// the dashboard defers it: a static import drags the plan matrix, the pricing
// tables and the Stripe checkout client into the first chunk.
const ProTrialModal = dynamic(
  () => import("@/app/components/paywall/pro-trial-modal"),
  { ssr: false },
);

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
  // persuaded by it. So the card keeps its frame, its city and its window, and
  // withholds only the prose.
  //
  // There is genuinely nothing to tease with — the route returns `{locked:true}`
  // and no body, so the headline never reaches the browser and cannot be read
  // out of the network tab. The city name comes from the caller instead.
  if (data.locked) {
    return (
      <>
        <button
          type="button"
          onClick={() => setUpgradeOpen(true)}
          className="block w-full overflow-hidden rounded border border-rc-rule bg-rc-panel px-4 py-3.5 text-left transition-colors hover:border-rc-brand/40 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rc-brand"
        >
          <div className="flex items-center gap-2">
            <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-brand">
              {cityName ?? "Your area"} daily report
            </span>
            <span className="shrink-0 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[10px] font-bold text-rc-ink-mute">
              14D
            </span>
          </div>
          <p className="mt-1.5 text-[15px] font-semibold leading-snug text-rc-ink">
            What anglers are catching around{" "}
            {cityName ?? "you"}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-rc-ink-soft">
            Written every morning from the last 14 days of reports: which
            species are going, where they came from, and what worked.
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
        />
      </>
    );
  }

  if (data.status === "no_home_city") {
    return (
      <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
        <div className="px-4 py-4">
          <span className="text-[15px] font-medium text-rc-ink">
            Your daily report
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

  return (
    <div className="overflow-hidden rounded border border-rc-rule bg-rc-panel">
      {/* The whole card is the toggle, and it says so in words. A bare + asks
          the reader to work out that there is more behind it and that the icon
          is how you get there; "Click here for more information" asks nothing. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls="daily-report-more"
        className="block w-full px-4 pb-3.5 pt-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rc-brand"
      >
        <div className="flex items-center gap-2">
          <span className="font-rc-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rc-brand">
            {data.city?.name ?? "Your area"} daily report
          </span>
          <span className="shrink-0 rounded bg-rc-surface px-1.5 py-0.5 font-rc-mono text-[10px] font-bold text-rc-ink-mute">
            {r.reports_window_days}D
          </span>
        </div>
        <p className="mt-1.5 text-[15px] font-semibold leading-snug text-rc-ink">
          {r.headline ?? `What anglers are catching around ${data.city?.name ?? "you"}`}
        </p>

        <span className="mt-3 flex items-center justify-between gap-3 border-t border-rc-rule pt-3 text-[14px] font-semibold text-rc-brand">
          {expanded ? "Click here to close" : "Click here for more information"}
          <span
            aria-hidden
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border border-rc-rule text-[15px] leading-none transition-transform duration-200 ${
              expanded ? "rotate-45" : ""
            }`}
          >
            +
          </span>
        </span>
      </button>

      {expanded && (
        <div id="daily-report-more" className="px-4 pb-4">
          {/* No rule of its own — the toggle row above already closed with one. */}
          <div>
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

          {r.outlook_md && (
            <div className="mt-3 border-t border-rc-rule pt-3">
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
            <ul className="mt-3 space-y-1.5 border-t border-rc-rule pt-3">
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
  );
}
