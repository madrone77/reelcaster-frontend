// Breadcrumb and H1 for a city page. Server component: it was inside the
// client shell purely because the shell used to be the whole page, and the
// one thing a crawler most needs in the markup has no reason to wait on
// hydration.
//
// No photo. There is deliberately no hero image on these pages, and the
// social card is generated rather than photographed: a generic harbour shot
// tells an angler nothing, and sourcing one per city is a licensing
// dependency on every new city we launch.

import Link from "next/link";
import type { FishingCity } from "../../lib/fishing-data";

export default function CityHeader({
  city,
  provincePath,
  spotCount,
}: {
  city: FishingCity;
  provincePath: string;
  spotCount: number;
}) {
  return (
    <header>
      <nav
        aria-label="Breadcrumb"
        className="font-rc-mono text-[11px] text-rc-ink-mute"
      >
        <ol className="flex items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-rc-ink transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={provincePath}
              className="hover:text-rc-ink transition-colors"
            >
              Fishing in {city.provinceName}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-rc-ink-soft" aria-current="page">
            {city.name}
          </li>
        </ol>
      </nav>

      <h1 className="text-3xl sm:text-4xl font-bold text-rc-ink mt-2">
        Fishing in {city.name}, {city.provinceCode}
      </h1>
      <p className="font-rc-mono text-[12px] text-rc-ink-soft mt-1.5">
        {spotCount} spot{spotCount === 1 ? "" : "s"} · {city.regionName}
      </p>
    </header>
  );
}
