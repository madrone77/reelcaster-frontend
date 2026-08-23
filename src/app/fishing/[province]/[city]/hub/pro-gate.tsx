// The upgrade rail at the bottom of the conversion block.
//
// It sends to the same `/plans/checkout` entry the landing pages use, with
// the region attached. That is not cosmetic: the checkout prices the session
// off the region, BC in CAD and WA in USD, and without it the route falls
// back to geo inference and then to Canadian dollars. A Seattle reader must
// not be quoted CAD from a page that has been speaking Fahrenheit and Marine
// Areas the whole way down.
//
// `from` is the attribution key that lands in the conversion columns, so a
// trial started here is distinguishable from one started on an /lp page.
//
// ── Why the terms are imported ───────────────────────────────────────────
//
// The length, the price and the per-month division all come from
// `src/lib/pricing.ts` rather than being typed into the copy. That module is
// what the checkout route actually charges against, so a price change moves
// this sentence with it. Hardcoding "7 days" and "$33" here is how a landing
// page ends up advertising terms the checkout no longer honours — and on a
// paid page that is a refund conversation, not a typo.

import Link from "next/link";
import {
  ANNUAL_PER_MONTH_CENTS,
  ANNUAL_PRICE_CENTS,
  TRIAL_DAYS,
  currencyLabelForRegion,
  dollars,
} from "@/lib/pricing";
import { PANEL, TYPE } from "./ui";

const FEATURES = [
  "Every hour of the next 14 days, not just today",
  "Every spot in the city, not the top five",
  "Alerts by email or text when your water crosses the score you set",
  "Depth contours and bottom structure under the map",
  "Your own marks scored alongside ours",
];

export default function ProGate({
  provinceCode,
  citySlug,
  variant = "full",
}: {
  provinceCode: string;
  citySlug: string;
  /**
   * `full` is the feature block that closes the conversion column. `banner`
   * is the second ask, after the map.
   *
   * One component rather than two, because the terms line and the checkout
   * href are the parts that must never diverge between them — two CTAs
   * quoting different trial lengths on one page is the kind of thing nobody
   * notices until a customer does.
   */
  variant?: "full" | "banner";
}) {
  const params = new URLSearchParams({
    // Distinct attribution per placement, so the second ask can be judged on
    // its own rather than being credited to the first.
    from: `city-${citySlug}${variant === "banner" ? "-map" : ""}`,
  });
  if (provinceCode) params.set("region", provinceCode);

  const terms = (
    <>
      {dollars(0)} today, then {dollars(ANNUAL_PRICE_CENTS)}{" "}
      {currencyLabelForRegion(provinceCode)} a year, which is{" "}
      {dollars(ANNUAL_PER_MONTH_CENTS)} a month. Card required, cancel any time.
    </>
  );

  if (variant === "banner") {
    return (
      <section className={`bg-rc-navy p-5 text-white sm:p-6 ${PANEL}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-[19px] font-bold">
              That was one day. Pro opens the next fourteen.
            </h2>
            <p className={`${TYPE.body} text-slate-300 mt-1.5 max-w-[46ch]`}>
              Every spot on this map, hour by hour, two weeks out, with alerts
              when your water crosses the score you set.
            </p>
          </div>
          <Link
            href={`/plans/checkout?${params.toString()}`}
            className="shrink-0 rounded-lg bg-rc-emerald px-5 py-3.5 text-center text-[15px] font-bold text-rc-navy-deep hover:brightness-110 transition-all"
          >
            Start your {TRIAL_DAYS}-day free trial
          </Link>
        </div>
        <p className="mt-3 font-rc-mono text-[11px] text-slate-400">{terms}</p>
      </section>
    );
  }

  return (
    <section className={`bg-rc-navy p-5 text-white ${PANEL}`}>
      <span className="font-rc-mono text-[10px] font-semibold uppercase leading-3 tracking-[0.08em] text-rc-emerald">
        Planning past this weekend
      </span>
      <h2 className="mt-1.5 text-[19px] font-bold">
        Unlock the full 14-day radar
      </h2>
      <ul className={`mt-3 space-y-1.5 ${TYPE.body} text-slate-300`}>
        {FEATURES.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="text-rc-emerald shrink-0" aria-hidden>
              &#8226;
            </span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <Link
        href={`/plans/checkout?${params.toString()}`}
        className="mt-4 block rounded-lg bg-rc-emerald px-5 py-3.5 text-center text-[16px] font-bold text-rc-navy-deep hover:brightness-110 transition-all"
      >
        Start your {TRIAL_DAYS}-day free trial
      </Link>

      {/* Said plainly, under the button. A card IS collected at checkout, and
          a trial CTA that implies otherwise converts worse the moment the
          form loads and costs the goodwill on the way out. */}
      <p className="mt-2.5 text-center font-rc-mono text-[11px] text-slate-400">
        {terms}
      </p>
    </section>
  );
}
