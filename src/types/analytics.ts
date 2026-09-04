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
  // Explore. Every one names the spot/species/day in scope so a funnel can
  // start at what was on screen rather than at the wall that followed.
  | 'Spot Selected'
  | 'Spot Closed'
  | 'Species Chosen'
  | 'Day Chosen'
  | 'Score Floor Changed'
  | 'Map Moved'
  | 'City Chosen'
  | 'Near Me Used'
  | 'Station Selected'
  | 'Search Performed'
  | 'Search Result Picked'
  | 'Depth Gate Shown'
  | 'Depth Gate Dismissed'
  | 'Depth Gate Accepted'
  | 'Ad Frame Spot Blocked'
  | 'Back To Map Clicked'
  // Spot page
  | 'Spot Viewed'
  | 'Locked Day Tapped'
  | 'Spot Saved'
  | 'Home Spot Set'
  | 'Alert Setup Opened'
  | 'Share Opened'
  | 'Share Sent'
  | 'Issue Reported'
  | 'Verdict Voted'
  // Custom spots
  | 'Custom Spot Create Started'
  | 'Custom Spot Created'
  | 'Custom Spot Create Failed'
  // Alerts. Never the phone number: country and outcome only.
  | 'Alert Created'
  | 'Alert Edited'
  | 'Alert Deleted'
  | 'Alert Paused'
  | 'Alert Resumed'
  | 'Alert Duplicated'
  | 'Phone Code Sent'
  | 'Phone Verified'
  | 'Phone Verify Failed'
  // Catch log
  | 'Catch Photo Attached'
  | 'Catch Logged'
  | 'Catch Edited'
  // Billing. 'Trial Started' fires on /billing/success, where Meta and
  // Plausible already do; it is the conversion, not the intent.
  // The three taps on the buy control, named for the button. 'Apple Pay
  // Clicked' / 'Google Pay Clicked' fire when the wallet button is tapped
  // (before the OS sheet opens); 'Email Entered' once per paywall when the
  // email field is left holding an address; 'Start Trial Clicked' on the
  // Start N-day free trial (or Get Pro) button itself. 'Checkout Started'
  // still fires when the request to Stripe actually goes out.
  | 'Apple Pay Clicked'
  | 'Google Pay Clicked'
  | 'Email Entered'
  | 'Start Trial Clicked'
  | 'Checkout Started'
  | 'Trial Started'
  | 'Account Claimed'
  | 'Cancel Clicked'
  | 'Cancel Page Viewed'
  // Signup
  | 'Signup Completed'
  | 'Welcome Shown'
  | 'Home City Chosen'
  // Landing pages, keyed the same way the campaign counter is
  | 'LP CTA Clicked'
  | 'LP Alert Code Sent'
  | 'LP Alert Confirmed'
  // City and home pages
  | 'City Day Chosen'
  | 'City Species Chosen'
  | 'Top Spot Clicked'
  | 'Nearby Map Clicked'
  | 'Carousel CTA Clicked'
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
  /** Plan state, so a cohort can be cut by what the person pays for. */
  viewer_tier?: 'anon' | 'free' | 'pro';
  subscription_tier?: string;
  subscription_status?: string;
  subscription_period_end?: string | null;
  phone_verified?: boolean;
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
