import { supabase } from './supabase'

export interface UserPreferences {
  favoriteLocation?: string
  favoriteHotspot?: string
  favoriteSpecies?: string
  favoriteLat?: number
  favoriteLon?: number
  notificationsEnabled?: boolean
  emailForecasts?: boolean
  notificationTime?: string // Format: "HH:MM" (24-hour format)
  timezone?: string
  // Unit preferences
  windUnit?: 'kph' | 'mph' | 'knots'
  tempUnit?: 'C' | 'F'
  precipUnit?: 'mm' | 'inches'
  heightUnit?: 'ft' | 'm'
  distanceUnit?: 'km' | 'miles'
  pressureUnit?: 'mb' | 'inHg'
}

export interface NotificationPreferences {
  id?: string
  user_id?: string
  notification_enabled: boolean
  email_enabled: boolean
  push_enabled: boolean
  notification_frequency: 'daily' | 'weekly'
  notification_time: string
  timezone: string
  location_lat: number | null
  location_lng: number | null
  location_radius_km: number
  location_name: string | null
  favorite_species: string[]
  wind_speed_threshold_kph: number
  wave_height_threshold_m: number
  precipitation_threshold_mm: number
  temperature_min_c: number
  temperature_max_c: number
  fishing_score_threshold: number
  uv_index_threshold: number
  alert_on_thunderstorm: boolean
  alert_on_gale_warning: boolean
  alert_on_pressure_drop: boolean
  include_regulation_changes: boolean
  dfo_notices_enabled: boolean
  dfo_areas_of_interest: number[]
  last_notification_sent?: string | null
  created_at?: string
  updated_at?: string
}

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  notification_enabled: false,
  email_enabled: true,
  push_enabled: false,
  notification_frequency: 'weekly',
  notification_time: '06:00:00',
  timezone: 'America/Vancouver',
  location_lat: 48.4284, // Default to Victoria, BC
  location_lng: -123.3656,
  location_radius_km: 25.0,
  location_name: 'Victoria, BC',
  favorite_species: [],
  wind_speed_threshold_kph: 30.0,
  wave_height_threshold_m: 1.5,
  precipitation_threshold_mm: 5.0,
  temperature_min_c: 5.0,
  temperature_max_c: 25.0,
  fishing_score_threshold: 60,
  uv_index_threshold: 6,
  alert_on_thunderstorm: true,
  alert_on_gale_warning: true,
  alert_on_pressure_drop: true,
  include_regulation_changes: true,
  dfo_notices_enabled: true,
  dfo_areas_of_interest: [19, 20], // Default to Victoria and Sooke areas
  last_notification_sent: null,
}

const DEFAULT_PREFERENCES: UserPreferences = {
  favoriteLocation: 'Victoria, Sidney',
  favoriteHotspot: 'Waterfront',
  favoriteLat: 48.4284,
  favoriteLon: -123.3656,
  notificationsEnabled: true,
  emailForecasts: false,
  notificationTime: '06:00',
  timezone: 'America/Vancouver',
  // Marine-convention defaults — match what the product surfaces render when
  // no preference is set (keep in step with DEFAULT_UNITS in
  // contexts/unit-preferences-context.tsx).
  windUnit: 'knots',
  tempUnit: 'C',
  precipUnit: 'mm',
  heightUnit: 'm',
  distanceUnit: 'km',
  pressureUnit: 'mb',
}

export class UserPreferencesService {
  
  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return DEFAULT_PREFERENCES
      }

      // Try to get preferences from user metadata
      const preferences = user.user_metadata?.preferences as UserPreferences
      
      if (preferences) {
        return { ...DEFAULT_PREFERENCES, ...preferences }
      }

      return DEFAULT_PREFERENCES
    } catch (error) {
      console.error('Error getting user preferences:', error)
      return DEFAULT_PREFERENCES
    }
  }

  static async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      // Get current preferences
      const currentPreferences = user.user_metadata?.preferences as UserPreferences || {}
      
      // Merge with new preferences
      const updatedPreferences = { ...currentPreferences, ...preferences }

      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: {
          preferences: updatedPreferences
        }
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating user preferences:', error)
      return { success: false, error: 'Failed to update preferences' }
    }
  }

  static async getDefaultLocation(): Promise<{
    location: string
    hotspot: string
    lat: number
    lon: number
    species?: string
  }> {
    const preferences = await this.getUserPreferences()

    return {
      location: preferences.favoriteLocation || DEFAULT_PREFERENCES.favoriteLocation!,
      hotspot: preferences.favoriteHotspot || DEFAULT_PREFERENCES.favoriteHotspot!,
      lat: preferences.favoriteLat || DEFAULT_PREFERENCES.favoriteLat!,
      lon: preferences.favoriteLon || DEFAULT_PREFERENCES.favoriteLon!,
      species: preferences.favoriteSpecies,
    }
  }

  // ========== Notification Preferences Methods ==========

  /**
   * Get user's notification preferences from the notification_preferences table
   * Returns default preferences if none exist
   */
  static async getNotificationPreferences(): Promise<NotificationPreferences> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return DEFAULT_NOTIFICATION_PREFERENCES as NotificationPreferences
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching notification preferences:', error)
        return DEFAULT_NOTIFICATION_PREFERENCES as NotificationPreferences
      }

      if (!data) {
        // No preferences exist yet, return defaults
        return DEFAULT_NOTIFICATION_PREFERENCES as NotificationPreferences
      }

      return data as NotificationPreferences
    } catch (error) {
      console.error('Error getting notification preferences:', error)
      return DEFAULT_NOTIFICATION_PREFERENCES as NotificationPreferences
    }
  }

  /**
   * Create or update notification preferences
   * If preferences don't exist, creates them. Otherwise updates existing record.
   */
  static async upsertNotificationPreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; error?: string; data?: NotificationPreferences }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      // Check if preferences already exist
      const { data: existing } = await supabase
        .from('notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      const preferencesData = {
        ...preferences,
        user_id: user.id,
      }

      if (existing) {
        // Update existing record
        const { data, error } = await supabase
          .from('notification_preferences')
          .update(preferencesData)
          .eq('user_id', user.id)
          .select()
          .single()

        if (error) {
          console.error('Error updating notification preferences:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as NotificationPreferences }
      } else {
        // Insert new record with defaults merged with provided preferences
        const newPreferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...preferencesData,
        }

        const { data, error } = await supabase
          .from('notification_preferences')
          .insert(newPreferences)
          .select()
          .single()

        if (error) {
          console.error('Error creating notification preferences:', error)
          return { success: false, error: error.message }
        }

        return { success: true, data: data as NotificationPreferences }
      }
    } catch (error) {
      console.error('Error upserting notification preferences:', error)
      return { success: false, error: 'Failed to save notification preferences' }
    }
  }

  /**
   * Update only specific fields in notification preferences
   */
  static async updateNotificationPreferences(
    updates: Partial<NotificationPreferences>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      const { error } = await supabase
        .from('notification_preferences')
        .update(updates)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error updating notification preferences:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error updating notification preferences:', error)
      return { success: false, error: 'Failed to update notification preferences' }
    }
  }

  /**
   * Delete user's notification preferences
   */
  static async deleteNotificationPreferences(): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return { success: false, error: 'User not authenticated' }
      }

      const { error } = await supabase
        .from('notification_preferences')
        .delete()
        .eq('user_id', user.id)

      if (error) {
        console.error('Error deleting notification preferences:', error)
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      console.error('Error deleting notification preferences:', error)
      return { success: false, error: 'Failed to delete notification preferences' }
    }
  }
}