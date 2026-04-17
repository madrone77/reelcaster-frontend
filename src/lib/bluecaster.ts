// BlueCaster API client
// The API returns a nested response; we normalize it for components.

export interface BlueCasterCityPage {
  page: {
    slug: string;
    status: string;
    published_at: string | null;
    hero: {
      image_url: string | null;
      image_alt: string | null;
      breadcrumb: Array<{ label: string; href: string }>;
      h1: string;
      species_chips: Array<{ slug: string; name: string }>;
    };
    seo: {
      title: string;
      meta_description: string;
      canonical_url: string | null;
      og_image_url: string | null;
    };
    about_md: string | null;
    local_intel_md: string | null;
    techniques: string[];
    faq: Array<{ q: string; a: string }>;
    last_edited_at: string | null;
  };
  hierarchy: {
    country: { name: string; code: string };
    province: { name: string; code: string };
    region: { name: string | null; slug: string | null };
    city: { name: string; slug: string; lat: number; lng: number };
  };
  conditions_now: {
    temp_c: number;
    wind_kn: number;
    wind_gusts_kn: number;
    water_temp_c: number;
    tide_high: { ft: number; time: string };
    tide_low: { ft: number; time: string };
    tide_now_ft: number;
    swell_m: number;
    fetched_at: string;
  } | null;
  rc_score_today: number | null;
  species_table: Array<{
    species_id: string;
    species_name: string;
    species_slug: string;
    months: Record<string, string | null>;
    daily_limit: number | null;
    size_limit_cm: number | null;
    status: "open" | "non_retention" | "closed" | null;
  }>;
  regulatory_areas: Array<{
    body: string;
    area_number: string;
    name: string;
  }>;
  seasonal_guide: Array<{
    quarter: string;
    label: string;
    quality: string | null;
    peak_species: Array<{ slug: string; name: string }>;
  }>;
  access_points: Array<{
    id: string;
    name: string;
    type: string;
    notes: string | null;
  }>;
  charters: Array<{
    id: string;
    name: string;
    photo_url: string | null;
    photo_alt: string | null;
    rating: number | null;
    review_count: number | null;
    phone: string | null;
    website: string | null;
    business_type: string;
  }>;
  meta: {
    generated_at: string;
  };
}

export async function fetchCityPage(
  slug: string
): Promise<BlueCasterCityPage | null> {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("BlueCaster env vars not set");

  const res = await fetch(`${baseUrl}/api/v1/cities/${slug}/page`, {
    headers: { "x-api-key": apiKey },
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`BlueCaster API error: ${res.status}`);
  return res.json();
}

export async function fetchPublishedCities() {
  const baseUrl = process.env.BLUECASTER_API_URL;
  const apiKey = process.env.BLUECASTER_API_KEY;
  if (!baseUrl || !apiKey) return [];

  const res = await fetch(
    `${baseUrl}/api/v1/admin/city-pages?status=published`,
    {
      headers: { "x-api-key": apiKey },
      next: { revalidate: 300 },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.pages ?? [];
}
