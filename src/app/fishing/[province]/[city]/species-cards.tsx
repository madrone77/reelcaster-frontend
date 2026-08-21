// The city's species, as cards.
//
// This replaces two weak things with one strong one. The guides were a row of
// chips carrying a name and a peak label; the species roster existed only as a
// filter dropdown inside the map. Neither told a reader the thing they
// actually want before driving anywhere, which is whether they may keep one.
//
// A card is rendered for every published guide. Species without a guide are
// not invented here: the guide set is already gated on having methods, a
// published spot that holds the species, and being retainable in the city at
// some point, and a card linking to nothing is worse than no card.

import Link from "next/link";
import type { BlueCasterGuideLink } from "@/lib/bluecaster";
import { activityPhrase } from "../../lib/activity";
import { SectionHeading } from "./[species]/guide-sections";

/**
 * Today's legality in one line.
 *
 * `mixed` is the common case and the reason this is a count rather than a
 * word: Vancouver Chinook is open at 3 of its 31 spots, and both "open" and
 * "closed" would be a lie that sends someone to the wrong water.
 */
function legality(guide: BlueCasterGuideLink): {
  label: string;
  tone: string;
} | null {
  switch (guide.headline_state) {
    case "retention_open":
      return {
        label: `Open at all ${guide.spot_count} spots`,
        tone: "border-rc-good-border bg-rc-good-bg text-rc-good-ink",
      };
    case "mixed":
      return {
        label: `Open at ${guide.open_spot_count} of ${guide.spot_count}`,
        tone: "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink",
      };
    case "release_only":
      return {
        label: "Catch and release",
        tone: "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink",
      };
    case "closed":
      return {
        label: "Closed today",
        tone: "border-rc-poor-border bg-rc-poor-bg text-rc-poor-ink",
      };
    default:
      return null;
  }
}

/** "opens 1 May" — month and day only; the year is noise at this distance. */
function openingLabel(iso: string): string | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
  return `opens ${d} ${month}`;
}

export function SpeciesCards({
  guides,
  cityName,
  cityPath,
}: {
  guides: BlueCasterGuideLink[];
  cityName: string;
  cityPath: string;
}) {
  if (!guides.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeading id="species">What you can catch in {cityName}</SectionHeading>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guides.map((guide) => {
          const state = legality(guide);
          const opening =
            guide.open_spot_count === 0 && guide.next_open_date
              ? openingLabel(guide.next_open_date)
              : null;
          return (
            <li key={guide.species_slug}>
              <Link
                href={`${cityPath}/${guide.species_slug}`}
                className="group flex h-full flex-col rounded-lg border border-rc-rule bg-rc-panel p-4 hover:border-rc-brand transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-semibold text-rc-ink group-hover:text-rc-brand transition-colors">
                    {guide.species_name}
                  </h3>
                  {state && (
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 font-rc-mono text-[10px] ${state.tone}`}
                    >
                      {state.label}
                    </span>
                  )}
                </div>

                <dl className="mt-2 space-y-0.5 font-rc-mono text-[11px] text-rc-ink-mute">
                  {guide.peak_label && (
                    <div className="flex gap-1.5">
                      <dt className="sr-only">Peak season</dt>
                      <dd>Peak {guide.peak_label}</dd>
                    </div>
                  )}
                  {opening && (
                    <div className="flex gap-1.5">
                      <dt className="sr-only">Next opening</dt>
                      <dd>{opening}</dd>
                    </div>
                  )}
                  <div className="flex gap-1.5">
                    <dt className="sr-only">Methods described</dt>
                    <dd>
                      {guide.method_count} method
                      {guide.method_count === 1 ? "" : "s"}
                    </dd>
                  </div>
                </dl>

                <span className="mt-3 pt-3 border-t border-rc-rule text-[13px] font-medium text-rc-brand">
                  {/* "Dungeness crabbing guide", never "crab fishing". */}
                  {activityPhrase(guide.activity)} guide
                  <span aria-hidden> →</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
