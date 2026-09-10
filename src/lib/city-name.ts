/**
 * "sooke-bc" → "Sooke". The map payload carries `city_slug` but no city name,
 * and the only endpoint that resolves names is a second round trip for a label.
 * Every city slug in the covered extent is `<name>-<province>` (checked against
 * all nine: bellingham-wa … victoria-bc), so the province code comes off the
 * end and the rest title-cases. A slug that ever breaks that shape degrades to
 * a readable title-cased string rather than to nothing.
 *
 * Lived in app/dashboard/around-you until the paywall header needed it too.
 * It could not stay there: that module pulls in <ProTrialModal>, and the
 * header is inside that modal, so the import would have closed a cycle.
 */
export function cityName(slug: string): string {
  return slug
    .replace(/-(bc|wa|or|ca|ak)$/i, "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
