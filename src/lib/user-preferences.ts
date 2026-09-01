import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface UserPreferences {
  /**
   * Legacy, read-only. The retired Preferences page was the only writer, and
   * the only reader was the Mixpanel user-property call, which still reports
   * whatever an angler saved before the page went away. No product surface has
   * ever read these. The default that decides where the app opens is
   * `homeSpotSlug` below. Nothing writes these now, so do not add a reader.
   */
  favoriteLocation?: string
  favoriteHotspot?: string
  favoriteSpecies?: string
  favoriteLat?: number
  favoriteLon?: number
  /** Legacy, read-only, same as the favorite* fields above. */
  notificationsEnabled?: boolean
  timezone?: string
  // Unit preferences — eight independent display variables.
  windUnit?: 'kph' | 'mph' | 'knots' | 'ms'
  currentUnit?: 'kph' | 'mph' | 'knots' | 'ms'
  tempUnit?: 'C' | 'F'
  precipUnit?: 'mm' | 'inches'
  tideUnit?: 'ft' | 'm'
  waveUnit?: 'ft' | 'm'
  depthUnit?: 'ft' | 'm' | 'fathoms'
  distanceUnit?: 'km' | 'miles' | 'nm'
  pressureUnit?: 'mb' | 'inHg'
  /** @deprecated Split into tideUnit/waveUnit/depthUnit. Read only to migrate
   *  an existing saved choice into depthUnit; never written going forward. */
  heightUnit?: 'ft' | 'm'
  /**
   * The angler's pinned home spot, as a BlueCaster spot slug. Lives here rather
   * than in localStorage alone so it survives the move to a phone — the same
   * reason the Pro welcome records its dismissal server-side. `use-home-spot`
   * still keeps a localStorage copy as a synchronous first-paint cache.
   */
  homeSpotSlug?: string
  /**
   * The angler's home city, as a BlueCaster city slug.
   *
   * Distinct from `homeSpotSlug`, and it is the more load-bearing of the two.
   * Nearly everything that reads the pin only wants the city it sits in: the
   * daily report resolves the spot to a city and throws the spot away, and so
   * does Explore's opening frame. Those questions now ask this instead.
   *
   * A city is also the only one of the two that can be guessed. We can tell
   * from an arrival URL or an IP fix which city someone fishes near; we can
   * never tell which spot. So this is confirmed once, in one tap, rather than
   * chosen from a list of water they have not fished yet.
   */
  homeCitySlug?: string
  /**
   * When the home-city question was last put to them, ISO 8601.
   *
   * Set whether they answered or dismissed, so the modal asks once. It lives
   * here rather than in a `user_settings` column because this whole object is
   * one jsonb blob we already write, and a new column would need a migration
   * applied by hand.
   */
  homeCityAskedAt?: string
}

// No favorite* or notificationsEnabled defaults any more. They used to fill in
// "Victoria, Sidney" / "Waterfront" / true for every angler who never opened
// the Preferences page, which is now every angler, and Mixpanel recorded that
// invented answer as if it were a stated one. Left unset, the property is
// simply absent for anyone who never chose.
const DEFAULT_PREFERENCES: UserPreferences = {
  timezone: 'America/Vancouver',
  // BC marine-convention defaults — match what the product surfaces render when
  // no preference is set (keep in step with DEFAULT_UNITS in
  // contexts/unit-preferences-context.tsx). Tide + depth in feet, wave in metres.
  windUnit: 'knots',
  currentUnit: 'knots',
  tempUnit: 'C',
  precipUnit: 'mm',
  tideUnit: 'ft',
  waveUnit: 'm',
  depthUnit: 'ft',
  distanceUnit: 'km',
  pressureUnit: 'mb',
}

/**
 * The signed-in user, fetched at most once per auth state.
 *
 * `supabase.auth.getUser()` is a network round trip to `/auth/v1/user`, and
 * supabase-js holds an exclusive lock across auth calls, so concurrent callers
 * do not overlap — they QUEUE. Four independent consumers ask this service for
 * preferences on a single dashboard paint (both Mixpanel effects, the
 * unit-preferences context, and the home-spot hydrate), which meant four
 * strictly serial round trips before the first of them could answer, and the
 * whole set ran again on the next auth event. Nine `/auth/v1/user` calls on one
 * load, most of them waiting on each other.
 *
 * Deliberately still `getUser()` and not `getSession()`. The session's cached
 * `user_metadata` can be up to a token lifetime stale, and the home spot is
 * stored there precisely so a pin set on a phone reaches the laptop — reading
 * it locally would quietly break the one promise that field exists to keep.
 * So the round trip stays; callers on the same paint just share it.
 *
 * Same shape as the saved-spots store: module-scope, one in-flight promise,
 * reset from AuthProvider on sign-in/out/user-update.
 */
let userRequest: Promise<User | null> | null = null

function currentUser(): Promise<User | null> {
  if (!userRequest) {
    userRequest = supabase.auth
      .getUser()
      .then(({ data }) => data.user ?? null)
      // A failed read must not be cached as "signed out" — that would hand
      // every caller the defaults and, for the home spot, look like no pin.
      .catch(() => {
        userRequest = null
        return null
      })
  }
  return userRequest
}

/**
 * Drop the cached user — on sign-in, sign-out, an account switch, or any write
 * that changes `user_metadata`. AuthProvider calls this alongside
 * `resetFavorites`; `updateUserPreferences` calls it after its own write, so
 * the next read reflects what it just saved.
 */
export function resetCachedUser(): void {
  userRequest = null
}

export class UserPreferencesService {

  static async getUserPreferences(): Promise<UserPreferences> {
    try {
      const user = await currentUser()
      
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
      const user = await currentUser()
      
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

      // The write just changed `user_metadata`, so the cached copy this method
      // merged from is now behind. Drop it: saving a home spot and immediately
      // re-reading preferences must not hand back the pre-write value.
      resetCachedUser()
      return { success: true }
    } catch (error) {
      console.error('Error updating user preferences:', error)
      return { success: false, error: 'Failed to update preferences' }
    }
  }

}