import Link from "next/link";
import type { BlueCasterSpotPage } from "@/lib/bluecaster";

const STATE_LABEL: Record<string, string> = {
  peak: "Peak",
  mid: "In season",
  off: "Off season",
  closed: "Closed",
};

const STATE_TONE: Record<string, string> = {
  peak: "text-blue-700",
  mid: "text-emerald-700",
  off: "text-stone-500",
  closed: "text-stone-400",
};

export default function SpotScoreCta({
  score,
  spotSlug,
}: {
  score: BlueCasterSpotPage["rc_score_now"];
  spotSlug: string;
}) {
  // Convert 0..1 score to 0..100 display.
  const displayScore =
    score && Number.isFinite(score.score)
      ? Math.round(score.score * 100)
      : null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-8">
      <div className="border-y border-stone-200 py-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div>
            <p className="font-mono text-xs tracking-widest uppercase text-slate-400 mb-2">
              RC Score Now
            </p>
            {score ? (
              <div className="flex flex-col gap-1">
                <div className="text-sm text-slate-700 font-semibold">
                  {score.species_name}
                </div>
                <div
                  className={`text-xs font-mono tracking-widest uppercase ${
                    STATE_TONE[score.state] ?? "text-slate-500"
                  }`}
                >
                  {STATE_LABEL[score.state] ?? score.state}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400">No live score</div>
            )}
          </div>
          <div
            className={`text-6xl md:text-7xl font-black tracking-tight font-mono ${
              displayScore == null ? "text-slate-300" : "text-slate-900"
            }`}
          >
            {displayScore != null ? displayScore : "--"}
          </div>
        </div>

        <Link
          href={`/signup?from=fishing&spot=${spotSlug}`}
          className="border border-slate-400 text-slate-700 text-sm px-6 py-3 uppercase tracking-widest font-medium hover:bg-slate-100 transition-colors rounded"
        >
          Unlock 14-Day Forecast &rarr;
        </Link>
      </div>
    </section>
  );
}
