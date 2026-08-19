import fs from 'node:fs';
import path from 'node:path';
import Link from 'next/link';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  LEGAL_DETAILS_COMPLETE,
  fillLegalPlaceholders,
  stripLeadingTitle,
} from '@/lib/legal-contact';

/**
 * Renders one of the markdown documents in `src/content/legal/`.
 *
 * The markdown is the canonical text (it is what goes to counsel for review);
 * this component is only presentation. Read happens at module scope on the
 * server, so it runs once at build time for these statically rendered pages.
 */

const LEGAL_DIR = path.join(process.cwd(), 'src', 'content', 'legal');

export function readLegalDocument(slug: string): string {
  const raw = fs.readFileSync(path.join(LEGAL_DIR, `${slug}.md`), 'utf8');
  return stripLeadingTitle(fillLegalPlaceholders(raw));
}

const link =
  'text-rc-brand hover:text-rc-brand-hover underline underline-offset-2';

export function LegalDocument({ markdown }: { markdown: string }) {
  return (
    <div className="space-y-5 text-sm md:text-base text-rc-ink-soft leading-relaxed">
      {!LEGAL_DETAILS_COMPLETE && <PlaceholderWarning />}

      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-xl md:text-2xl font-bold text-rc-ink pt-8 first:pt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base md:text-lg font-bold text-rc-ink pt-4">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mt-3">{children}</p>,
          ul: ({ children }) => (
            <ul className="mt-3 list-disc pl-6 space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-3 list-decimal pl-6 space-y-1.5">{children}</ol>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-rc-ink">{children}</strong>
          ),
          hr: () => <hr className="my-10 border-rc-ink-mute/20" />,
          blockquote: ({ children }) => (
            <blockquote className="mt-4 border-l-2 border-rc-brand/40 pl-4 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => {
            const target = href ?? '#';
            // Internal routes go through <Link>; everything else is external
            // and gets the usual noopener treatment.
            if (target.startsWith('/')) {
              return (
                <Link href={target} className={link}>
                  {children}
                </Link>
              );
            }
            return (
              <a
                href={target}
                className={link}
                {...(target.startsWith('http')
                  ? { target: '_blank', rel: 'noopener noreferrer' }
                  : {})}
              >
                {children}
              </a>
            );
          },
          // Tables carry the retention schedule and the processor list, so they
          // must stay readable on a phone. The wrapper scrolls, the page does not.
          table: ({ children }) => (
            <div className="mt-5 -mx-6 px-6 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-rc-ink-mute/30">{children}</thead>
          ),
          tr: ({ children }) => (
            <tr className="border-b border-rc-ink-mute/15 last:border-0">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="py-2 pr-4 font-semibold text-rc-ink align-top">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2 pr-4 align-top">{children}</td>
          ),
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}

/**
 * Visible, deliberately ugly. These documents must not go live carrying
 * placeholder contact details, so the warning is on the page itself rather
 * than in a comment nobody reads.
 */
function PlaceholderWarning() {
  return (
    <div
      data-testid="legal-placeholder-warning"
      className="rounded-md border-2 border-red-500 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <strong className="font-bold">Draft, not in force.</strong> This document
      still contains placeholder contact details and has not been finalised. It
      is published for review only and does not yet form a binding agreement.
    </div>
  );
}
