// "What you can keep today" — the regulations, in the words someone uses at
// the ramp.
//
// ── Why every row carries a denominator ──────────────────────────────────
//
// `status` from upstream is the city's BEST state across its spots. Seattle
// Halibut is "open" and open at 7 spots of 8; Vancouver Chinook is "open" and
// open at 2 of 31. Printing the word alone is true and useless, and worse
// than useless when someone drives to the one spot in the city where it is
// shut. So the badge is the state and the line under it is the count, always.
//
// ── What this section does not do ────────────────────────────────────────
//
// It does not paraphrase. The stored `notes` behind these rows carry things
// like "Open Wednesday to Saturday only" and "Release wild Chinook
// (mark-selective)", but they are SPOT grain and they disagree between areas
// within one city — Seattle Chinook reads differently in Area 9 and Area 10.
// A city-grain summary that picked one would be a regulation quoted at the
// wrong water, so the section states what rolls up safely and sends the
// reader to the authority for the rest.

import type { BlueCasterCitySeasonRow } from "@/lib/bluecaster";
import type { Regulator } from "@/lib/regions";
import { SectionHeading } from "../[species]/guide-sections";

/** cm → the unit the reader's own regulations are written in. */
function sizeLabel(cm: number | null, provinceCode: string): string | null {
  if (cm == null) return null;
  if (provinceCode === "BC") return `min ${Math.round(cm)} cm`;
  // WDFW writes minimum sizes in whole inches, and the centimetre value we
  // hold is a conversion of one (55.9 cm is 22"). Rounding back to the inch
  // returns the number printed in the pamphlet.
  return `min ${Math.round(cm / 2.54)}"`;
}

function stateOf(row: BlueCasterCitySeasonRow): {
  label: string;
  tone: string;
  detail: string;
} | null {
  const { status } = row;
  if (!status) return null;

  // Defaulted rather than destructured straight, because these fields are
  // newer than the API this page can be served by. Between the two deploys
  // they arrive undefined, and `undefined === 0` is false — the counts line
  // would have read "Open at undefined of 0 spots" rather than falling
  // through to the empty string the zero case already handles.
  const open = row.open_spots ?? 0;
  const total = row.total_spots ?? 0;

  const spots = (n: number) => `${n} spot${n === 1 ? "" : "s"}`;

  // "Shut" is right for a closure and wrong for release-only, where the
  // fishery is open and only the keeping is not. Saying it the same way for
  // both would tell somebody a fishery they can legally target is closed.
  const where =
    !total
      ? ""
      : row.status === "non_retention"
        ? `Catch and release at all ${spots(total)} we cover`
        : open === 0
          ? `Shut at all ${spots(total)} we cover`
          : open === total
            ? `Open at all ${spots(total)} we cover`
            : `Open at ${open} of ${spots(total)} we cover`;

  if (status === "open") {
    return {
      // "Mixed" is its own word rather than a softer "open", because the
      // difference between open-everywhere and open-somewhere is the whole
      // question for someone choosing where to launch.
      label: open === total ? "Retention open" : "Open in places",
      tone: "border-rc-good-border bg-rc-good-bg text-rc-good-ink",
      detail: where,
    };
  }
  if (status === "non_retention") {
    return {
      label: "Release only",
      tone: "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink",
      detail: where,
    };
  }
  return {
    label: "Closed",
    tone: "border-rc-poor-border bg-rc-poor-bg text-rc-poor-ink",
    detail: where,
  };
}

export default function KeepToday({
  rows,
  cityName,
  provinceCode,
  regulator,
}: {
  rows: BlueCasterCitySeasonRow[];
  cityName: string;
  provinceCode: string;
  regulator: Regulator;
}) {
  // A species with no resolved state is not rendered as a blank row: an
  // unanswered legality question looks identical to "no rules apply".
  const known = rows.filter((r) => r.status !== null);
  if (!known.length) return null;

  // Retainable first. Somebody scanning this section is deciding what to put
  // in the box, and the closures are the reference, not the answer.
  const order = { open: 0, non_retention: 1, closed: 2 } as const;
  const sorted = [...known].sort(
    (a, b) => order[a.status!] - order[b.status!],
  );

  return (
    <section aria-labelledby="keep" className="space-y-3">
      <SectionHeading id="keep">What you can keep in {cityName} today</SectionHeading>

      <ul className="divide-y divide-rc-rule rounded-lg border border-rc-rule bg-rc-panel">
        {sorted.map((row) => {
          const state = stateOf(row)!;
          // Terms only where you may keep one. A minimum size printed
          // beside "Release only" reads as permission with a condition
          // attached, and "0 a day" beside it is the same fact twice.
          const open = row.status === "open";
          const limit =
            open && row.daily_limit != null && row.daily_limit > 0
              ? `${row.daily_limit} a day`
              : null;
          const size = open ? sizeLabel(row.size_limit_cm, provinceCode) : null;
          const terms = [limit, size].filter(Boolean).join(" · ");

          return (
            <li
              key={row.species_id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3.5"
            >
              <span className="text-[15px] font-semibold text-rc-ink min-w-[9rem]">
                {row.species_name}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-rc-mono text-[10px] uppercase tracking-wide ${state.tone}`}
              >
                {state.label}
              </span>
              {terms && (
                <span className="font-rc-mono text-[11px] text-rc-ink">
                  {terms}
                </span>
              )}
              <span className="basis-full font-rc-mono text-[11px] text-rc-ink-mute">
                {state.detail}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[12px] text-rc-ink-soft">
        {/* Named, not implied. The rules genuinely differ between areas in
            one city, and the reader has to check the area they are launching
            into rather than the city they are driving from. */}
        Rules differ between {regulator.areaLabel.toLowerCase()}s and change
        in season. Check{" "}
        <a
          href={regulator.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
        >
          {regulator.name}
        </a>{" "}
        for the {regulator.areaLabel.toLowerCase()} you are fishing before you
        keep anything.
      </p>
    </section>
  );
}
