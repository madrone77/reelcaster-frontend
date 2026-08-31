import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-static';

/**
 * Retired surface.
 *
 * Preferences held two cards, and neither described anything the app did.
 *
 * "Default fishing location" wrote favoriteLocation / favoriteHotspot /
 * favoriteLat / favoriteLon into user metadata, and nothing read them back
 * except the Mixpanel user-property call. It also picked from a hardcoded
 * BC-only list, so an angler outside Vancouver Island could not name their own
 * water. The default that actually decides where the app opens is the pinned
 * home spot (`homeSpotSlug`, set from a spot page, read by `use-home-spot`).
 *
 * "Notifications" wrote the `notification_preferences` table, which fed the
 * daily scheduled digest. That job ran every night and reported success, but
 * `last_notification_sent` was null on every row it had ever seen: it never
 * delivered a single email. It also scored days with the legacy Open-Meteo
 * calculation rather than BlueCaster's, and its "include regulation changes"
 * toggle fed a function that always returned an empty list. The digest and its
 * whole pipeline are gone; real-time score alerts at /alerts are the live
 * feature and always were.
 *
 * Sending anglers to the settings hub rather than to one of the remaining
 * pages, since what they wanted here could have been either.
 */
export default function PreferencesRedirect() {
  permanentRedirect('/profile');
}
