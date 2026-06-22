import type { Metadata } from "next";
import Link from "next/link";
import { FaqSearch } from "./FaqSearch";
import { FaqItem } from "./FaqItem";
import { CategoryCard } from "./CategoryCard";
import { FaqOutro } from "./FaqOutro";
import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  getFeaturedItems,
  faqPageJsonLd,
} from "./faq-data";

export const metadata: Metadata = {
  title: "ReelCaster FAQ — How the BC fishing forecast works",
  description:
    "Answers about ReelCaster: how the score is calculated, what it costs, which BC waters we cover, where our data comes from, and how regulations and alerts work.",
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "ReelCaster FAQ",
    description:
      "How the score works, what it costs, where we cover, data sources, regulations, and alerts.",
    type: "website",
  },
};

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

export default function FaqPage() {
  const featured = getFeaturedItems();
  const jsonLd = faqPageJsonLd(featured);

  return (
    <main className="min-h-screen pb-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-rcc-line bg-rcc-surface px-5 pb-10 pt-8">
        <div className="mx-auto max-w-3xl">
          <Wordmark />
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-rcc-ink">
            Questions &amp; answers
          </h1>
          <p className="mt-3 max-w-xl text-lg leading-relaxed text-rcc-muted">
            How ReelCaster scores the bite, what it costs, where we cover, and how the data works.
            Search below, or browse by topic.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-5">
        <div className="-mt-5">
          <FaqSearch allItems={FAQ_ITEMS}>
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rcc-brand">
                Most asked
              </h2>
              <div className="mt-4 space-y-3">
                {featured.map((it) => (
                  <FaqItem key={it.id} item={it} />
                ))}
              </div>
            </section>

            <section className="mt-12">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-rcc-brand">
                Browse by topic
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {FAQ_CATEGORIES.map((c) => (
                  <CategoryCard key={c.id} category={c} />
                ))}
              </div>
            </section>
          </FaqSearch>
        </div>

        <FaqOutro />
      </div>
    </main>
  );
}
