/**
 * Notification Service
 *
 * Core business logic for generating and sending fishing notifications.
 * Handles threshold checking, personalized scoring, and email generation.
 */

import { createClient } from '@supabase/supabase-js';
import type { NotificationPreferences } from './user-preferences';
import { fetchOpenMeteoWeather } from '@/app/utils/openMeteoApi';
import { calculateOpenMeteoFishingScore, createTideDataAtTimestamp } from '@/app/utils/fishingCalculations';
import type { ProcessedOpenMeteoData, OpenMeteo15MinData } from '@/app/utils/openMeteoApi';
import { fetchCHSTideDataByCoordinates, type CHSWaterData } from '@/app/utils/chsTideApi';
import { getRelevantDFONoticesForUser, type DFONotice } from './dfo-notice-service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Create admin client for server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export interface User {
  id: string;
  email: string;
  raw_user_meta_data?: any;
}

export interface UserWithPreferences extends User {
  preferences: NotificationPreferences;
}

export interface ForecastDay {
  date: string;
  score: number;
  avgTemp: number;
  avgWind: number;
  precipitation: number;
  conditions: string;
}

export interface WeatherAlert {
  type: 'thunderstorm' | 'gale' | 'pressure_drop' | 'high_uv';
  message: string;
  severity: 'warning' | 'danger';
}

export interface RegulationChange {
  species_name: string;
  change_type: string;
  old_value: string;
  new_value: string;
  effective_date: string;
}

export interface NotificationData {
  user: UserWithPreferences;
  shouldSend: boolean;
  reason?: string;
  forecastDays?: ForecastDay[];
  bestDay?: ForecastDay;
  weatherAlerts?: WeatherAlert[];
  regulationChanges?: RegulationChange[];
  dfoNotices?: DFONotice[];
}

/**
 * Fetch all users with notifications enabled
 */
export async function getUsersWithNotificationsEnabled(): Promise<UserWithPreferences[]> {
  try {
    // Get all users with email verified
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    // Get notification preferences for all users
    const { data: preferences, error: prefsError } = await supabaseAdmin
      .from('notification_preferences')
      .select('*')
      .eq('notification_enabled', true)
      .eq('email_enabled', true);

    if (prefsError) {
      throw new Error(`Failed to fetch preferences: ${prefsError.message}`);
    }

    // Join users with their preferences
    const usersWithPrefs: UserWithPreferences[] = users
      .filter((user) => {
        const userPrefs = preferences?.find((p) => p.user_id === user.id);
        return userPrefs && user.email; // Ensure user has email
      })
      .map((user) => ({
        id: user.id,
        email: user.email!, // We filtered out users without email above
        raw_user_meta_data: user.user_metadata,
        preferences: preferences!.find((p) => p.user_id === user.id)!,
      }));

    return usersWithPrefs;
  } catch (error) {
    console.error('Error fetching users with notifications:', error);
    throw error;
  }
}

/**
 * Check if a notification is due for a user based on frequency and last sent time
 */
export function shouldSendNotification(
  lastSent: string | null,
  frequency: 'daily' | 'weekly'
): boolean {
  if (!lastSent) {
    return true; // Never sent before
  }

  const lastSentDate = new Date(lastSent);
  const now = new Date();
  const hoursSinceLastSent = (now.getTime() - lastSentDate.getTime()) / (1000 * 60 * 60);

  if (frequency === 'daily') {
    return hoursSinceLastSent >= 23; // Send if >23 hours since last (allows for some drift)
  } else {
    return hoursSinceLastSent >= 167; // Weekly: 7 days = 168 hours, allow 167
  }
}

/**
 * Fetch forecast for user's location
 */
export async function fetchForecastForLocation(
  lat: number,
  lng: number
): Promise<{ forecast: ProcessedOpenMeteoData; tideData: CHSWaterData | null }> {
  try {
    const [result, tideResult] = await Promise.all([
      fetchOpenMeteoWeather({ lat, lon: lng }, 7),
      fetchCHSTideDataByCoordinates(lat, lng).catch(err => {
        console.warn('Tide data not available for notification:', err);
        return null;
      }),
    ]);

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to fetch forecast');
    }
    return { forecast: result.data, tideData: tideResult };
  } catch (error) {
    console.error('Error fetching forecast:', error);
    throw error;
  }
}

/**
 * Check if weather conditions meet user's thresholds
 */
export function checkWeatherThresholds(
  minutelyData: OpenMeteo15MinData[],
  thresholds: NotificationPreferences
): {
  meetsThresholds: boolean;
  alerts: WeatherAlert[];
  bestHours: OpenMeteo15MinData[];
} {
  const alerts: WeatherAlert[] = [];
  const goodHours: OpenMeteo15MinData[] = [];

  for (const data of minutelyData) {
    // Check alerts
    if (thresholds.alert_on_thunderstorm && data.lightningPotential && data.lightningPotential > 500) {
      alerts.push({
        type: 'thunderstorm',
        message: 'Thunderstorm risk detected',
        severity: 'danger',
      });
    }

    if (thresholds.alert_on_gale_warning && data.windSpeed > 60) {
      alerts.push({
        type: 'gale',
        message: 'Gale force winds expected',
        severity: 'danger',
      });
    }

    // Check if hour meets thresholds
    const meetsWind = data.windSpeed <= thresholds.wind_speed_threshold_kph;
    const meetsPrecip = (data.precipitation || 0) <= thresholds.precipitation_threshold_mm;
    const meetsTemp =
      data.temp >= thresholds.temperature_min_c &&
      data.temp <= thresholds.temperature_max_c;

    if (meetsWind && meetsPrecip && meetsTemp) {
      goodHours.push(data);
    }
  }

  return {
    meetsThresholds: goodHours.length > 0,
    alerts: alerts.slice(0, 3), // Limit to 3 alerts
    bestHours: goodHours,
  };
}

/**
 * Calculate fishing scores for each day with user's species preferences
 */
export function calculateDailyScores(
  forecast: ProcessedOpenMeteoData,
  species: string[],
  tideData?: CHSWaterData | null,
): ForecastDay[] {
  const dailyScores: ForecastDay[] = [];

  // Group minutely data by day
  const dayGroups = new Map<string, OpenMeteo15MinData[]>();

  forecast.minutely15.forEach((data) => {
    const date = data.time.split('T')[0];
    if (!dayGroups.has(date)) {
      dayGroups.set(date, []);
    }
    dayGroups.get(date)!.push(data);
  });

  // Calculate score for each day
  dayGroups.forEach((dataPoints, date) => {
    // Get sunrise/sunset for this day from daily data
    const dailyData = forecast.daily.find(d => d.date === date);
    const sunrise = dailyData?.sunrise ? new Date(dailyData.sunrise).getTime() / 1000 : 0;
    const sunset = dailyData?.sunset ? new Date(dailyData.sunset).getTime() / 1000 : 0;

    // Calculate scores for each species and average them
    const scores = species.length > 0
      ? species.map((sp) =>
          dataPoints.map((dp) => {
            const tideForSlot = tideData ? createTideDataAtTimestamp(tideData, dp.timestamp) : null;
            return calculateOpenMeteoFishingScore(
              dp,
              sunrise,
              sunset,
              tideForSlot ?? tideData ?? null,
              sp
            ).total;
          })
        )
      : [
          dataPoints.map((dp) => {
            const tideForSlot = tideData ? createTideDataAtTimestamp(tideData, dp.timestamp) : null;
            return calculateOpenMeteoFishingScore(
              dp,
              sunrise,
              sunset,
              tideForSlot ?? tideData ?? null,
              null
            ).total;
          }),
        ];

    // Average scores across species and time periods
    const allScores = scores.flat();
    const avgScore = allScores.reduce((sum, s) => sum + s, 0) / allScores.length;

    // Calculate weather averages
    const avgTemp =
      dataPoints.reduce((sum, dp) => sum + dp.temp, 0) / dataPoints.length;
    const avgWind =
      dataPoints.reduce((sum, dp) => sum + dp.windSpeed, 0) / dataPoints.length;
    const totalPrecip = dataPoints.reduce((sum, dp) => sum + (dp.precipitation || 0), 0);

    // Determine conditions. Same three bands and the same 75/55 cuts as
    // `tierFor`, so a digest and the spot page it links to cannot use
    // different words for the same number.
    let conditions = 'Good';
    if (avgScore >= 75) conditions = 'Good';
    else if (avgScore >= 55) conditions = 'Fair';
    else conditions = 'Poor';

    dailyScores.push({
      date,
      score: Math.round(avgScore),
      avgTemp: Math.round(avgTemp * 10) / 10,
      avgWind: Math.round(avgWind * 10) / 10,
      precipitation: Math.round(totalPrecip * 10) / 10,
      conditions,
    });
  });

  return dailyScores.slice(0, 7); // Return next 7 days
}

/**
 * Fetch regulation changes since last notification
 */
export async function fetchRegulationChanges(
  lastNotificationSent: string | null
): Promise<RegulationChange[]> {
  try {
    if (!lastNotificationSent) {
      return []; // No baseline to compare against
    }

    // Query regulations table for changes since last notification
    // Note: This is a simplified version. In production, you'd want a dedicated
    // regulation_changes table that tracks diffs
    const { error } = await supabaseAdmin
      .from('fishing_regulations')
      .select('*, species_regulations(*)')
      .gte('updated_at', lastNotificationSent)
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching regulation changes:', error);
      return [];
    }

    // For now, return empty array. Proper implementation would compare
    // previous and current regulation states
    return [];
  } catch (error) {
    console.error('Error fetching regulation changes:', error);
    return [];
  }
}

/**
 * Generate notification data for a user
 */
export async function generateNotificationForUser(
  user: UserWithPreferences
): Promise<NotificationData> {
  try {
    const prefs = user.preferences;

    // Check if notification is due
    const isDue = shouldSendNotification(
      prefs.last_notification_sent || null,
      prefs.notification_frequency
    );

    if (!isDue) {
      return {
        user,
        shouldSend: false,
        reason: 'Notification not due yet',
      };
    }

    // Fetch forecast for user's location
    if (!prefs.location_lat || !prefs.location_lng) {
      return {
        user,
        shouldSend: false,
        reason: 'No location set',
      };
    }

    const { forecast, tideData } = await fetchForecastForLocation(prefs.location_lat, prefs.location_lng);

    // Calculate daily scores (now with tide data for accurate scoring)
    const dailyScores = calculateDailyScores(forecast, prefs.favorite_species, tideData);

    // Find best day
    const bestDay = dailyScores.reduce((best, day) => (day.score > best.score ? day : best));

    // Check if best day meets fishing score threshold
    if (bestDay.score < prefs.fishing_score_threshold) {
      return {
        user,
        shouldSend: false,
        reason: `Best fishing score (${bestDay.score}) below threshold (${prefs.fishing_score_threshold})`,
        forecastDays: dailyScores,
        bestDay,
      };
    }

    // Check weather thresholds
    const { meetsThresholds, alerts } = checkWeatherThresholds(forecast.minutely15, prefs);

    if (!meetsThresholds) {
      return {
        user,
        shouldSend: false,
        reason: 'Weather conditions do not meet thresholds',
        forecastDays: dailyScores,
        bestDay,
        weatherAlerts: alerts,
      };
    }

    // Fetch regulation changes if enabled
    const regulationChanges = prefs.include_regulation_changes
      ? await fetchRegulationChanges(prefs.last_notification_sent || null)
      : [];

    // Fetch DFO notices if enabled
    const dfoNotices = prefs.dfo_notices_enabled
      ? await getRelevantDFONoticesForUser(prefs)
      : [];

    // All checks passed - should send notification
    return {
      user,
      shouldSend: true,
      forecastDays: dailyScores,
      bestDay,
      weatherAlerts: alerts,
      regulationChanges,
      dfoNotices,
    };
  } catch (error) {
    console.error(`Error generating notification for user ${user.id}:`, error);
    return {
      user,
      shouldSend: false,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Update last notification sent timestamp
 */
export async function updateLastNotificationSent(userId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from('notification_preferences')
      .update({ last_notification_sent: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) {
      console.error(`Error updating last_notification_sent for user ${userId}:`, error);
    }
  } catch (error) {
    console.error(`Error updating last_notification_sent for user ${userId}:`, error);
  }
}
