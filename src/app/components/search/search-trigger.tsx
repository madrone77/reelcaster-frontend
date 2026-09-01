'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';

// ssr:false because the palette portals to <body> and reads `document` on its
// first render. Nothing is downloaded until someone opens it.
const GlobalSearch = dynamic(
  () => import('@/app/components/search/global-search'),
  { ssr: false },
);

/**
 * The search control, and the palette it opens.
 *
 * One component rather than two copies of this wiring, because both bars that
 * carry search — ExploreTopBar on the app surfaces, MarketingHeader on the
 * public ones — need the same three things: the button, the cmd/ctrl-K
 * shortcut, and the `openGlobalSearch` event so a control outside their tree
 * can open it too. Two copies would mean two palettes mounted on any page that
 * ever renders both bars, and cmd-K opening both.
 *
 * The palette lived on AppShell until FE #506. No page has rendered that shell
 * since the app moved off it, so search was unreachable in the product for as
 * long as that was true. Keeping the trigger and the palette in one file is
 * what stops them drifting apart again.
 */
export default function SearchTrigger({ brand = false }: { brand?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    const onEvent = () => setOpen(true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('openGlobalSearch', onEvent);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('openGlobalSearch', onEvent);
    };
  }, []);

  return (
    <>
      {/* Icon-only. A 64px bar already carries a mark and a CTA, and on the app
          bar four nav items as well; a full search field is what pushes it over
          on a phone. The shortcut hint only shows where a keyboard is likely. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search spots, cities and species"
        className={`flex items-center gap-2 rounded px-2 h-8 text-sm transition-colors ${
          brand
            ? 'text-white/80 hover:text-white hover:bg-white/10'
            : 'text-rc-ink-soft hover:text-rc-ink hover:bg-rc-page'
        }`}
      >
        <Search className="w-4 h-4" />
        <span
          className={`hidden lg:inline font-rc-mono text-[10px] tracking-wide ${
            brand ? 'text-white/60' : 'text-rc-ink-mute'
          }`}
        >
          ⌘K
        </span>
      </button>

      {/* Mounted only once opened. `dynamic()` fetches its chunk when the
          component first RENDERS, not when a prop turns true, so leaving a
          closed <GlobalSearch> in the tree would pull the palette — and the
          waitlist modal it lazy-loads — onto every marketing and SEO page for
          a reader who never searches. */}
      {open && <GlobalSearch open onClose={() => setOpen(false)} />}
    </>
  );
}
