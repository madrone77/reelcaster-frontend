import Image from "next/image";
import type { BlueCasterCityPage } from "@/lib/bluecaster";

export default function CityHero({ data }: { data: BlueCasterCityPage }) {
  const { hero } = data.page;
  const { city, province } = data.hierarchy;

  const breadcrumbText = [province.name, city.name]
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();

  return (
    <section className="relative w-full h-[400px] md:h-[500px] overflow-hidden">
      {/* Background */}
      {hero.image_url ? (
        <Image
          src={hero.image_url}
          alt={hero.image_alt ?? `Fishing in ${city.name}`}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-slate-800" />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full max-w-6xl mx-auto px-6 pb-10 md:pb-14">
        {/* Breadcrumb */}
        <p className="text-stone-300 text-xs tracking-[0.25em] uppercase font-medium mb-3">
          {breadcrumbText}
        </p>

        {/* Title */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase text-white leading-none tracking-tight">
          {hero.h1 || `Fishing ${city.name}`}
        </h1>

        {/* Species chips */}
        {hero.species_chips && hero.species_chips.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {hero.species_chips.map((species) => (
              <span
                key={species.slug}
                className="border border-white/40 text-white text-xs px-3 py-1 uppercase tracking-widest font-medium rounded-full"
              >
                {species.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
