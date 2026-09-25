import type { Metadata } from "next";
import { fetchHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvinceByCode } from "@/app/fishing/lib/fishing-data";
import Quiz from "../_quiz/quiz";
import NearestHop from "../_quiz/nearest-hop";
import { loadQuizData } from "../_quiz/quiz-data";

/**
 * `/lp/q/<city>` -- the quiz landing page.
 *
 * Six taps, then a result page written for the persona the answers add up
 * to, ending in the 7-day Pro trial. The logic is in ../_quiz/persona.ts, the data in ../_quiz/quiz-data.ts
 * and the screens in ../_quiz/quiz.tsx.
 *
 * Takes the full slug (`seattle-wa`) or the bare city (`seattle`), since the
 * short form is what goes in the ads. A bare name that matches exactly one
 * covered city renders that city's quiz directly, with no redirect. Anything
 * else (`/lp/q/1` was in a live ad) hops to the visitor's nearest city rather
 * than 404ing a paid click; see ../_quiz/nearest-hop.tsx.
 *
 * ISR, never searchParams. Reading them here would opt every ad click out of
 * the cache; the query string is read on the client by the telemetry.
 * noindex comes from src/app/lp/layout.tsx.
 */

type PageProps = { params: Promise<{ city: string }> };

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Your Fishing Plan",
  description: "Six quick questions, then a fishing plan built for how you fish.",
};

async function fullSlugFor(bare: string): Promise<string | null> {
  try {
    const hierarchy = await fetchHierarchy();
    const slugs = COVERED_PROVINCES.flatMap(
      (code) => getFishingProvinceByCode(hierarchy, code)?.cities?.map((c) => c.slug) ?? [],
    );
    const hits = slugs.filter((s) => s.startsWith(`${bare}-`) && /^[a-z]{2}$/.test(s.slice(bare.length + 1)));
    return hits.length === 1 ? hits[0] : null;
  } catch {
    return null;
  }
}

export default async function LpQuizPage({ params }: PageProps) {
  const { city: raw } = await params;
  const slug = raw.trim().toLowerCase();
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return <NearestHop />;

  // The bare city (`seattle`) is the URL the ads carry, so it renders the
  // quiz itself rather than hopping to `seattle-wa`: a redirect is a second
  // page load on the one click we paid for. The counter and checkout read
  // `data.citySlug`, which is always the full slug, so both URLs count as one
  // city.
  let data = await loadQuizData(slug);
  if (!data) {
    const full = await fullSlugFor(slug);
    if (full && full !== slug) data = await loadQuizData(full);
  }
  if (!data) return <NearestHop />;

  return <Quiz data={data} />;
}
