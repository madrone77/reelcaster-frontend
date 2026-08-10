import { ExternalLink } from "lucide-react";
import type { FeeTable } from "./types";

/**
 * Presentation shared by every /fishing-licence/<region> guide.
 *
 * These started life inside the BC page. Washington needs the identical
 * furniture — same fee grids, same numbered buy-steps, same regulator links —
 * and two copies would have drifted the moment one region's fees changed
 * shape. Anything genuinely region-specific stays in that region's page.
 */

/** External link to a regulator, marked so it reads as leaving the site. */
export function Source({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-1 text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
    >
      {children}
      <ExternalLink className="w-3 h-3 self-center shrink-0" aria-hidden />
    </a>
  );
}

/**
 * Fee grid. Scrolls horizontally on compact rather than wrapping — a fee table
 * that reflows puts a price under the wrong column heading, which is worse than
 * a scrollbar.
 *
 * Only use this for pure numbers with short labels. Rows carrying a sentence
 * belong in a card list: a table column starves prose to two words a line on a
 * phone.
 */
export function Fees({
  table,
  caption,
  // Spelling follows the jurisdiction, not the site: DFO writes "licence",
  // WDFW writes "license". Defaulting to the Canadian form keeps the BC page
  // unchanged and forces the WA page to say what it means.
  termHeader = "Licence",
}: {
  table: FeeTable;
  caption: string;
  termHeader?: string;
}) {
  return (
    <div className="mt-5">
      <div className="overflow-x-auto rounded-xl border border-rc-rule bg-rc-panel">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-rc-rule">
              <th
                scope="col"
                className="text-left font-rc-mono text-[11px] uppercase tracking-[0.08em] text-rc-ink-mute px-4 py-3"
              >
                {termHeader}
              </th>
              {table.columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="text-right font-rc-mono text-[11px] uppercase tracking-[0.08em] text-rc-ink-mute px-4 py-3 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr
                key={row.term}
                className="border-b border-rc-rule-soft last:border-b-0"
              >
                <th
                  scope="row"
                  className="text-left font-medium text-rc-ink px-4 py-3 whitespace-nowrap"
                >
                  {row.term}
                </th>
                {row.prices.map((p, i) => (
                  <td
                    key={table.columns[i]}
                    className="text-right font-rc-mono tabular-nums text-rc-ink px-4 py-3 whitespace-nowrap"
                  >
                    {p}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1.5">
        {table.notes.map((n) => (
          <li key={n} className="text-[13px] leading-relaxed text-rc-ink-mute">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Numbered how-to-buy list. */
export function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="mt-5 space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-4">
          <span
            className="shrink-0 w-7 h-7 rounded-full bg-rc-brand-soft text-rc-brand font-rc-mono text-xs font-bold grid place-items-center"
            aria-hidden
          >
            {i + 1}
          </span>
          <div className="text-[15px] leading-relaxed text-rc-ink-soft pt-0.5">
            {s}
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * Section heading with an anchor. `scroll-mt-24` clears the sticky marketing
 * header — without it a jump-list click parks the heading underneath it.
 */
export function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-2xl md:text-3xl font-black tracking-[-0.02em] text-rc-ink"
    >
      {children}
    </h2>
  );
}

/**
 * A card list for rows that are mostly prose with a figure attached —
 * endorsements, surcharges, per-species rules.
 *
 * Stacked on compact, label-left/figure-right from medium up. Explicit rather
 * than relying on flex-wrap: with wrap alone a short label keeps its figure
 * inline while a long one pushes it to the next line, so the list rendered
 * ragged row to row.
 */
export function DetailCards({
  items,
}: {
  items: Array<{
    /** Card title. Also the React key, so it must be unique in the list. */
    name: string;
    /** Right-hand figures, label → value. Rendered mono and tabular. */
    figures: Array<{ label: string; value: string }>;
    /** The prose. */
    detail: React.ReactNode;
  }>;
}) {
  return (
    <ul className="mt-5 space-y-3">
      {items.map((item) => (
        <li
          key={item.name}
          className="rounded-xl border border-rc-rule bg-rc-panel p-5"
        >
          <div className="flex flex-col gap-y-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-6">
            <h4 className="font-medium text-rc-ink">{item.name}</h4>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 font-rc-mono text-[13px] tabular-nums">
              {item.figures.map((f) => (
                <div
                  key={f.label}
                  className="flex items-baseline gap-1.5 whitespace-nowrap"
                >
                  <dt className="text-rc-ink-mute">{f.label}</dt>
                  <dd className="text-rc-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-rc-ink-soft">
            {item.detail}
          </p>
        </li>
      ))}
    </ul>
  );
}
