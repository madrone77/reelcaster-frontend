/**
 * Analytics Event Types
 * Type-safe event tracking for Mixpanel integration
 */

// ============================================================================
// Authentication Events
// ============================================================================

export interface SignUpEventProps {
  method: 'email' | 'google' | 'github';
  timestamp: string;
}

export interface SignInEventProps {
  method: 'email' | 'google' | 'github';
  timestamp: string;
}

export interface SignOutEventProps {
  timestamp: string;
}

export interface AuthDialogOpenedEventProps {
  source: string; // e.g., 'header', 'forecast-overlay', 'profile'
  timestamp: string;
}

// ============================================================================
// Location Selection Events
// ============================================================================

export interface LocationSelectedEventProps {
  location: string;
  region: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  timestamp: string;
}

export interface HotspotSelectedEventProps {
  location: string;
  hotspot: string;
  coordinates?: {
    lat: number;
    lon: number;
  };
  timestamp: string;
}

export interface SpeciesSelectedEventProps {
  location: string;
  hotspot?: string;
  species: string;
  timestamp: string;
}

// ============================================================================
// Forecast Interaction Events
// ============================================================================

export interface ForecastPageViewedEventProps {
  location: string;
  hotspot?: string;
  species?: string;
  pageLoadTime?: number; // milliseconds
  timestamp: string;
}

export interface ForecastLoadedEventProps {
  location: string;
  hotspot?: string;
  species?: string;
  cached: boolean;
  loadTime: number; // milliseconds
  timestamp: string;
}

export interface ForecastRefreshedEventProps {
  location: string;
  hotspot?: string;
  species?: string;
  timestamp: string;
}

export interface DaySelectedEventProps {
  location: string;
  dayIndex: number; // 0-13 for 14-day forecast
  timestamp: string;
}

export interface CacheHitEventProps {
  location: string;
  cacheAge: number; // hours
  timestamp: string;
}

// ============================================================================
// Profile & Preferences Events
// ============================================================================

export interface ProfileViewedEventProps {
  timestamp: string;
}

export interface PreferencesSavedEventProps {
  changedFields: string[]; // e.g., ['favoriteLocation', 'windUnit']
  favoriteLocation?: string;
  favoriteHotspot?: string;
  favoriteSpecies?: string;
  windUnit?: string;
  tempUnit?: string;
  precipUnit?: string;
  tideUnit?: string;
  waveUnit?: string;
  depthUnit?: string;
  currentUnit?: string;
  /** @deprecated split into tide/wave/depth */
  heightUnit?: string;
  notificationsEnabled?: boolean;
  timestamp: string;
}

export interface UnitCycledEventProps {
  metricType: 'wind' | 'temp' | 'precip' | 'height';
  oldUnit: string;
  newUnit: string;
  timestamp: string;
}

// ============================================================================
// Feature Access Events
// ============================================================================

export interface PremiumFeatureAccessedEventProps {
  feature: string; // e.g., '14-day-forecast', 'detailed-charts'
  authenticated: boolean;
  timestamp: string;
}

export interface UpgradePromptShownEventProps {
  feature: string;
  timestamp: string;
}

// ============================================================================
// Performance Events
// ============================================================================

export interface PageLoadTimeEventProps {
  page: string;
  loadTime: number; // milliseconds
  timestamp: string;
}

export interface ApiCallEventProps {
  endpoint: string; // e.g., 'open-meteo', 'chs-tide', 'dfo'
  duration: number; // milliseconds
  success: boolean;
  error?: string;
  timestamp: string;
}

// ============================================================================
// Error Events
// ============================================================================

export interface ErrorEventProps {
  errorType: string;
  errorMessage: string;
  component?: string;
  timestamp: string;
}

// ============================================================================
// Event Name Union Type
// ============================================================================

export type AnalyticsEventName =
  // Auth
  | 'Sign Up'
  | 'Sign In'
  | 'Sign Out'
  | 'Auth Dialog Opened'
  | 'Confirmation Resent'
  | 'Magic Link Requested'
  // Location
  | 'Location Selected'
  | 'Hotspot Selected'
  | 'Species Selected'
  // Forecast
  | 'Forecast Page Viewed'
  | 'Forecast Loaded'
  | 'Forecast Refreshed'
  | 'Day Selected'
  | 'Cache Hit'
  // Profile
  | 'Profile Viewed'
  | 'Preferences Saved'
  | 'Unit Cycled'
  // Feature Access
  | 'Premium Feature Accessed'
  | 'Upgrade Prompt Shown'
  // Paywall + Billing
  | 'Paywall Shown'
  | 'Paywall CTA Clicked'
  | 'Manage Subscription Clicked'
  | 'Pro Welcome Shown'
  // Closed the onboarding wizard early. Paired with 'Pro Onboarding Completed'
  // — both stop it reappearing, only one means they reached the end.
  | 'Pro Welcome Dismissed'
  | 'Pro Onboarding Completed'
  // New-user tour. 'Shown' fires once per account, 'Step' on each advance, and
  // 'Completed' vs 'Dismissed' separates reading it through from bailing out.
  | 'Welcome Tour Shown'
  | 'Welcome Tour Step'
  | 'Welcome Tour Completed'
  | 'Welcome Tour Dismissed'
  // Performance
  | 'Page Load Time'
  | 'API Call'
  // Password Reset
  | 'Password Reset Requested'
  | 'Password Reset Completed'
  // Errors
  | 'Error';

// ============================================================================
// User Properties
// ============================================================================

export interface UserProperties {
  $email?: string;
  $created?: string; // ISO date string
  favoriteLocation?: string;
  favoriteHotspot?: string;
  favoriteSpecies?: string;
  accountType?: 'authenticated' | 'anonymous';
  windUnit?: string;
  tempUnit?: string;
  precipUnit?: string;
  tideUnit?: string;
  waveUnit?: string;
  depthUnit?: string;
  currentUnit?: string;
  /** @deprecated split into tide/wave/depth */
  heightUnit?: string;
  notificationsEnabled?: boolean;
  totalForecasts?: number;
  lastActiveDate?: string; // ISO date string
}

// ============================================================================
// Analytics Context Type
// ============================================================================

export interface AnalyticsContextType {
  trackEvent: <T extends Record<string, unknown>>(
    eventName: AnalyticsEventName,
    properties?: T
  ) => void;
  identifyUser: (userId: string, properties?: UserProperties) => void;
  setUserProperties: (properties: UserProperties) => void;
  reset: () => void;
}
