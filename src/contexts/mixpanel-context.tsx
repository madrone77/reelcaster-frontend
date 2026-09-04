'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { initMixpanel } from '@/lib/mixpanel';
import { initPostHog } from '@/lib/posthog';
import {
  trackEvent as trackEventHelper,
  identifyUser as identifyUserHelper,
  aliasUser,
  setUserProperties as setUserPropertiesHelper,
  resetAnalytics,
  registerViewerContext,
  setInternalTraffic,
} from '@/lib/analytics';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { viewerTierOf } from '@/lib/viewer-tier';
import { isInternalBrowser, isInternalUser } from '@/lib/internal-traffic';
import { UserPreferencesService } from '@/lib/user-preferences';
import type { AnalyticsContextType, UserProperties } from '@/types/analytics';

const MixpanelContext = createContext<AnalyticsContextType | undefined>(
  undefined
);

export function MixpanelProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const subscription = useSubscription();
  const [isInitialized, setIsInitialized] = useState(false);
  const previousUserIdRef = useRef<string | null>(null);
  const hasAliasedRef = useRef(false);

  // Initialize both analytics sinks once on mount.
  //
  // Neither call loads an SDK here. Both only register intent and schedule the
  // real import for after the page has settled, so this stays cheap on the
  // hydration path no matter how many vendors are on the list.
  //
  // The provider keeps its Mixpanel name because renaming it would touch
  // layout.tsx, the hook and every consumer for no behaviour change. It is the
  // analytics provider; it has been since PostHog was added beside Mixpanel.
  useEffect(() => {
    if (!isInitialized) {
      initMixpanel();
      initPostHog();
      setIsInitialized(true);
    }
  }, [isInitialized]);

  // Team browsers and team accounts do not count. Decided on every auth
  // change so a customer signing in on a shared machine is opted back in.
  useEffect(() => {
    if (loading || !isInitialized) return;
    setInternalTraffic(isInternalBrowser() || isInternalUser(user?.id));
  }, [user?.id, loading, isInitialized]);

  // viewer_tier on every event from here on, plus the plan on the profile.
  // Waits for the subscription row, not just auth: before it lands the hook
  // reports the free default and a Pro member would be stamped 'free'.
  useEffect(() => {
    if (loading || subscription.loading || !isInitialized) return;
    registerViewerContext({
      viewer_tier: viewerTierOf(!!user, subscription.isPaid),
      subscription_tier: subscription.tier,
      subscription_status: subscription.status,
      subscription_period_end: subscription.periodEnd,
      phone_verified: subscription.phoneVerified,
    });
  }, [
    user,
    loading,
    isInitialized,
    subscription.loading,
    subscription.isPaid,
    subscription.tier,
    subscription.status,
    subscription.periodEnd,
    subscription.phoneVerified,
  ]);

  // Handle user authentication state changes
  useEffect(() => {
    if (loading || !isInitialized) return;

    const handleAuthChange = async () => {
      const currentUserId = user?.id || null;
      const previousUserId = previousUserIdRef.current;

      // Case 1: User just signed up (no previous user, now has user)
      // We need to alias the anonymous user to the new authenticated user
      if (!previousUserId && currentUserId && !hasAliasedRef.current) {
        // This is a new user or first-time login
        // Alias the anonymous ID to the authenticated user ID
        aliasUser(currentUserId);
        hasAliasedRef.current = true;

        // Identify the user
        const preferences = await UserPreferencesService.getUserPreferences();
        const userProperties: UserProperties = {
          $email: user?.email,
          $created: user?.created_at,
          accountType: 'authenticated',
          favoriteLocation: preferences.favoriteLocation,
          favoriteHotspot: preferences.favoriteHotspot,
          favoriteSpecies: preferences.favoriteSpecies,
          windUnit: preferences.windUnit,
          tempUnit: preferences.tempUnit,
          precipUnit: preferences.precipUnit,
          tideUnit: preferences.tideUnit,
          waveUnit: preferences.waveUnit,
          depthUnit: preferences.depthUnit,
          currentUnit: preferences.currentUnit,
          notificationsEnabled: preferences.notificationsEnabled,
        };

        identifyUserHelper(currentUserId, userProperties);
      }

      // Case 2: User just signed in (different user than before)
      // Just identify, no need to alias
      else if (currentUserId && currentUserId !== previousUserId) {
        const preferences = await UserPreferencesService.getUserPreferences();
        const userProperties: UserProperties = {
          $email: user?.email,
          $created: user?.created_at,
          accountType: 'authenticated',
          favoriteLocation: preferences.favoriteLocation,
          favoriteHotspot: preferences.favoriteHotspot,
          favoriteSpecies: preferences.favoriteSpecies,
          windUnit: preferences.windUnit,
          tempUnit: preferences.tempUnit,
          precipUnit: preferences.precipUnit,
          tideUnit: preferences.tideUnit,
          waveUnit: preferences.waveUnit,
          depthUnit: preferences.depthUnit,
          currentUnit: preferences.currentUnit,
          notificationsEnabled: preferences.notificationsEnabled,
          lastActiveDate: new Date().toISOString(),
        };

        identifyUserHelper(currentUserId, userProperties);
      }

      // Case 3: User signed out (had user, now has no user)
      else if (previousUserId && !currentUserId) {
        resetAnalytics();
        hasAliasedRef.current = false;
      }

      // Update ref for next comparison
      previousUserIdRef.current = currentUserId;
    };

    handleAuthChange();
  }, [user, loading, isInitialized]);

  const trackEvent: AnalyticsContextType['trackEvent'] = (
    eventName,
    properties
  ) => {
    trackEventHelper(eventName, properties);
  };

  const identifyUser: AnalyticsContextType['identifyUser'] = (
    userId,
    properties
  ) => {
    identifyUserHelper(userId, properties);
  };

  const setUserProperties: AnalyticsContextType['setUserProperties'] = (
    properties
  ) => {
    setUserPropertiesHelper(properties);
  };

  const reset: AnalyticsContextType['reset'] = () => {
    resetAnalytics();
    hasAliasedRef.current = false;
  };

  const value: AnalyticsContextType = {
    trackEvent,
    identifyUser,
    setUserProperties,
    reset,
  };

  return (
    <MixpanelContext.Provider value={value}>
      {children}
    </MixpanelContext.Provider>
  );
}

export function useMixpanel(): AnalyticsContextType {
  const context = useContext(MixpanelContext);
  if (context === undefined) {
    throw new Error('useMixpanel must be used within a MixpanelProvider');
  }
  return context;
}
