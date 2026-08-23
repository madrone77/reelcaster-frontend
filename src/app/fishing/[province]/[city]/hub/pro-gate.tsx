// The upgrade rail at the bottom of the conversion block.
//
// It sends to the same `/plans/checkout` entry the landing pages use, with
// the region attached. That is not cosmetic: the checkout prices the session
// off the region, BC in CAD and WA in USD, and without it the route falls
// back to geo inference and then to Canadian dollars. A Seattle reader must
// not be quoted CAD from a page that has been speaking Fahrenheit and
// Marine Areas the whole way down.
//
// `from` is the attribution key that lands in the conversion columns, so a
// trial started here is distinguishable from one started on an /lp page.

import Link from "next/link";
import { PANEL, TYPE } from "./ui";

export default function ProGate({
  provinceCode,
  citySlug,
}: {
  provinceCode: string;
  citySlug: string;
}) {
  const params = new URLSearchParams({ from: `city-${citySlug}` });
  if (provinceCode) params.set("region", provinceCode);

  return (
    <section className={`bg-rc-navy p-5 text-white ${PANEL}`}>
      <span className="font-rc-mono text-[10px] font-semibold uppercase leading-3 tracking-[0.08em] text-rc-emerald">
        Planning past this weekend
      </span>
      <h2 className="mt-1.5 text-[19px] font-bold">
        Unlock the full 14-day radar
      </h2>
      <ul className={`mt-3 space-y-1.5 ${TYPE.body} text-slate-300`}>
        {[
          "Every hour of the next 14 days, not just today",
          "Every spot in the city, not the top five",
          "Alerts by email or text when your water crosses the score you set",
          "Depth contours under the map",
        ].map((line) => (
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
        className="inline-block mt-4 rounded-lg bg-rc-emerald px-5 py-3 text-[15px] font-semibold text-rc-navy-deep hover:brightness-110 transition-all"
      >
        Start the free trial
      </Link>
    </section>
  );
}
