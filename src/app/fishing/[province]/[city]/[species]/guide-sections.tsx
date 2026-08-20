// Presentation for the city × species guide page. Server components only:
// every section is static prose or a static list, so nothing here needs to
// ship JavaScript.

import Link from "next/link";
import type { BlueCasterSpeciesGuide } from "@/lib/bluecaster";
import { TIER_PILL, tierFor } from "../../../../explore/lib/explore-data";

export function SectionHeading({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <h2 id={id} className="text-xl font-semibold text-rc-ink border-b border-rc-rule pb-2">
      {children}
    </h2>
  );
}

/**
 * What the rules say today, at the top of the page where it belongs.
 *
 * A city is rarely all-open or all-shut for one species: closures land per
 * subarea, so the honest headline is a count. "Open at 5 of 32 spots" tells
 * an angler more than either "open" or "closed" would.
 */
export function RegulationBanner({
  guide,
  citySpeciesLabel,
}: {
  guide: BlueCasterSpeciesGuide;
  citySpeciesLabel: string;
}) {
  const { regulations: r } = guide;
  if (!r.spot_count) return null;

  const allOpen = r.headline_state === "retention_open";
  const noneOpen = r.open_spot_count === 0;

  const tone = allOpen
    ? "border-rc-good-border bg-rc-good-bg text-rc-good-ink"
    : noneOpen
      ? "border-rc-poor-border bg-rc-poor-bg text-rc-poor-ink"
      : "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink";

  const headline = allOpen
    ? `Open for retention at all ${r.spot_count} spots we cover`
    : noneOpen
      ? r.headline_state === "closed"
        ? "Closed across every spot we cover right now"
        : "Catch and release only at every spot we cover right now"
      : `Open for retention at ${r.open_spot_count} of ${r.spot_count} spots we cover`;

  return (
    <aside className={`rounded-lg border px-4 py-3 ${tone}`}>
      <div className="rc-label text-[9px] opacity-80">Right now</div>
      <p className="text-[15px] font-semibold mt-0.5">{headline}</p>
      <p className="text-[13px] mt-1 opacity-90">
        {r.daily_limit != null && (
          <>
            {allOpen ? "Daily limit" : "Daily limit where it is open"}:{" "}
            {r.daily_limit}.{" "}
          </>
        )}
        {r.notice_summary && <>In force: {r.notice_summary}. </>}
        {r.next_open_date && noneOpen && (
          <>Next opening on record: {formatDate(r.next_open_date)}. </>
        )}
        {r.regulator ? `${r.regulator} sets the rules for ` : "The rules for "}
        {citySpeciesLabel}, and they change through the season. Check the
        current notice before you keep your catch.
      </p>
    </aside>
  );
}

/** Twelve bars, each relative to this species' best week in this city. */
export function SeasonChart({ season }: { season: BlueCasterSpeciesGuide["season"] }) {
  if (!season.months.length) return null;
  return (
    <div>
      <div className="flex items-end gap-1.5 h-24" aria-hidden>
        {season.months.map((m) => (
          <div key={m.month} className="flex-1 flex flex-col justify-end h-full">
            <div
              className="rounded-t bg-rc-brand"
              style={{
                // Floor the bar so a quiet month still reads as a bar rather
                // than a gap in the axis.
                height: `${Math.max(6, Math.round(m.level * 100))}%`,
                opacity: 0.35 + m.level * 0.65,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1.5">
        {season.months.map((m) => (
          <div
            key={m.month}
            className="flex-1 text-center font-rc-mono text-[10px] text-rc-ink-mute"
          >
            {m.label.charAt(0)}
          </div>
        ))}
      </div>
      <p className="sr-only">
        Relative abundance by month:{" "}
        {season.months
          .map((m) => `${m.label} ${Math.round(m.level * 100)} percent of peak`)
          .join(", ")}
        .
      </p>
    </div>
  );
}

export function MethodCard({
  method,
}: {
  method: BlueCasterSpeciesGuide["methods"][number];
}) {
  return (
    <div className="rounded-lg border border-rc-rule bg-rc-panel p-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <h3 className="text-[15px] font-semibold text-rc-ink capitalize">
          {method.name}
        </h3>
        {method.role === "dominant" && (
          <span className="rc-label text-[9px] rounded px-1.5 py-0.5 bg-rc-brand-soft text-rc-brand">
            Most used here
          </span>
        )}
      </div>
      {method.notes && (
        <p className="text-[14px] text-rc-ink-soft mt-1.5 leading-relaxed">
          {method.notes}
        </p>
      )}
      {method.baits.length > 0 && (
        <div className="mt-2.5">
          <div className="rc-label text-[9px] text-rc-ink-mute">Bait and lures</div>
          <ul className="flex flex-wrap gap-1.5 mt-1">
            {method.baits.map((b) => (
              <li
                key={b}
                className="rounded-full border border-rc-rule px-2.5 py-0.5 text-[12px] text-rc-ink-soft capitalize"
              >
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ConditionCard({
  condition,
}: {
  condition: BlueCasterSpeciesGuide["conditions"][number];
}) {
  return (
    <div className="rounded-lg border border-rc-rule bg-rc-panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="rc-label text-[9px] text-rc-ink-mute">{condition.label}</div>
        <div className="font-rc-mono text-[11px] text-rc-ink-mute">
          {condition.weight}% of the score
        </div>
      </div>
      <h3 className="text-[15px] font-semibold text-rc-ink mt-0.5">
        {condition.headline}
      </h3>
      <p className="text-[14px] text-rc-ink-soft mt-1.5 leading-relaxed">
        {condition.detail}
      </p>
    </div>
  );
}

export type GuideSpotRow = BlueCasterSpeciesGuide["spots"][number] & {
  /** Today's peak score for THIS species, when the city payload has one. */
  score: number | null;
};

export function SpotRow({ spot }: { spot: GuideSpotRow }) {
  const tier = tierFor(spot.score);
  return (
    <li className="flex items-center gap-3 py-2.5 border-b border-rc-rule-soft last:border-0">
      <Link
        href={`/explore/spot/${spot.slug}`}
        className="flex-1 min-w-0 group flex items-baseline gap-2"
      >
        <span className="text-[15px] font-medium text-rc-ink group-hover:text-rc-brand transition-colors truncate">
          {spot.name}
        </span>
        {spot.regulatory_state && spot.regulatory_state !== "retention_open" && (
          <span className="font-rc-mono text-[10px] uppercase tracking-[0.06em] text-rc-ink-mute shrink-0">
            {spot.regulatory_state === "closed" ? "closed" : "release only"}
          </span>
        )}
      </Link>
      {spot.score !== null ? (
        <span
          className={`font-rc-mono text-[11px] font-semibold rounded px-1.5 py-0.5 shrink-0 ${TIER_PILL[tier]}`}
        >
          {spot.score}
        </span>
      ) : (
        <span className="font-rc-mono text-[11px] text-rc-ink-mute shrink-0">-</span>
      )}
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });
}
