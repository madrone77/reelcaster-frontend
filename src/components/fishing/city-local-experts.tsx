import Image from "next/image";
import type { BlueCasterCityPage } from "@/lib/bluecaster";

type Charter = BlueCasterCityPage["charters"][number];

function formatBusinessType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CityLocalExperts({
  charters,
}: {
  charters: Charter[];
}) {
  if (!charters || charters.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-6">
        Local Experts
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {charters.map((charter) => (
          <div
            key={charter.id}
            className="bg-white border border-stone-200 rounded-lg overflow-hidden"
          >
            {/* Photo */}
            <div className="aspect-[4/3] bg-slate-200 relative overflow-hidden">
              {charter.photo_url ? (
                <Image
                  src={charter.photo_url}
                  alt={charter.photo_alt ?? charter.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg
                    className="w-12 h-12 text-slate-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
              )}
            </div>

            {/* Body */}
            <div className="p-4">
              <h3 className="text-base font-semibold text-slate-900">
                {charter.name}
              </h3>

              {charter.business_type && (
                <span className="inline-block mt-1 border border-slate-300 text-slate-600 text-[10px] px-2 py-0.5 uppercase tracking-widest font-medium rounded-full">
                  {formatBusinessType(charter.business_type)}
                </span>
              )}

              {charter.rating != null && charter.review_count != null && (
                <p className="text-sm text-slate-600 mt-2">
                  <span aria-label={`${charter.rating} out of 5 stars`}>
                    {charter.rating}&starf;
                  </span>{" "}
                  rating from {charter.review_count} reviews
                </p>
              )}

              <div className="flex flex-col gap-1 mt-3">
                {charter.phone && (
                  <a
                    href={`tel:${charter.phone}`}
                    className="text-sm text-blue-700 hover:underline"
                  >
                    {charter.phone}
                  </a>
                )}
                {charter.website && (
                  <a
                    href={charter.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-700 hover:underline"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
