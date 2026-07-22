'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import ExploreTopBar from '@/app/explore/components/explore-top-bar';
import NotificationPreferencesForm from '@/app/components/notifications/notification-preferences-form';

export default function NotificationSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Redirect to home if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-rc-page">
        <ExploreTopBar />
        <main className="pt-16">
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-rc-brand border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-sm text-rc-ink-mute">Loading settings…</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-dvh bg-rc-page">
      <ExploreTopBar />
      <main className="pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold tracking-[-0.02em] text-rc-ink">Forecast Emails</h1>
            <div className="mt-1.5 font-rc-mono text-[12px] text-rc-ink-mute">
              Scheduled daily / weekly forecast digests
            </div>
          </div>

          {/* Cross-link to real-time Alerts (Phase 6 disambiguation). */}
          <div
            className="bg-rc-fair-bg border border-rc-fair-border rounded-lg p-4 flex items-start gap-3"
            data-testid="forecast-emails-alerts-callout"
          >
            <div className="flex-1">
              <p className="text-sm text-rc-fair-ink font-medium">
                Looking for real-time alerts?
              </p>
              <p className="text-sm text-rc-ink-soft mt-1">
                These are scheduled forecast digests (daily / weekly). Bite-condition triggers,
                pressure-drop pings, and SMS notifications live in{' '}
                <a href="/alerts" className="text-rc-brand hover:underline">
                  Alerts
                </a>
                .
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-rc-panel rounded-xl border border-rc-rule p-6">
            <NotificationPreferencesForm />
          </div>

          {/* Help Section */}
          <div className="mt-6 p-4 bg-rc-surface border border-rc-rule rounded-lg">
            <h3 className="text-sm font-semibold text-rc-ink mb-2">
              How Fishing Notifications Work
            </h3>
            <ul className="text-xs text-rc-ink-mute space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-rc-ink">Scheduled Notifications:</strong> Receive daily or weekly emails based on
                your preferred time
              </li>
              <li>
                <strong className="text-rc-ink">Threshold Filtering:</strong> Only get notified when conditions meet your
                preferences
              </li>
              <li>
                <strong className="text-rc-ink">Species-Specific:</strong> Forecasts tailored to your favorite species
              </li>
              <li>
                <strong className="text-rc-ink">Location-Based:</strong> Forecasts for your selected area and radius
              </li>
              <li>
                <strong className="text-rc-ink">Regulation Updates:</strong> Stay informed about rule changes in your area
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
