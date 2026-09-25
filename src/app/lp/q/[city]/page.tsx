import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvinceByCode } from "@/app/fishing/lib/fishing-data";
import Quiz from "../_quiz/quiz";
import CityHop from "../_quiz/city-hop";
import { loadQuizData } from "../_quiz/quiz-data";

/**
 * `/lp/q/<city>` -- the quiz landing page.
 *
 * Six taps, then a result page written for the persona the answers add up
 * to, with the reader's best spot today and a button onto the map at that
 * spot. The logic is in ../_quiz/persona.ts, the data in ../_quiz/quiz-data.ts
 * and the screens in ../_quiz/quiz.tsx.
 *
 * Takes the full slug (`seattle-wa`) or the bare city (`seattle`), since the
 * short form is what someone types into an ad manager. A bare name that
 * matches exactly one covered city redirects to the full slug, so each city
 * has one URL and one row in the counter. The hop is client-side so the
 * query string survives it (see ../_quiz/city-hop.tsx).
 *
 * Never hopped to Explore for Meta traffic (src/lib/meta-lp-hop.ts): the quiz
 * IS the Meta experiment.
 *
 * ISR, never searchParams. Reading them here would opt every ad click out of
 * the cache; the query string is read on the client by the telemetry.
 * noindex comes from src/app/lp/layout.tsx.
 */

type PageProps = { params: Promise<{ city: string }> };

export const revalidate = 900;

export const metadata: Metadata = {
  title: "Your Fishing Plan",
  description: "Six quick questions, then the best spot for how you fish, scored for today.",
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
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) notFound();

  const data = await loadQuizData(slug);
  if (!data) {
    const full = await fullSlugFor(slug);
    if (full && full !== slug) return <CityHop to={`/lp/q/${full}`} />;
    notFound();
  }

  return <Quiz data={data} />;
}
