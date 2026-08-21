// Server-rendered sections of a city page.
//
// Everything here is static prose or a static table, so none of it ships
// JavaScript and all of it is in the HTML a crawler receives. That is the
// point of splitting them out of the shell: the page used to be one client
// component whose only content was a header above a viewport-height map, so
// there was nothing below the fold and nothing in the markup worth indexing.
//
// The division of labour with the copy is deliberate and load-bearing. The
// prose describes water and character and states no counts, seasons, limits
// or licence facts, because frozen prose beside live data drifts and then
// contradicts the section next to it. Everything numeric on this page is
// rendered here, from data, at request time.

import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type {
  BlueCasterCityPage,
  BlueCasterCitySeasonRow,
} from "@/lib/bluecaster";
import { SectionHeading } from "./[species]/guide-sections";
import { licenceFor } from "./city-licence";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Rating → how filled the cell reads. Relative to the species' own year. */
const LEVEL: Record<string, number> = {
  peak: 1, excellent: 0.78, good: 0.56, fair: 0.34, poor: 0.16, none: 0,
};

const prose =
  "text-[15px] leading-relaxed text-rc-ink-soft [&_p]:mb-4 [&_p:last-child]:mb-0";

// ── About + local intel ───────────────────────────────────────────────────

export function CityProse({
  aboutMd,
  localIntelMd,
  cityName,
}: {
  aboutMd: string | null;
  localIntelMd: string | null;
  cityName: string;
}) {
  if (!aboutMd && !localIntelMd) return null;
  return (
    <section className="space-y-5">
      <SectionHeading id="about">Fishing {cityName}</SectionHeading>
      {aboutMd && (
        <div className={`max-w-3xl ${prose}`}>
          <Markdown remarkPlugins={[remarkGfm]}>{aboutMd}</Markdown>
        </div>
      )}
      {localIntelMd && (
        <div className="max-w-3xl rounded-lg border border-rc-rule bg-rc-panel p-4">
          <div className="rc-label text-[9px] text-rc-ink-mute">Local intel</div>
          <div className={`mt-1.5 ${prose}`}>
            <Markdown remarkPlugins={[remarkGfm]}>{localIntelMd}</Markdown>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Season by species ─────────────────────────────────────────────────────

/**
 * Twelve cells per species, shaded by that species' own year.
 *
 * The comparison is deliberately WITHIN a row and never down a column: the
 * curves are weekly multipliers around each species' own annual mean, so a
 * dark August cell means "good for Chinook", not "Chinook beats Halibut".
 * The row label carries the species and the legend says so out loud.
 */
export function SeasonMatrix({
  rows,
  cityName,
}: {
  rows: BlueCasterCitySeasonRow[];
  cityName: string;
}) {
  if (!rows.length) return null;

  return (
    <section className="space-y-4">
      <SectionHeading id="season">When to fish {cityName}</SectionHeading>
      <p className="text-[14px] text-rc-ink-soft max-w-3xl">
        Each row is shaded against that species&apos; own best month here, so a
        dark cell means a good month for that fish rather than a comparison
        between them.
      </p>

      {/* Wide content scrolls inside its own box rather than the page. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <caption className="sr-only">
            Relative abundance by month for each species around {cityName}
          </caption>
          <thead>
            <tr>
              <th scope="col" className="text-left rc-label text-[9px] pb-2 pr-3">
                Species
              </th>
              {MONTHS.map((m, i) => (
                <th
                  key={MONTH_NAMES[i]}
                  scope="col"
                  className="w-[6%] pb-2 font-rc-mono text-[10px] font-normal text-rc-ink-mute"
                >
                  <span aria-hidden>{m}</span>
                  <span className="sr-only">{MONTH_NAMES[i]}</span>
                </th>
              ))}
              <th scope="col" className="text-left rc-label text-[9px] pb-2 pl-3">
                Today
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.species_id} className="border-t border-rc-rule">
                <th
                  scope="row"
                  className="text-left text-[13px] font-medium text-rc-ink py-1.5 pr-3 whitespace-nowrap"
                >
                  {row.species_name}
                </th>
                {MONTHS.map((_, i) => {
                  const rating = row.months[String(i + 1)] ?? null;
                  const level = rating ? (LEVEL[rating] ?? 0) : null;
                  return (
                    <td key={i} className="py-1.5 px-[2px]">
                      <div
                        className="h-5 rounded-sm bg-rc-brand"
                        style={{
                          // A month with no curve is a hairline, visibly
                          // different from a month that is genuinely dead.
                          opacity: level === null ? 0.06 : 0.12 + level * 0.88,
                        }}
                        title={`${row.species_name}, ${MONTH_NAMES[i]}: ${rating ?? "no data"}`}
                      />
                    </td>
                  );
                })}
                <td className="py-1.5 pl-3 whitespace-nowrap">
                  <StatusPill status={row.status} limit={row.daily_limit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="sr-only">
        {rows
          .map(
            (r) =>
              `${r.species_name}: ${MONTH_NAMES.map(
                (n, i) => `${n} ${r.months[String(i + 1)] ?? "no data"}`,
              ).join(", ")}.`,
          )
          .join(" ")}
      </p>

      {rows.some((r) => r.season_notes) && (
        <ul className="space-y-2 max-w-3xl">
          {rows
            .filter((r) => r.season_notes)
            .map((r) => (
              <li key={r.species_id} className="text-[13px] text-rc-ink-soft">
                <span className="font-medium text-rc-ink">
                  {r.species_name}.
                </span>{" "}
                {/* The stored value is an ensemble of two or three opinions
                    joined by " | ". Only the first is for reading. */}
                {r.season_notes!.split(" | ")[0]}
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({
  status,
  limit,
}: {
  status: BlueCasterCitySeasonRow["status"];
  limit: number | null;
}) {
  if (!status) {
    return <span className="font-rc-mono text-[10px] text-rc-ink-mute">-</span>;
  }
  const tone =
    status === "open"
      ? "border-rc-good-border bg-rc-good-bg text-rc-good-ink"
      : status === "non_retention"
        ? "border-rc-fair-border bg-rc-fair-bg text-rc-fair-ink"
        : "border-rc-poor-border bg-rc-poor-bg text-rc-poor-ink";
  const label =
    status === "open"
      ? limit != null
        ? `Keep ${limit}`
        : "Open"
      : status === "non_retention"
        ? "Release"
        : "Closed";
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 font-rc-mono text-[10px] ${tone}`}
    >
      {label}
    </span>
  );
}

// ── Before you go: areas + licence ────────────────────────────────────────

export function BeforeYouGo({
  areas,
  provinceCode,
  cityName,
}: {
  areas: BlueCasterCityPage["regulatory_areas"];
  provinceCode: string;
  cityName: string;
}) {
  const licence = licenceFor(provinceCode);
  if (!areas.length && !licence) return null;

  const regulator = areas[0]?.body ?? licence?.regulator ?? null;

  return (
    <section className="space-y-4">
      <SectionHeading id="before-you-go">Before you go</SectionHeading>
      <div className="grid gap-4 md:grid-cols-2 items-start">
        {areas.length > 0 && (
          <div className="rounded-lg border border-rc-rule bg-rc-panel p-4">
            <div className="rc-label text-[9px] text-rc-ink-mute">
              Management areas
            </div>
            <p className="text-[14px] text-rc-ink-soft mt-1.5">
              Water around {cityName} falls into{" "}
              {areas.length === 1 ? "one area" : `${areas.length} areas`}, and
              the rules can differ between them.
              {regulator ? ` ${regulator} sets them.` : ""}
            </p>
            <ul className="flex flex-wrap gap-1.5 mt-3">
              {areas.map((a) => (
                <li
                  key={`${a.body}-${a.area_number}`}
                  className="rounded-full border border-rc-rule px-2.5 py-1 font-rc-mono text-[11px] text-rc-ink"
                  // The BC subarea rows carry the number as their name, so a
                  // title of "19-3, 19-3" would be noise.
                  title={a.name && a.name !== a.area_number ? a.name : undefined}
                >
                  {a.area_number}
                  {a.name && a.name !== a.area_number ? ` ${a.name}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {licence && (
          <div className="rounded-lg border border-rc-rule bg-rc-panel p-4">
            <div className="rc-label text-[9px] text-rc-ink-mute">
              Licence you need
            </div>
            <p className="text-[15px] font-semibold text-rc-ink mt-1">
              {licence.name}
            </p>
            <p className="font-rc-mono text-[11px] text-rc-ink-mute mt-0.5">
              {licence.regulator} · {licence.yearLabel}
            </p>
            {licence.residentAnnual && (
              <p className="text-[14px] text-rc-ink-soft mt-2.5">
                Annual, {licence.residentLabel}:{" "}
                <span className="font-semibold text-rc-ink">
                  {licence.residentAnnual}
                </span>
              </p>
            )}
            {licence.addOn && (
              <p className="text-[14px] text-rc-ink-soft mt-1">
                {licence.addOn.name}{" "}
                <span className="font-semibold text-rc-ink">
                  {licence.addOn.fee}
                </span>
                , {licence.addOn.when}
              </p>
            )}
            <p className="text-[13px] text-rc-ink-soft mt-2.5">
              {licence.caveat}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
              <Link
                href={licence.href}
                className="text-[13px] font-medium text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
              >
                Full licence guide
              </Link>
              <a
                href={licence.officialHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[13px] text-rc-ink-mute hover:text-rc-ink underline underline-offset-2"
              >
                Buy from {licence.regulator}
              </a>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────

export function CityFaq({
  faq,
  cityName,
}: {
  faq: Array<{ q: string; a: string }>;
  cityName: string;
}) {
  if (!faq.length) return null;
  return (
    <section className="space-y-4">
      <SectionHeading id="faq">Common questions about {cityName}</SectionHeading>
      <div className="max-w-3xl divide-y divide-rc-rule">
        {faq.map((item) => (
          <details key={item.q} className="group py-3">
            <summary className="cursor-pointer list-none text-[15px] font-medium text-rc-ink marker:hidden flex items-start gap-2">
              <span className="text-rc-ink-mute font-rc-mono text-[13px] mt-[2px] transition-transform group-open:rotate-90">
                ›
              </span>
              {item.q}
            </summary>
            <p className="text-[14px] leading-relaxed text-rc-ink-soft mt-2 pl-5">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ── Nearby cities ─────────────────────────────────────────────────────────

export function NearbyCities({
  cities,
  provincePath,
}: {
  cities: Array<{ slug: string; name: string; spotCount: number }>;
  provincePath: string;
}) {
  if (!cities.length) return null;
  return (
    <section className="space-y-3">
      <SectionHeading id="nearby">Nearby</SectionHeading>
      <ul className="flex flex-wrap gap-2">
        {cities.map((c) => (
          <li key={c.slug}>
            <Link
              href={`${provincePath}/${c.slug}`}
              className="group flex items-baseline gap-2 rounded-full border border-rc-rule bg-rc-panel px-3 py-1.5 hover:border-rc-brand transition-colors"
            >
              <span className="text-[13px] font-medium text-rc-ink group-hover:text-rc-brand transition-colors">
                {c.name}
              </span>
              <span className="font-rc-mono text-[10px] text-rc-ink-mute">
                {c.spotCount} spot{c.spotCount === 1 ? "" : "s"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
