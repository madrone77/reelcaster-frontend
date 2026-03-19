// Forecast Cache Service - Handles caching of fishing forecast data
import { supabase } from '@/lib/supabase'
import { ProcessedOpenMeteoData } from './openMeteoApi'
import { OpenMeteoDailyForecast } from './fishingCalculations'
import { CHSWaterData } from './chsTideApi'

const defaultCacheDurationHours = parseInt(process.env.FORECAST_CACHE_DURATION_HOURS || '6')

export interface CacheEntry {
  id: string
  cache_key: string
  location_name: string
  hotspot_name: string
  species_name: string | null
  coordinates: { lat: number; lon: number }
  forecast_data: OpenMeteoDailyForecast[]
  open_meteo_data: ProcessedOpenMeteoData
  tide_data: CHSWaterData | null // Database column name
  created_at: string
  expires_at: string
  cache_duration_hours: number
  hit_count: number
  last_accessed: string
}

export interface CacheConfig {
  default_cache_duration_hours: number
  max_cache_entries: number
  cleanup_interval_hours: number
}

export interface CacheResult {
  data: {
    forecasts: OpenMeteoDailyForecast[]
    openMeteoData: ProcessedOpenMeteoData
    chsTideData: CHSWaterData | null
  } | null
  cached: boolean
  createdAt?: string
  expiresAt?: string
}

export class ForecastCacheService {
  // Flag to track if tables have been initialized
  private static tablesInitialized = false

  // Initialize database tables if they don't exist
  static async initializeTables(): Promise<boolean> {
    if (!supabase || this.tablesInitialized) {
      return true
    }

    try {
      // Check if forecast_cache table exists
      const { error: tableError } = await supabase
        .from('forecast_cache')
        .select('id')
        .limit(1)

      // If no error, tables exist
      if (!tableError) {
        this.tablesInitialized = true
        return true
      }

      // Tables don't exist - provide helpful instructions
      console.warn(`
========================================
SUPABASE CACHE TABLES NOT FOUND
========================================
To enable caching functionality, please:

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run the SQL script in: SUPABASE_SETUP.sql
4. Or copy the contents of that file into the SQL Editor

Tables needed:
- forecast_cache
- cache_config  
- location_cache_config

After running the setup script, refresh your application.
========================================
      `)
      return false
    } catch (error) {
      console.error('Error checking table existence:', error)
      return false
    }
  }

  // Generate cache key with proper species handling
  static generateCacheKey(
    location: string,
    hotspot: string,
    species: string | null,
    date: Date = new Date()
  ): string {
    const dateStr = date.toISOString().split('T')[0] // YYYY-MM-DD
    const speciesKey = species || 'no-species'
    return `${location}|${hotspot}|${speciesKey}|${dateStr}`
  }

  // Get cache configuration
  static async getCacheConfig(): Promise<CacheConfig> {
    // Return defaults if Supabase is not configured
    if (!supabase) {
      return {
        default_cache_duration_hours: defaultCacheDurationHours,
        max_cache_entries: 1000,
        cleanup_interval_hours: 1
      }
    }

    try {
      const { data, error } = await supabase
        .from('cache_config')
        .select('config_key, config_value')
      
      if (error) throw error

      const config: Partial<CacheConfig> = {}
      data?.forEach(item => {
        const key = item.config_key as keyof CacheConfig
        config[key] = parseInt(item.config_value)
      })

      return {
        default_cache_duration_hours: config.default_cache_duration_hours || defaultCacheDurationHours,
        max_cache_entries: config.max_cache_entries || 1000,
        cleanup_interval_hours: config.cleanup_interval_hours || 1
      }
    } catch (error) {
      console.error('Error getting cache config:', error)
      return {
        default_cache_duration_hours: defaultCacheDurationHours,
        max_cache_entries: 1000,
        cleanup_interval_hours: 1
      }
    }
  }

  // Get location-specific cache duration
  static async getLocationCacheDuration(location: string, hotspot: string): Promise<number> {
    // Return default if Supabase is not configured
    if (!supabase) {
      return defaultCacheDurationHours
    }

    try {
      const { data, error } = await supabase
        .from('location_cache_config')
        .select('cache_duration_hours')
        .eq('location_name', location)
        .eq('hotspot_name', hotspot)
        .single()

      if (error || !data) {
        const config = await this.getCacheConfig()
        return config.default_cache_duration_hours
      }

      return data.cache_duration_hours
    } catch (error) {
      console.error('Error getting location cache duration:', error)
      const config = await this.getCacheConfig()
      return config.default_cache_duration_hours
    }
  }

  // Look up cached forecast data
  static async getCachedForecast(
    location: string,
    hotspot: string,
    species: string | null
  ): Promise<CacheResult> {
    // Return no cache if Supabase is not configured
    if (!supabase) {
      return { data: null, cached: false }
    }

    // Ensure tables are initialized
    const tablesReady = await this.initializeTables()
    if (!tablesReady) {
      return { data: null, cached: false }
    }

    try {
      const cacheKey = this.generateCacheKey(location, hotspot, species)
      
      const { data, error } = await supabase
        .from('forecast_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gte('expires_at', new Date().toISOString())
        .single()

      if (error || !data) {
        return { data: null, cached: false }
      }

      // Increment hit count in background (non-blocking)
      // Fire and forget - don't await to avoid adding latency
      supabase.rpc('increment_cache_hit', { cache_key_param: cacheKey }).then(() => {
        // Success - stats updated
      }, () => {
        // Silently ignore errors - stats are not critical
      })

      return {
        data: {
          forecasts: data.forecast_data as OpenMeteoDailyForecast[],
          openMeteoData: data.open_meteo_data as ProcessedOpenMeteoData,
          chsTideData: data.tide_data as CHSWaterData | null
        },
        cached: true,
        createdAt: data.created_at,
        expiresAt: data.expires_at
      }
    } catch (error) {
      console.error('Error getting cached forecast:', error)
      return { data: null, cached: false }
    }
  }

  // Store forecast data in cache
  static async storeForecastCache(
    location: string,
    hotspot: string,
    species: string | null,
    coordinates: { lat: number; lon: number },
    forecasts: OpenMeteoDailyForecast[],
    openMeteoData: ProcessedOpenMeteoData,
    tideData: CHSWaterData | null
  ): Promise<boolean> {
    // Return success (no-op) if Supabase is not configured
    if (!supabase) {
      return true
    }

    // Ensure tables are initialized
    const tablesReady = await this.initializeTables()
    if (!tablesReady) {
      return true // Return success but don't cache
    }

    try {
      const cacheKey = this.generateCacheKey(location, hotspot, species)
      const cacheDurationHours = await this.getLocationCacheDuration(location, hotspot)
      
      const now = new Date()
      const expiresAt = new Date(now.getTime() + cacheDurationHours * 60 * 60 * 1000)

      const cacheEntry = {
        cache_key: cacheKey,
        location_name: location,
        hotspot_name: hotspot,
        species_name: species,
        coordinates,
        forecast_data: forecasts,
        open_meteo_data: openMeteoData,
        tide_data: tideData, // Map to the database column name
        expires_at: expiresAt.toISOString(),
        cache_duration_hours: cacheDurationHours
      }

      // Use upsert to handle duplicate cache keys
      const { error } = await supabase
        .from('forecast_cache')
        .upsert(cacheEntry, { onConflict: 'cache_key' })

      if (error) {
        console.error('Error storing forecast cache:', error)
        return false
      }

      // Trigger cleanup if needed
      await this.cleanupCacheIfNeeded()
      
      return true
    } catch (error) {
      console.error('Error storing forecast cache:', error)
      return false
    }
  }

  // Clean up expired and excessive cache entries (LRU)
  static async cleanupCacheIfNeeded(): Promise<void> {
    // Return early if Supabase is not configured
    if (!supabase) {
      return
    }

    try {
      const config = await this.getCacheConfig()
      
      // Remove expired entries
      await supabase
        .from('forecast_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())

      // Check if we need LRU cleanup
      const { count } = await supabase
        .from('forecast_cache')
        .select('*', { count: 'exact', head: true })

      if (count && count > config.max_cache_entries) {
        // Remove oldest accessed entries to get under the limit
        const entriesToRemove = count - config.max_cache_entries + 50 // Remove extra for buffer
        
        const { data: oldEntries } = await supabase
          .from('forecast_cache')
          .select('id')
          .order('last_accessed', { ascending: true })
          .limit(entriesToRemove)

        if (oldEntries && oldEntries.length > 0) {
          const idsToDelete = oldEntries.map(entry => entry.id)
          await supabase
            .from('forecast_cache')
            .delete()
            .in('id', idsToDelete)
        }
      }
    } catch (error) {
      console.error('Error during cache cleanup:', error)
    }
  }

  // Force cleanup - for admin use
  static async forceCleanup(): Promise<{ removedExpired: number; removedLRU: number }> {
    // Return zeros if Supabase is not configured
    if (!supabase) {
      return { removedExpired: 0, removedLRU: 0 }
    }

    try {
      // Count expired entries before removal
      const { count: expiredCount } = await supabase
        .from('forecast_cache')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString())

      // Remove expired entries  
      await supabase
        .from('forecast_cache')
        .delete()
        .lt('expires_at', new Date().toISOString())

      const config = await this.getCacheConfig()
      let removedLRU = 0

      // Check if we need LRU cleanup
      const { count } = await supabase
        .from('forecast_cache')
        .select('*', { count: 'exact', head: true })

      if (count && count > config.max_cache_entries) {
        const entriesToRemove = count - config.max_cache_entries
        removedLRU = entriesToRemove
        
        const { data: oldEntries } = await supabase
          .from('forecast_cache')
          .select('id')
          .order('last_accessed', { ascending: true })
          .limit(entriesToRemove)

        if (oldEntries && oldEntries.length > 0) {
          const idsToDelete = oldEntries.map(entry => entry.id)
          await supabase
            .from('forecast_cache')
            .delete()
            .in('id', idsToDelete)
        }
      }

      return {
        removedExpired: expiredCount || 0,
        removedLRU
      }
    } catch (error) {
      console.error('Error during force cleanup:', error)
      return { removedExpired: 0, removedLRU: 0 }
    }
  }

  // Get cache statistics
  static async getCacheStats(): Promise<{
    totalEntries: number
    expiredEntries: number
    hitCounts: { location: string; hotspot: string; hits: number }[]
    averageAge: number
  }> {
    // Return empty stats if Supabase is not configured
    if (!supabase) {
      return {
        totalEntries: 0,
        expiredEntries: 0,
        hitCounts: [],
        averageAge: 0
      }
    }

    try {
      const { count: totalEntries } = await supabase
        .from('forecast_cache')
        .select('*', { count: 'exact', head: true })

      const { count: expiredEntries } = await supabase
        .from('forecast_cache')
        .select('*', { count: 'exact', head: true })
        .lt('expires_at', new Date().toISOString())

      const { data: hitData } = await supabase
        .from('forecast_cache')
        .select('location_name, hotspot_name, hit_count')
        .order('hit_count', { ascending: false })
        .limit(10)

      const { data: ageData } = await supabase
        .from('forecast_cache')
        .select('created_at')

      let averageAge = 0
      if (ageData && ageData.length > 0) {
        const now = new Date().getTime()
        const totalAge = ageData.reduce((sum, entry) => {
          const createdAt = new Date(entry.created_at).getTime()
          return sum + (now - createdAt)
        }, 0)
        averageAge = Math.round(totalAge / ageData.length / (1000 * 60 * 60)) // Hours
      }

      return {
        totalEntries: totalEntries || 0,
        expiredEntries: expiredEntries || 0,
        hitCounts: hitData?.map(item => ({
          location: item.location_name,
          hotspot: item.hotspot_name,
          hits: item.hit_count
        })) || [],
        averageAge
      }
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return {
        totalEntries: 0,
        expiredEntries: 0,
        hitCounts: [],
        averageAge: 0
      }
    }
  }

  // Clear all cache entries - for admin use
  static async clearAllCache(): Promise<boolean> {
    // Return success if Supabase is not configured
    if (!supabase) {
      return true
    }

    try {
      const { error } = await supabase
        .from('forecast_cache')
        .delete()
        .neq('id', 'none') // Delete all entries

      return !error
    } catch (error) {
      console.error('Error clearing all cache:', error)
      return false
    }
  }

  // Update location-specific cache duration
  static async updateLocationCacheDuration(
    location: string,
    hotspot: string,
    durationHours: number
  ): Promise<boolean> {
    // Return success if Supabase is not configured
    if (!supabase) {
      return true
    }

    try {
      const { error } = await supabase
        .from('location_cache_config')
        .upsert({
          location_name: location,
          hotspot_name: hotspot,
          cache_duration_hours: durationHours
        }, { onConflict: 'location_name,hotspot_name' })

      return !error
    } catch (error) {
      console.error('Error updating location cache duration:', error)
      return false
    }
  }
}

export default ForecastCacheService