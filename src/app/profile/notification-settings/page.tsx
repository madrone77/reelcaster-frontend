import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-static';

/**
 * Was a redirect to /profile/forecast-emails, which is itself retired now that
 * the scheduled digest is gone. Points at the live alerts surface instead of
 * hopping through a second redirect.
 */
export default function NotificationSettingsRedirect() {
  permanentRedirect('/alerts');
}
