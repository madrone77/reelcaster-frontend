'use client';

import { useEffect, useState } from 'react';
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
 *
 * ONE FAULT IS HEALED HERE RATHER THAN SHOWN: a chunk that no longer exists.
 * A reader whose HTML came from one deploy and who then lazily imports a chunk
 * (the trial modal, a sheet) after the next deploy gets a 404 for it, and the
 * dynamic import throws a ChunkLoadError. Three merges in ten minutes on
 * 2026-09-19 painted this page in the admin split-test frames for exactly
 * that reason, and every reader on the site during a deploy is exposed the
 * same way. Nothing is wrong with the page; the fix is a fresh load, so the
 * reader gets one, once. Skew Protection on the Vercel project covers the
 * common case; this covers a reader who outlives its window, and any browser
 * that dropped the deployment cookie.
 *
 * Once, guarded by sessionStorage, so a chunk that is genuinely missing does
 * not spin the reader in a reload loop. Storage can be refused (iOS "Block All
 * Cookies" makes the getter throw), and then the page is shown instead.
 */

const RELOADED_KEY = 'rc_chunk_reloaded';

/** A dynamic import that 404'd: webpack's ChunkLoadError, or Next's wording of it. */
function isStaleChunk(error: Error): boolean {
  const text = `${error.name} ${error.message}`;
  return (
    error.name === 'ChunkLoadError' ||
    /Loading (CSS )?chunk [^ ]+ failed/i.test(text) ||
    /Failed to fetch dynamically imported module/i.test(text)
  );
}

/**
 * Reload for a stale chunk if this tab has not already done so for this
 * page. Returns true when a reload was issued, so the caller can hold the
 * error copy off the screen while the page turns over.
 */
function reloadOnceForStaleChunk(error: Error): boolean {
  if (!isStaleChunk(error)) return false;
  try {
    const key = `${RELOADED_KEY}:${window.location.pathname}`;
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error('[app/error] client exception:', error);
    if (reloadOnceForStaleChunk(error)) setReloading(true);
  }, [error]);

  // The reload is on its way; a flash of "stopped loading" would only alarm a
  // reader whose page is about to come back on its own.
  if (reloading) return <main className="min-h-[60vh]" aria-busy="true" />;

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
