// The breadcrumb above a city page. Server component: it was inside the
// client shell purely because the shell used to be the whole page, and the
// one thing a crawler most needs in the markup has no reason to wait on
// hydration.
//
// The H1 and the spot count used to live here. They moved into the bite
// radar directly below, which is now the first card on the page and states
// the same facts with today's answer attached. A page has one H1, and it
// belongs on the thing the reader came for.
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
}: {
  city: FishingCity;
  provincePath: string;
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
    </header>
  );
}
