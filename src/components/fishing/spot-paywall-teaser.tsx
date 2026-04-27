"use client";

import { useState } from "react";
import Link from "next/link";
import { useSubscription } from "@/hooks/use-subscription";

const FEATURES = [
  "14-day hourly forecasts with full breakdowns",
  "Unlimited custom alerts (email + SMS)",
  "Custom spot profiles with tide & DFO data",
  "Pro Intel for BC, WA, and OR",
];

export default function SpotPaywallTeaser({
  spotSlug,
  speciesSlug,
}: {
  spotSlug: string;
  speciesSlug?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { isPaid, loading: subLoading } = useSubscription();

  // Don't flash the teaser to paid users while subscription state hydrates.
  if (subLoading || isPaid) return null;

  const pricingHref = `/pricing?from=spot&spot=${encodeURIComponent(spotSlug)}${
    speciesSlug ? `&species=${encodeURIComponent(speciesSlug)}` : ""
  }`;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="bg-white border border-stone-200 rounded-lg p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
        <div>
          <p className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-2">
            Pro Intel · Season Pass
          </p>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
            See the full 14-day picture
          </h2>
          <p className="text-sm md:text-base text-slate-600 max-w-xl">
            Unlock day-by-day forecasts, unlimited alerts, and custom spot
            profiles. Monthly seasonal pricing from $5/mo or save with a Season
            Pass.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="self-start md:self-auto inline-flex items-center justify-center px-5 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
        >
          Unlock Pro Intel
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paywall-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-white rounded-lg shadow-xl border border-stone-200 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
              aria-label="Close"
            >
              <svg
                width={18}
                height={18}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>

            <p className="font-mono text-xs uppercase tracking-widest text-slate-500 mb-2">
              ReelCaster Pro Intel
            </p>
            <h3
              id="paywall-title"
              className="text-xl font-black uppercase tracking-tight text-slate-900 mb-3"
            >
              Unlock the full forecast
            </h3>

            <ul className="space-y-2 text-sm text-slate-700 mb-6">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span
                    className="text-emerald-500 mt-0.5"
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href={pricingHref}
              className="block text-center px-5 py-3 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              See Pro Intel pricing
            </Link>
            <p className="mt-3 text-center text-xs text-slate-400">
              Available in BC, WA, and OR. Drop a waitlist pin for other
              regions.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
