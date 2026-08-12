"use client";

// "Recent reports" — the full-width band under the score/map row.
//
// One block, one set of numbers. It replaced a two-panel arrangement whose
// counts came from the raw fresh-catch feed (which credits every signal to the
// spot it was extracted against) while the narrative applied the roster split,
// so the two panels contradicted each other about the same species. Everything
// here now comes from the summary payload: `reportCount` / `landedCount` are
// per-outing at THIS spot, "caught here" lists only what the spot is credited
// with, and anything the reports mentioned but the spot does not own is in the
// nearby column, named and placed.
//
// LAYOUT NOTE. An earlier cut used three equal columns (here / what worked /
// nearby) and looked broken, because the content is never balanced: Oak Bay
// Flats has one at-spot species, no technique detail and three nearby species,
// which left a column with a single sentence and an enormous void beside it.
// Now the two species lists share a row (they are a natural pair, here vs not
// here) and "what worked" is a full-width row underneath that disappears
// entirely when the reports contain no gear or depth detail. Nothing reserves
// space it might not fill.
//
// COLLAPSED BY DEFAULT. Only the headline, the two or three sentences under it
// and the trip count show on load; the species split, the technique lines, the
// caveat and the source quotes all sit behind one control. Most anglers want the
// verdict and nothing else, and the band is tall enough fully open that it
// pushed the 14-day forecast off the first screen. One expander, not two: the
// quotes used to have their own "see the N reports" toggle nested inside an
// already-open block.
//
// NO SOURCES, EVER. The summary is built from scraped forum posts, and consumer
// output stays un-attributable to those forums, the same rule the city daily
// report follows. There is no quote list and no domain name here, and the API
// strips the citations before the payload leaves the server so they are not
// readable in devtools either. The full evidence lives on the admin digest,
// which is where grounding needs to be auditable.
//
// Three states: locked (not paying), narrative (a real summary), and
// counts-only (reports exist but too few to narrate).

import { useState } from "react";
import { ChevronDown, Lock } from "lucide-react";
import type { RecentReports as RecentReportsData } from "@/lib/bluecaster/live-spot-types";
import { reportAge, type RailFreshCatch } from "@/app/explore/lib/fresh-catch-types";

const STATE_DOT: Record<string, string> = {
  biting: "bg-rc-good",
  patchy: "bg-rc-fair",
  quiet: "bg-rc-ink-mute",
};


/**
 * "Updated today" beats "last 21 days". The window length is a property of our
 * pipeline; how fresh the newest report is, is the thing an angler is actually
 * asking. Falls back to the window only when no date is known, which happens on
 * pre-backfill rows.
 */
function Header({ days, updatedAt }: { days: number; updatedAt: string | null }) {
  const age = reportAge(updatedAt);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="rc-label text-[9px]">Recent reports</div>
      <span className="shrink-0 font-rc-mono text-[10px] uppercase tracking-[0.06em] text-rc-ink-mute">
        {age ? `Updated ${age}` : `last ${days} days`}
      </span>
    </div>
  );
}

function ColLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-rc-mono text-[9px] uppercase tracking-[0.06em] text-rc-ink-mute">
      {children}
    </div>
  );
}

/** One species row. `places` is only passed for nearby species, where naming the
 *  mark is the whole point; the note is written not to repeat it. */
function SpeciesRow({
  name,
  posts,
  positive,
  state,
  note,
  places,
}: {
  name: string;
  posts: number;
  positive: number;
  state: string;
  note: string;
  places?: Array<{ name: string; km: number }>;
}) {
  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className={`mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full ${STATE_DOT[state] ?? "bg-rc-ink-mute"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[13.5px] font-medium text-rc-ink">{name}</span>
          <span className="shrink-0 font-rc-mono text-[11px] text-rc-ink-mute">
            <span className={positive > 0 ? "text-rc-good" : undefined}>{positive}</span>
            {` / ${posts}`}
          </span>
        </div>
        {note && <p className="mt-0.5 text-[12.5px] leading-snug text-rc-ink-soft">{note}</p>}
        {places && places.length > 0 && (
          <p className="mt-1 font-rc-mono text-[10px] text-rc-ink-mute">
            {places.map((p) => `${p.name} ${p.km} km`).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}

export function RecentReportsBand({
  teaser,
  updatedAt,
  reports,
  fresh,
  days,
  locked,
  onUpgrade,
  className = "",
}: {
  /** Truncated headline. Present for everyone, including crawlers, and the only
   *  part of the report that lives in the prerendered HTML. */
  teaser: string | null;
  /** Date of the newest report. Drives the "Updated ..." stamp in the header. */
  updatedAt: string | null;
  /** The full report. Only ever populated for a Pro viewer, fetched from the
   *  gated route after the server has checked entitlement. */
  reports: RecentReportsData | null;
  fresh: RailFreshCatch | null;
  days: number;
  /** Has the server said whether this reader may have the report?
   *  null = still asking, true = no, false = yes. The upsell renders only on
   *  true. Waiting on this rather than on the client tier is what stops a Pro
   *  angler seeing a lock: entitlement resolves faster than the report does, so
   *  "tier known, report not here yet" is not the same as "you may not have
   *  it". */
  locked: boolean | null;
  onUpgrade?: () => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Resolved once, before the state guards narrow `fresh` away. Freshest known
  // date wins: the full report if we have it, else the date that travelled with
  // the teaser, else whatever the counts carry.
  const headerDate = reports?.latestDate ?? updatedAt ?? fresh?.latestDate ?? null;

  if (!fresh && !reports && !teaser) return null;

  const shell = `rounded border border-rc-rule bg-rc-panel p-4 lg:p-5 ${className}`;

  // Locked, but there IS a report. Show the start of its actual headline rather
  // than a generic "reports tracked here": a real sentence about this spot,
  // cut off, is a far better argument for Pro than a padlock. The rest of the
  // sentence never reaches the browser, so there is nothing to read around it.
  // Teaser: the headline is public and renders straight away. Below it, nothing
  // at all until the server answers — no skeleton, because a grey box that
  // appears and vanishes is the same flash by another name.
  if (!reports && teaser) {
    return (
      <section className={shell}>
        <Header days={days} updatedAt={headerDate} />
        <p className="mt-3 text-[17px] font-semibold leading-snug text-rc-ink lg:text-[19px]">
          {teaser}
        </p>
        {locked === true && (
          <button
            type="button"
            onClick={onUpgrade}
            className="mt-3 flex w-full items-center gap-3 rounded border border-rc-brand/40 bg-rc-brand-soft px-4 py-3 text-left transition-colors hover:bg-rc-brand-soft/70"
          >
            <Lock className="h-4 w-4 shrink-0 text-rc-brand" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-rc-ink">
                Upgrade to Pro for the full report
              </span>
              <span className="block font-rc-mono text-[11px] text-rc-ink-mute">
                What is being caught here, what worked, and what is going nearby
              </span>
            </span>
            <span className="shrink-0 font-rc-mono text-[13px] font-bold text-rc-brand">→</span>
          </button>
        )}
      </section>
    );
  }

  if (fresh?.locked) {
    return (
      <section className={shell}>
        <Header days={days} updatedAt={headerDate} />
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-3 flex w-full items-center gap-3 rounded border border-rc-rule bg-rc-surface px-4 py-3 text-left transition-colors hover:bg-rc-panel"
        >
          <Lock className="h-4 w-4 shrink-0 text-rc-ink-mute" />
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] text-rc-ink">Anglers have been reporting here</span>
            <span className="block font-rc-mono text-[11px] text-rc-ink-mute">
              See what they caught, what worked, and when, with Pro
            </span>
          </span>
          <span className="shrink-0 font-rc-mono text-[11px] font-bold text-rc-brand">→</span>
        </button>
      </section>
    );
  }

  if (!reports) {
    const total = fresh?.count ?? 0;
    const pos = fresh?.positive ?? 0;
    const pct = total ? Math.round((pos / total) * 100) : 0;
    return (
      <section className={shell}>
        <Header days={days} updatedAt={headerDate} />
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-rc-surface">
            <div className="h-full bg-rc-good" style={{ width: `${pct}%` }} />
            <div className="h-full bg-rc-fair" style={{ width: `${100 - pct}%` }} />
          </div>
          <p className="text-[13.5px] text-rc-ink-soft">
            {pos === 0
              ? `${total} report${total === 1 ? "" : "s"}, slow lately`
              : `${pos} of ${total} report${total === 1 ? "" : "s"} landed fish`}
            {" · too few to summarise yet"}
          </p>
        </div>
      </section>
    );
  }

  const pct = reports.reportCount
    ? Math.round((reports.landedCount / reports.reportCount) * 100)
    : 0;

  return (
    <section className={shell}>
      <Header days={days} updatedAt={headerDate} />

      {/* Headline and prose share a row with the stat rail on wide screens, so
          the measure stays readable without leaving half the band empty. */}
      <div className="mt-3 grid gap-x-8 gap-y-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <h3 className="text-[17px] font-semibold leading-snug text-rc-ink lg:text-[19px]">
            {reports.headline}
          </h3>
          <p className="mt-1.5 text-[14px] leading-relaxed text-rc-ink-soft">{reports.body}</p>
        </div>

        <div className="flex items-center gap-3 lg:w-[188px] lg:flex-col lg:items-end lg:gap-1.5">
          <div className="flex h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-rc-surface lg:w-full">
            <div className="h-full bg-rc-good" style={{ width: `${pct}%` }} />
            <div className="h-full bg-rc-fair" style={{ width: `${100 - pct}%` }} />
          </div>
          <span className="font-rc-mono text-[11px] text-rc-ink-mute lg:text-right">
            <span className="whitespace-nowrap">
              <span className="text-rc-ink">
                {reports.landedCount} of {reports.reportCount}
              </span>{" "}
              trips landed
            </span>
          </span>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 flex items-center gap-1.5 font-rc-mono text-[11px] font-bold uppercase tracking-[0.06em] text-rc-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rc-brand"
      >
        {expanded ? "Show less" : "Show more"}
        <ChevronDown
          aria-hidden
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <>
      {/* Here vs not-here: a natural pair, so they share the row. */}
      <div className="mt-5 grid gap-5 border-t border-rc-rule pt-4 sm:grid-cols-2 sm:gap-8">
        <div>
          <ColLabel>Caught here</ColLabel>
          <ul className="mt-2 flex flex-col gap-2.5">
            {reports.species.map((s, i) => (
              <SpeciesRow key={i} {...s} />
            ))}
          </ul>
        </div>

        {reports.nearby.length > 0 && (
          <div>
            <ColLabel>Reported nearby, not here</ColLabel>
            <ul className="mt-2 flex flex-col gap-2.5">
              {reports.nearby.map((n, i) => (
                <SpeciesRow key={i} {...n} places={n.likelySpots} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Full width, and gone entirely when the reports had no gear or depth
          detail. It used to hold a third of the band to say "nobody mentioned
          anything", which is not worth a column. */}
      {reports.whatWorked.length > 0 && (
        <div className="mt-4 border-t border-rc-rule pt-4">
          <ColLabel>What worked</ColLabel>
          <ul className="mt-2 grid gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
            {reports.whatWorked.map((w, i) => (
              <li key={i} className="flex gap-2 text-[12.5px] leading-snug text-rc-ink-soft">
                <span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rotate-45 bg-rc-brand" />
                <span className="min-w-0">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}


        </>
      )}
    </section>
  );
}
