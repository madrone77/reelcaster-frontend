// A single FAQ entry as a native <details> accordion — zero JS, fully in
// the DOM for SEO and accessibility. Used by the static page, the category
// pages, and the client search results alike.

import { Answer } from "./Answer";
import { getCategory, type FaqItem as FaqItemT } from "./faq-data";

function ComingSoonBadge() {
  return (
    <span className="shrink-0 rounded-full bg-rcc-fair-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rcc-fair">
      Coming soon
    </span>
  );
}

function Chevron() {
  return (
    <svg
      className="mt-0.5 h-5 w-5 shrink-0 text-rcc-faint transition-transform duration-200 group-[[open]]:rotate-180"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FaqItem({
  item,
  showCategory = false,
  defaultOpen = false,
}: {
  item: FaqItemT;
  showCategory?: boolean;
  defaultOpen?: boolean;
}) {
  const cat = showCategory ? getCategory(item.category) : undefined;
  return (
    <details
      id={item.id}
      open={defaultOpen}
      className="group scroll-mt-24 rounded-2xl border border-rcc-line bg-rcc-surface px-5 shadow-sm transition-shadow open:shadow-md"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 py-4 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold text-rcc-ink">{item.q}</span>
            {item.status === "soon" && <ComingSoonBadge />}
          </span>
          {cat && (
            <span className="mt-1 block text-xs text-rcc-faint">
              {cat.icon} {cat.title}
            </span>
          )}
        </span>
        <Chevron />
      </summary>
      <div className="pb-5">
        <Answer paras={item.a} />
      </div>
    </details>
  );
}
