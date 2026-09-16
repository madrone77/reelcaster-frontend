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

  // '⌘K' server-side and on the first client render, so hydration matches; a
  // Windows or Linux visitor gets 'Ctrl K' swapped in right after mount. The
  // handler below has always accepted both — only the label was lying.
  const [shortcut, setShortcut] = useState('⌘K');

  useEffect(() => {
    const apple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
    if (!apple) setShortcut('Ctrl K');

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
      {/* Two shapes, one control.

          Below lg it stays icon-only: a 64px bar already carries a mark and a
          CTA, and on the app bar four nav items as well, so a field is what
          pushes it over on a phone. From lg the bar has the room, and the
          field earns it — an icon asks the reader to guess that this product
          knows their water by name, where a field with a placeholder in it
          says so outright. Same button, same handler, same palette; only the
          chrome differs, so there is nothing to keep in sync. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search spots and cities"
        title={`Search (${shortcut})`}
        className={`group flex items-center rounded h-8 text-sm transition-colors gap-2 px-2 lg:h-9 lg:w-64 lg:gap-2.5 lg:rounded-lg lg:border lg:pl-3 lg:pr-2 ${
          brand
            ? 'text-white/80 hover:text-white hover:bg-white/10 lg:border-white/25 lg:bg-white/10 lg:hover:bg-white/20 lg:hover:border-white/40'
            : 'text-rc-ink-soft hover:text-rc-ink hover:bg-rc-page lg:border-rc-rule lg:bg-rc-surface lg:hover:bg-rc-panel lg:hover:border-rc-ink-mute'
        }`}
      >
        <Search className="w-4 h-4 shrink-0" />

        {/* Placeholder, not a label: it reads as the field's resting text, so
            the control looks like the thing it opens. Truncated rather than
            wrapped — the bar's height is fixed. */}
        <span
          className={`hidden lg:block flex-1 text-left truncate text-[13px] ${
            brand ? 'text-white/70 group-hover:text-white/90' : 'text-rc-ink-mute group-hover:text-rc-ink-soft'
          }`}
        >
          Search spots and cities
        </span>

        {/* The hint only shows where a keyboard is likely, and now sits in a
            key cap rather than floating as text, so it reads as a shortcut
            instead of as part of the placeholder. min-w holds the cap's shape
            steady when 'Ctrl K' replaces '⌘K' after mount. */}
        <span
          className={`hidden lg:flex items-center justify-center shrink-0 min-w-[34px] h-[20px] px-1.5 rounded border font-rc-mono text-[10px] tracking-wide ${
            brand
              ? 'border-white/25 bg-white/10 text-white/70'
              : 'border-rc-rule bg-rc-panel text-rc-ink-mute'
          }`}
        >
          {shortcut}
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
