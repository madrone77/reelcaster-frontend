import type { Metadata } from "next";
import { headers } from "next/headers";
import { readEdgeGeo } from "@/lib/edge-geo";
import Quiz from "./_quiz/quiz";
import { loadQuizData } from "./_quiz/quiz-data";

/**
 * `/lp/q?city=<slug>` -- the link-builder shape of the quiz, rendered here.
 *
 * It used to redirect to /lp/q/<city>; a paid click now reads the quiz at
 * the address it arrived on. Reads searchParams, so it renders per request;
 * that is the cost of not hopping, and only the doorway shape pays it. The
 * ads point at /lp/q/<city>, which stays ISR.
 */
export const metadata: Metadata = {
  title: "Your Fishing Plan",
  description: "Six quick questions, then a fishing plan built for how you fish.",
  robots: { index: false, follow: false },
};

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default async function LpQuizEntry({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.city) ? sp.city[0] : sp.city;
  const named = (raw ?? "").trim().toLowerCase();
  const country = readEdgeGeo(await headers()).country?.toUpperCase();
  const fallback = country === "CA" ? "vancouver-bc" : "seattle-wa";

  let data = SLUG_SHAPE.test(named) ? await loadQuizData(named) : null;
  if (!data) data = await loadQuizData(fallback);
  if (!data) data = await loadQuizData(country === "CA" ? "seattle-wa" : "vancouver-bc");
  if (!data) return null;
  return <Quiz data={data} />;
}
