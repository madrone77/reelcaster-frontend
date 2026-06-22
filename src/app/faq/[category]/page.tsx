import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FaqItem } from "../FaqItem";
import { CategoryCard } from "../CategoryCard";
import { FaqOutro } from "../FaqOutro";
import {
  FAQ_CATEGORIES,
  getCategory,
  getItemsByCategory,
  faqPageJsonLd,
} from "../faq-data";

// Only the known categories exist; anything else 404s.
export const dynamicParams = false;

export function generateStaticParams() {
  return FAQ_CATEGORIES.map((c) => ({ category: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) return { title: "FAQ — ReelCaster" };
  const title = `${cat.title} — ReelCaster FAQ`;
  return {
    title,
    description: cat.blurb,
    alternates: { canonical: `/faq/${cat.id}` },
    openGraph: { title, description: cat.blurb, type: "website" },
  };
}

function Wordmark() {
  return (
    <Link
      href="/map"
      className="inline-flex items-baseline text-lg font-extrabold tracking-tight text-rcc-ink"
    >
      Reel<span className="text-rcc-brand">Caster</span>
    </Link>
  );
}

export default async function FaqCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat) notFound();

  const items = getItemsByCategory(cat.id);
  const jsonLd = faqPageJsonLd(items);

  return (
    <main className="min-h-screen pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-rcc-line bg-rcc-surface px-5 pb-10 pt-8">
        <div className="mx-auto max-w-3xl">
          <Wordmark />
          <nav className="mt-6 flex items-center gap-1.5 text-sm text-rcc-faint">
            <Link href="/faq" className="hover:text-rcc-brand">
              FAQ
            </Link>
            <span aria-hidden>/</span>
            <span className="text-rcc-muted">{cat.title}</span>
          </nav>
          <h1 className="mt-3 flex items-center gap-3 text-4xl font-extrabold tracking-tight text-rcc-ink">
            <span aria-hidden>{cat.icon}</span>
            {cat.title}
          </h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-rcc-muted">{cat.blurb}</p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5">
        <div className="mt-8 space-y-3">
          {items.map((it) => (
            <FaqItem key={it.id} item={it} />
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rcc-brand">More topics</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FAQ_CATEGORIES.filter((c) => c.id !== cat.id).map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        </section>

        <FaqOutro />
      </div>
    </main>
  );
}
