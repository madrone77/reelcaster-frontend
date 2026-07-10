'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { AppShell } from '@/app/components/layout';
import DashboardHeader from '@/app/components/forecast/dashboard-header';
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
      <AppShell showLocationPanel={false}>
        <div className="flex-1 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-lg text-rc-text">Loading settings...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell showLocationPanel={false}>
      <div className="flex-1 min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <DashboardHeader
          title="Forecast Emails"
          showTimeframe={false}
          showSetLocation={false}
        />

        <div className="max-w-6xl mx-auto space-y-6">
          {/* Cross-link to real-time Alerts (Phase 6 disambiguation). */}
          <div
            className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3"
            data-testid="forecast-emails-alerts-callout"
          >
            <div className="flex-1">
              <p className="text-sm text-rc-text font-medium">
                Looking for real-time alerts?
              </p>
              <p className="text-sm text-rc-text-muted mt-1">
                These are scheduled forecast digests (daily / weekly). Bite-condition triggers,
                pressure-drop pings, and SMS notifications live in{' '}
                <a href="/alerts" className="text-blue-400 hover:text-blue-300 underline">
                  Alerts
                </a>
                .
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-rc-bg-dark rounded-lg border border-rc-bg-light p-6">
            <NotificationPreferencesForm />
          </div>

          {/* Help Section */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-400 mb-2">
              How Fishing Notifications Work
            </h3>
            <ul className="text-xs text-rc-text-muted space-y-1.5 list-disc list-inside">
              <li>
                <strong className="text-rc-text">Scheduled Notifications:</strong> Receive daily or weekly emails based on
                your preferred time
              </li>
              <li>
                <strong className="text-rc-text">Threshold Filtering:</strong> Only get notified when conditions meet your
                preferences
              </li>
              <li>
                <strong className="text-rc-text">Species-Specific:</strong> Forecasts tailored to your favorite species
              </li>
              <li>
                <strong className="text-rc-text">Location-Based:</strong> Forecasts for your selected area and radius
              </li>
              <li>
                <strong className="text-rc-text">Regulation Updates:</strong> Stay informed about rule changes in your area
              </li>
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
