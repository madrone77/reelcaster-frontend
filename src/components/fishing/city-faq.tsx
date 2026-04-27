import type { BlueCasterCityPage } from "@/lib/bluecaster";

type FaqEntry = BlueCasterCityPage["page"]["faq"][number];

export default function CityFaq({ faq }: { faq: FaqEntry[] }) {
  if (!faq || faq.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
        Frequently Asked Questions
      </h2>

      <dl className="space-y-2">
        {faq.map((entry, i) => (
          <details
            key={entry.q.slice(0, 40).replace(/\s+/g, "-").toLowerCase()}
            className="group border border-stone-200 rounded-lg overflow-hidden"
            {...(i === 0 ? { open: true } : {})}
          >
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-stone-50 transition-colors list-none [&::-webkit-details-marker]:hidden">
              <dt className="text-sm font-semibold text-slate-900 pr-4">
                {entry.q}
              </dt>
              <svg
                className="w-4 h-4 text-slate-400 shrink-0 transition-transform group-open:rotate-180"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </summary>
            <dd className="px-5 pb-4 pt-0 border-t border-stone-100">
              <p className="text-sm leading-relaxed text-slate-600 mt-3">
                {entry.a}
              </p>
            </dd>
          </details>
        ))}
      </dl>
    </section>
  );
}
