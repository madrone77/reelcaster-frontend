'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Mail, Smartphone, Clock, Save, Loader2, CheckCircle } from 'lucide-react';
import { UserPreferencesService, type NotificationPreferences } from '@/lib/user-preferences';
import NotificationLocationSelector from './notification-location-selector';
import SpeciesSelector from './species-selector';
import WeatherThresholdSliders from './weather-threshold-sliders';
import RegulatoryPreferences from './regulatory-preferences';

const NotificationPreferencesForm: React.FC = () => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await UserPreferencesService.getNotificationPreferences();
      setPreferences(prefs);
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setError(null);
      setSaved(false);

      const result = await UserPreferencesService.upsertNotificationPreferences(preferences);

      if (result.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000); // Clear success message after 3s
      } else {
        setError(result.error || 'Failed to save preferences');
      }
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K]
  ) => {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-rc-brand" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="p-4 bg-rc-poor-bg border border-rc-poor/40 rounded-lg">
        <p className="text-rc-poor-ink text-sm">Failed to load notification preferences.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Master Toggle */}
      <div className="bg-rc-surface border border-rc-rule rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {preferences.notification_enabled ? (
              <div className="p-3 bg-rc-brand-soft rounded-full">
                <Bell className="w-6 h-6 text-rc-brand" />
              </div>
            ) : (
              <div className="p-3 bg-rc-surface rounded-full">
                <BellOff className="w-6 h-6 text-rc-ink-mute" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-semibold text-rc-ink">Fishing Notifications</h2>
              <p className="text-sm text-rc-ink-soft mt-1">
                {preferences.notification_enabled
                  ? 'Notifications are enabled'
                  : 'Turn on notifications to receive fishing alerts'}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.notification_enabled}
              onChange={(e) => updatePreference('notification_enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-14 h-7 bg-rc-rule peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-rc-brand/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-rc-rule after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-rc-brand"></div>
          </label>
        </div>
      </div>

      {/* Settings - Only show if notifications are enabled */}
      {preferences.notification_enabled && (
        <>
          {/* Notification Types */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-rc-ink">Notification Types</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <label className="flex items-center justify-between p-4 bg-rc-surface rounded-lg cursor-pointer border-2 border-rc-rule">
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-rc-brand" />
                  <div>
                    <div className="text-sm font-medium text-rc-ink">Email</div>
                    <div className="text-xs text-rc-ink-mute">Receive emails</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.email_enabled}
                  onChange={(e) => updatePreference('email_enabled', e.target.checked)}
                  className="w-5 h-5 rounded text-rc-brand border-rc-rule"
                />
              </label>

              {/* Push (disabled) */}
              <div className="flex items-center justify-between p-4 bg-rc-surface rounded-lg border-2 border-rc-rule opacity-50 cursor-not-allowed">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-rc-ink-mute" />
                  <div>
                    <div className="text-sm font-medium text-rc-ink-mute">Push Notifications</div>
                    <div className="text-xs text-rc-ink-mute">Coming soon</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  className="w-5 h-5 rounded text-rc-ink-mute"
                />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-rc-ink">Schedule</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-rc-ink-soft mb-2">Frequency</label>
                <select
                  value={preferences.notification_frequency}
                  onChange={(e) =>
                    updatePreference(
                      'notification_frequency',
                      e.target.value as 'daily' | 'weekly'
                    )
                  }
                  className="w-full px-4 py-2 bg-rc-panel border border-rc-rule text-rc-ink rounded-lg focus:ring-2 focus:ring-rc-brand/30 focus:border-rc-brand"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-rc-ink-soft mb-2">
                  Notification Time
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-rc-ink-mute" />
                  <input
                    type="time"
                    value={preferences.notification_time}
                    onChange={(e) => updatePreference('notification_time', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-rc-panel border border-rc-rule text-rc-ink rounded-lg focus:ring-2 focus:ring-rc-brand/30 focus:border-rc-brand"
                  />
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-rc-ink-soft mb-2">Timezone</label>
              <select
                value={preferences.timezone}
                onChange={(e) => updatePreference('timezone', e.target.value)}
                className="w-full px-4 py-2 bg-rc-panel border border-rc-rule text-rc-ink rounded-lg focus:ring-2 focus:ring-rc-brand/30 focus:border-rc-brand"
              >
                <option value="America/Vancouver">Pacific Time (Vancouver)</option>
                <option value="America/Edmonton">Mountain Time (Edmonton)</option>
                <option value="America/Winnipeg">Central Time (Winnipeg)</option>
                <option value="America/Toronto">Eastern Time (Toronto)</option>
                <option value="America/Halifax">Atlantic Time (Halifax)</option>
              </select>
            </div>
          </div>

          {/* Location Section */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-rc-ink">Notification Location</h3>
            <NotificationLocationSelector
              initialLat={preferences.location_lat || undefined}
              initialLng={preferences.location_lng || undefined}
              initialRadius={preferences.location_radius_km}
              onLocationChange={(lat, lng, radius) => {
                updatePreference('location_lat', lat);
                updatePreference('location_lng', lng);
                updatePreference('location_radius_km', radius);
              }}
            />
          </div>

          {/* Species Section */}
          <div className="space-y-4">
            <SpeciesSelector
              selectedSpecies={preferences.favorite_species}
              onChange={(species) => updatePreference('favorite_species', species)}
            />
          </div>

          {/* Weather Thresholds Section */}
          <div className="space-y-4">
            <WeatherThresholdSliders
              thresholds={{
                wind_speed_threshold_kph: preferences.wind_speed_threshold_kph,
                wave_height_threshold_m: preferences.wave_height_threshold_m,
                precipitation_threshold_mm: preferences.precipitation_threshold_mm,
                temperature_min_c: preferences.temperature_min_c,
                temperature_max_c: preferences.temperature_max_c,
                fishing_score_threshold: preferences.fishing_score_threshold,
                uv_index_threshold: preferences.uv_index_threshold,
                alert_on_thunderstorm: preferences.alert_on_thunderstorm,
                alert_on_gale_warning: preferences.alert_on_gale_warning,
                alert_on_pressure_drop: preferences.alert_on_pressure_drop,
              }}
              onChange={(thresholds) => {
                // Update all thresholds in a single state update
                setPreferences({ ...preferences, ...thresholds });
              }}
            />
          </div>

          {/* Regulatory Section */}
          <div className="space-y-4">
            <RegulatoryPreferences
              includeRegulationChanges={preferences.include_regulation_changes}
              onChange={(include) => updatePreference('include_regulation_changes', include)}
            />
          </div>
        </>
      )}

      {/* Save Button */}
      {/* The only bottom-pinned control in the app outside Explore, so it is
          the one thing `viewportFit: cover` at the root can put under the iOS
          home indicator. Pad for the inset rather than let the indicator sit
          on the button. */}
      <div className="sticky bottom-0 bg-rc-panel border-t border-rc-rule pt-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] -mx-4 px-4 sm:-mx-6 sm:px-6">
        {error && (
          <div className="mb-4 p-3 bg-rc-poor-bg border border-rc-poor/40 rounded-lg">
            <p className="text-sm text-rc-poor-ink">{error}</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-rc-brand hover:bg-rc-brand-hover text-white rounded-lg disabled:bg-rc-rule disabled:text-rc-ink-mute disabled:cursor-not-allowed transition-all font-medium"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <CheckCircle className="w-5 h-5" />
              Saved Successfully!
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Preferences
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default NotificationPreferencesForm;
