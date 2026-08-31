import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-static';

/**
 * The scheduled forecast digest is retired. It never sent an email in
 * production, so there is no subscriber to disappoint here, only bookmarks and
 * old links to catch. Real-time score alerts are the live feature.
 *
 * See settings/preferences/page.tsx for the full account.
 */
export default function ForecastEmailsRedirect() {
  permanentRedirect('/alerts');
}
