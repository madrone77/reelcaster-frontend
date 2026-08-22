'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { btn } from '@/app/components/ui/button';

/**
 * The app's last line of defence against a client-side throw.
 *
 * There was none before, which cost more than a broken page. With no boundary
 * in the tree, Next renders its built-in global error page, and that page
 * emits its own `<html><head></head>` — the document head is REPLACED, so the
 * title, meta description, canonical and JSON-LD are all discarded, and the
 * body becomes one sentence: "Application error: a client-side exception has
 * occurred". Google rendered the homepage during one such moment and used that
 * sentence as the site's search description until the next successful render.
 *
 * This boundary sits under the root layout instead of over it, which is the
 * detail that matters: the layout — and with it the head — keeps rendering, so
 * a crash costs the page's content, never its metadata. A crawler that lands
 * mid-failure still reads the right title and description.
 *
 * It deliberately does not try to explain the fault. Whatever threw is already
 * in the console and, for a `?diag=1` session, already posted to
 * /api/client-error (see lib/client-diag.ts).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error] client exception:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 py-24 text-center">
      <p className="font-rc-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-rc-brand">
        Something went wrong
      </p>
      <h1 className="mt-4 text-balance text-3xl font-black leading-[1.15] tracking-[-0.02em] text-rc-ink">
        This page stopped loading.
      </h1>
      <p className="mt-5 text-pretty text-sm leading-relaxed text-rc-ink-soft md:text-base">
        The forecast is fine — this is our end. Reloading usually clears it.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={reset} className={btn.primary}>
          Try again
        </button>
        <Link href="/" className={btn.secondary}>
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
