// Renders an FAQ answer (FaqPara[]) with light inline markup:
//   **bold**            → <strong> (or a mailto link if it's an email)
//   [text](/href)       → internal <Link> / external <a>
// Pure + presentational, so it works in both server and client trees.

import type { ReactNode } from "react";
import Link from "next/link";
import type { FaqPara } from "./faq-data";

const INLINE = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_CLASS =
  "font-medium text-rcc-brand underline underline-offset-2 hover:text-rcc-brand/80";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      // **bold** — render an email as a mailto link, otherwise plain strong
      nodes.push(
        EMAIL.test(m[1]) ? (
          <a key={`${keyPrefix}-m${i}`} href={`mailto:${m[1]}`} className={`font-semibold ${LINK_CLASS}`}>
            {m[1]}
          </a>
        ) : (
          <strong key={`${keyPrefix}-b${i}`} className="font-semibold text-rcc-ink">
            {m[1]}
          </strong>
        ),
      );
    } else if (m[2] !== undefined && m[3] !== undefined) {
      const text2 = m[2];
      const href = m[3];
      nodes.push(
        href.startsWith("/") ? (
          <Link key={`${keyPrefix}-l${i}`} href={href} className={LINK_CLASS}>
            {text2}
          </Link>
        ) : (
          <a key={`${keyPrefix}-l${i}`} href={href} className={LINK_CLASS}>
            {text2}
          </a>
        ),
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function Answer({ paras }: { paras: FaqPara[] }) {
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-rcc-muted">
      {paras.map((para, idx) =>
        typeof para === "string" ? (
          <p key={idx}>{renderInline(para, `p${idx}`)}</p>
        ) : (
          <ul key={idx} className="space-y-1.5">
            {para.list.map((li, j) => (
              <li key={j} className="flex gap-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-rcc-brand/40" aria-hidden />
                <span className="min-w-0 flex-1">{renderInline(li, `p${idx}-${j}`)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
