import type { Metadata } from 'next';
import { fetchHierarchy } from '@/lib/bluecaster';
import { COVERED_PROVINCES } from '@/lib/regions';
import AlertsClient, { type AlertsSpot } from './alerts-client';

export const metadata: Metadata = {
  title: 'Alerts',
  description: 'Get notified when fishing scores peak at your favorite spots.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function AlertsPage() {
  const hierarchy = await fetchHierarchy();
  const spots: AlertsSpot[] = [];

  if (hierarchy) {
    for (const country of hierarchy.countries) {
      for (const sp of country.states_provinces) {
        const isCovered = COVERED_PROVINCES.includes(sp.code as 'BC' | 'WA' | 'OR');
        if (!isCovered) continue;
        for (const region of sp.regions) {
          for (const city of region.cities) {
            for (const spot of city.spots) {
              if (!spot.is_published) continue;
              spots.push({
                slug: spot.slug,
                name: spot.name,
                lat: spot.lat,
                lng: spot.lng,
                city_name: city.name,
                province_code: sp.code,
              });
            }
          }
        }
      }
    }
  }

  spots.sort((a, b) => a.name.localeCompare(b.name));

  return <AlertsClient spots={spots} />;
}
