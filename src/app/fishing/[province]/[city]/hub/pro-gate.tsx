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
    <section className="rounded-xl border border-rc-rule bg-rc-panel p-5 sm:p-6">
      <h2 className="text-[17px] font-semibold text-rc-ink">
        Planning past this weekend?
      </h2>
      <p className="text-[14px] text-rc-ink-soft mt-2 max-w-[54ch]">
        Pro opens the full 14 days hour by hour, every spot rather than the top
        six, alerts when your water crosses the score you set, and the depth
        contours under the map.
      </p>
      <Link
        href={`/plans/checkout?${params.toString()}`}
        className="inline-block mt-4 rounded-lg bg-rc-brand px-5 py-3 text-[15px] font-semibold text-white hover:bg-rc-brand-hover transition-colors"
      >
        Start the free trial
      </Link>
    </section>
  );
}
