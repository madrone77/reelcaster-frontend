import Link from "next/link";
import { countByCategory, type FaqCategory } from "./faq-data";

export function CategoryCard({ category }: { category: FaqCategory }) {
  const n = countByCategory(category.id);
  return (
    <Link
      href={`/faq/${category.id}`}
      className="group flex items-start gap-3 rounded-2xl border border-rcc-line bg-rcc-surface p-4 shadow-sm transition hover:border-rcc-brand/40 hover:shadow-md"
    >
      <span className="text-2xl leading-none" aria-hidden>
        {category.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="font-semibold text-rcc-ink group-hover:text-rcc-brand">{category.title}</span>
          <span className="shrink-0 rounded-full bg-rcc-bg px-2 py-0.5 text-xs font-medium text-rcc-muted">
            {n}
          </span>
        </span>
        <span className="mt-0.5 block text-sm leading-snug text-rcc-muted">{category.blurb}</span>
      </span>
    </Link>
  );
}
