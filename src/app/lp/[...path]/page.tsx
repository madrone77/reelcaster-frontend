import type { Metadata } from "next";
import { headers } from "next/headers";
import CityLanding, {
  cityLandingMetadata,
} from "@/app/fishing/[country]/[state]/[city]/ad/city-landing";
import { fetchHierarchy } from "@/lib/bluecaster";
import { COVERED_PROVINCES } from "@/lib/regions";
import { getFishingProvinceByCode } from "@/app/fishing/lib/fishing-data";
import { readEdgeGeo } from "@/lib/edge-geo";

/**
 * Every /lp URL an ad was ever bought against renders THE landing page: the
 * framed city page with the trial sheet (../fishing/.../ad/city-landing).
 *
 * The ads point at /lp/seattle/1, /lp/vancouver/4, /lp/seattle/5,
 * /lp/5?city=seattle-wa, /lp/7/victoria-bc and so on, and re-pointing an ad
 * restarts its learning, so those addresses stay. What changed on
 * 2026-09-25 is what answers them: this page, directly, at the URL the click
 * carried. Until then a click here met up to three hops (a config redirect,
 * the Meta hop to Explore, a split's coin toss) before anything rendered,
 * and each hop was a place to lose the click or the record of it.
 *
 * The city is read off the path or `?city=`, whichever the URL has:
 *
 *   /lp/seattle/5          city-first: a bare name, "seattle" -> seattle-wa
 *   /lp/5/seattle-wa       variant-first: the API slug in the path
 *   /lp/5?city=seattle-wa  the doorway shape the link builder writes
 *   /lp/6, /lp/anything    nothing named: the reader's own country decides
 *
 * A name that matches no covered city never 404s a paid click; it falls to
 * the country default the same way. The quiz keeps its own route at /lp/q.
 *
 * Counted under the /lp key the ad was bought against ("lpseattle5"), so a
 * campaign's row on Campaign results is unbroken across the change.
 */

type PageProps = {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const CA_DEFAULT = "vancouver-bc";
const US_DEFAULT = "seattle-wa";

function first(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

/** Every covered city's API slug ("seattle-wa"). */
async function coveredSlugs(): Promise<string[]> {
  try {
    const hierarchy = await fetchHierarchy();
    return COVERED_PROVINCES.flatMap(
      (code) => getFishingProvinceByCode(hierarchy, code)?.cities?.map((c) => c.slug) ?? [],
    );
  } catch {
    return [];
  }
}

/**
 * The covered city a path or query names, or null.
 *
 * A full slug matches itself. A bare name ("seattle") matches the one slug
 * that is it plus a two-letter region ("seattle-wa"); a name that matches
 * several is nobody's, and falls through.
 */
function matchCity(raw: string, slugs: string[]): string | null {
  const name = raw.trim().toLowerCase();
  if (!SLUG_SHAPE.test(name)) return null;
  if (slugs.includes(name)) return name;
  const hits = slugs.filter(
    (s) => s.startsWith(`${name}-`) && /^[a-z]{2}$/.test(s.slice(name.length + 1)),
  );
  return hits.length === 1 ? hits[0] : null;
}

async function resolveCity(
  path: string[],
  sp: Record<string, string | string[] | undefined>,
): Promise<string> {
  const slugs = await coveredSlugs();
  const [head = "", second = ""] = path;
  const candidates = /^[0-9]{1,2}$/.test(head) ? [second, first(sp.city)] : [head, first(sp.city)];
  for (const c of candidates) {
    const hit = c ? matchCity(c, slugs) : null;
    if (hit) return hit;
  }
  const country = readEdgeGeo(await headers()).country?.toUpperCase();
  return country === "CA" ? CA_DEFAULT : US_DEFAULT;
}

/**
 * The campaign key this URL was bought as. City-first keeps its old key
 * ("lpseattle5"); variant-first keeps "lp5"; anything else is "lp" plus the
 * path, letters and digits only, so the counter's shape test accepts it.
 */
function landingKey(path: string[]): string {
  const [head = "", second = ""] = path;
  const key = /^[0-9]{1,2}$/.test(head)
    ? `lp${head}`
    : `lp${(head + second).replace(/[^a-z0-9]/g, "")}`;
  return key.slice(0, 25) || "lp";
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { path } = await params;
  const sp = await searchParams;
  const slug = await resolveCity(path, sp);
  return cityLandingMetadata({ city: { slug }, searchParams: sp });
}

export default async function LpLandingPage({ params, searchParams }: PageProps) {
  const { path } = await params;
  const sp = await searchParams;
  const slug = await resolveCity(path, sp);
  return <CityLanding city={{ slug }} searchParams={sp} landing={landingKey(path)} />;
}
