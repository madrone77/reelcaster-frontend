import Link from "next/link";

export default function CityScoreCta({
  score,
  citySlug,
}: {
  score: number | null;
  citySlug: string;
}) {
  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className="border-y border-stone-200 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* RC Score teaser */}
        <div className="flex items-center gap-4">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-slate-400 mb-2">
              RC Score Today
            </p>
            <div className="flex items-end gap-1">
              {[40, 65, 85, 55, 70].map((h, i) => (
                <div
                  key={i}
                  className="w-3 rounded-sm bg-slate-300"
                  style={{ height: `${h * 0.4}px` }}
                />
              ))}
            </div>
          </div>
          <div className="text-4xl font-black text-slate-300 tracking-tight font-mono">
            {score != null ? score : "--"}
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/signup?from=fishing&city=${citySlug}`}
          className="border border-slate-400 text-slate-700 text-sm px-6 py-3 uppercase tracking-widest font-medium hover:bg-slate-100 transition-colors rounded"
        >
          Unlock 14-Day Forecast &rarr;
        </Link>
      </div>
    </section>
  );
}
