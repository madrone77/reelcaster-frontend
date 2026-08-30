/**
 * Custom Alert Engine
 *
 * Evaluates user-defined fishing condition triggers against real-time weather/marine data.
 * Implements anti-spam logic via cooldown and hysteresis.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchOpenMeteoWeather, fetchOpenMeteoHistoricalWeather } from '@/app/utils/openMeteoApi';
import { fetchCHSTideDataByCoordinates, type CHSWaterData } from '@/app/utils/chsTideApi';
import { calculateOpenMeteoFishingScore } from '@/app/utils/fishingCalculations';
import { getMoonPhase } from '@/app/utils/astronomicalCalculations';
import type { OpenMeteo15MinData } from '@/app/utils/openMeteoApi';
import { fetchSpotSpeciesOutlook, type SpotSpeciesOutlook } from '@/lib/bluecaster-score';
import {
  scoreBeatsFor,
  scoreThresholdFor,
  localDateOf,
  type AlertBeat,
  type LeadTimeMode,
  type NoticeState,
  type ScoreBeatCandidate,
} from './score-beats';

// =============================================================================
// Types
// =============================================================================

export interface AlertProfile {
  id: string;
  user_id: string;
  name: string;
  location_lat: number;
  location_lng: number;
  location_name: string | null;
  is_active: boolean;
  triggers: AlertTriggers;
  active_hours: { start: string; end: string } | null;
  logic_mode: 'AND' | 'OR';
  cooldown_hours: number;
  last_triggered_at: string | null;
  state_flags: StateFlags;
  created_at: string;
  updated_at: string;
  // Score alerts (created from a spot's score modal) evaluate against the real
  // ReelCaster/bluecaster spot score, not the Open-Meteo trigger. These columns
  // exist on user_alert_profiles but were absent from this interface.
  alert_kind?: 'composite' | 'score' | null;
  target_bluecaster_spot_slug?: string | null;
  target_species?: string | null;
  score_threshold?: number | null;
  // Subset of {email, sms}. SMS is only delivered to a verified phone.
  delivery_channels?: string[] | null;
  // How far ahead this alert may fire. See LEAD_CAP_DAYS.
  lead_time_mode?: LeadTimeMode | null;
}

// The cadence rules live in ./score-beats, which is pure and has no
// `server-only` dependency so it can be unit tested. Re-exported here because
// this module was their home and callers import them from it.
export type {
  LeadTimeMode,
  AlertBeat,
  NoticeState,
  ScoreBeatCandidate,
} from './score-beats';
export { scoreBeatsFor, scoreThresholdFor } from './score-beats';

/** One thing we have to say, already claimed in the ledger. */
export interface AlertDigestItem {
  /** alert_day_notices row id, to stamp once the send resolves. */
  noticeId: string;
  profileId: string;
  spotName: string;
  spotSlug: string | null;
  beat: AlertBeat;
  /** The fishing day this item is about, YYYY-MM-DD. */
  targetDate: string;
  leadDays: number;
  score: number;
  threshold: number;
  speciesName: string | null;
  /** False when we fell back to the spot's best species. */
  speciesMatched: boolean;
}

/**
 * Everything one angler is owed today, in one message.
 *
 * The unit of sending is a person, not an alert. That is the whole change: a
 * user with alerts on six nearby spots is being told about one weather system,
 * and six emails about one weather system is how an alert gets filtered to
 * trash. Items are pre-resolved (spot name, species, threshold) so the sender
 * does not go back to the database once per line.
 */
export interface AlertDigestJob {
  userId: string;
  /** Union of the delivery channels across the alerts in this digest. */
  channels: string[];
  items: AlertDigestItem[];
}

export interface AlertTriggers {
  wind?: WindTrigger;
  tide?: TideTrigger;
  pressure?: PressureTrigger;
  water_temp?: WaterTempTrigger;
  solunar?: SolunarTrigger;
  fishing_score?: FishingScoreTrigger;
}

export interface WindTrigger {
  enabled: boolean;
  speed_min: number;      // mph
  speed_max: number;      // mph
  direction_center?: number;    // degrees (0-360)
  direction_tolerance?: number; // degrees (e.g., 45 = ±45°)
}

export interface TideTrigger {
  enabled: boolean;
  phases: TidePhase[];
  exchange_min?: number;  // meters
}

export type TidePhase = 'incoming' | 'outgoing' | 'high_slack' | 'low_slack';

export interface PressureTrigger {
  enabled: boolean;
  trend: 'rising' | 'falling' | 'steady';
  gradient_threshold?: number; // mb change over 3 hours (e.g., -2.0 for falling)
}

export interface WaterTempTrigger {
  enabled: boolean;
  min: number;  // celsius
  max: number;  // celsius
}

export interface SolunarTrigger {
  enabled: boolean;
  phases: SolunarPhase[];
}

export type SolunarPhase = 'major' | 'minor';

export interface FishingScoreTrigger {
  enabled: boolean;
  min_score: number;  // 0-100
  species?: string;
}

export interface StateFlags {
  [triggerName: string]: {
    is_active: boolean;
    last_value?: number;
    activated_at?: string;
  };
}

export interface EvaluationResult {
  matches: boolean;
  matchedTriggers: string[];
  triggerResults: Record<string, TriggerResult>;
  reason: string;
  conditionSnapshot: ConditionSnapshot;
}

export interface TriggerResult {
  triggered: boolean;
  currentValue: number | string;
  threshold: string;
  details?: string;
}

export interface ConditionSnapshot {
  timestamp: string;
  wind_speed_mph?: number;
  wind_direction?: number;
  pressure_hpa?: number;
  pressure_trend?: string;
  pressure_change_3h?: number;
  water_temp_c?: number;
  tide_phase?: string;
  tide_height_m?: number;
  tidal_exchange_m?: number;
  solunar_phase?: string;
  fishing_score?: number;
}

// =============================================================================
// Supabase Client
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// =============================================================================
// Wind Evaluation
// =============================================================================

/**
 * Calculate angular difference between two compass directions
 * Handles the 360°/0° wrap-around correctly
 */
export function calculateAngularDifference(angle1: number, angle2: number): number {
  const diff = Math.abs(angle1 - angle2);
  return Math.min(diff, 360 - diff);
}

/**
 * Calculate Simple Moving Average for wind speed smoothing
 * Uses last 3 data points to filter out gusts
 */
export function calculateSMA(values: number[], windowSize: number = 3): number {
  if (values.length === 0) return 0;
  const window = values.slice(-windowSize);
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

/**
 * Convert m/s to mph
 */
function msToMph(ms: number): number {
  return ms * 2.237;
}

/**
 * Evaluate wind trigger conditions
 */
export function evaluateWindTrigger(
  trigger: WindTrigger,
  weatherData: OpenMeteo15MinData[],
): TriggerResult {
  // Get recent wind speeds for SMA (last 3 readings = ~45 min)
  const recentSpeeds = weatherData.slice(-3).map(d => msToMph(d.windSpeed));
  const smoothedSpeed = calculateSMA(recentSpeeds);
  const currentDirection = weatherData[weatherData.length - 1]?.windDirection || 0;

  // Check speed range
  const speedInRange = smoothedSpeed >= trigger.speed_min && smoothedSpeed <= trigger.speed_max;

  // Check direction if specified
  let directionMatches = true;
  let directionDetails = '';

  if (trigger.direction_center !== undefined && trigger.direction_tolerance !== undefined) {
    const angularDiff = calculateAngularDifference(trigger.direction_center, currentDirection);
    directionMatches = angularDiff <= trigger.direction_tolerance;
    directionDetails = ` | Direction: ${currentDirection}° (target: ${trigger.direction_center}° ±${trigger.direction_tolerance}°, diff: ${angularDiff.toFixed(1)}°)`;
  }

  const triggered = speedInRange && directionMatches;

  return {
    triggered,
    currentValue: smoothedSpeed,
    threshold: `${trigger.speed_min}-${trigger.speed_max} mph`,
    details: `Speed: ${smoothedSpeed.toFixed(1)} mph (smoothed)${directionDetails}`,
  };
}

// =============================================================================
// Tide Evaluation
// =============================================================================

/**
 * Detect tide phase from water level derivative
 * Based on rate of change (dH/dt):
 * - Incoming: dH/dt > 0.05 m/hr
 * - Outgoing: dH/dt < -0.05 m/hr
 * - High Slack: |dH/dt| < 0.05 AND near peak
 * - Low Slack: |dH/dt| < 0.05 AND near trough
 */
export function detectTidePhase(tideData: CHSWaterData): TidePhase {
  const rateThreshold = 0.05; // m/hr
  const changeRate = tideData.changeRate;

  if (Math.abs(changeRate) < rateThreshold) {
    // Slack tide - determine if high or low
    const { currentHeight, nextTide, previousTide } = tideData;
    const midHeight = (nextTide.height + previousTide.height) / 2;

    return currentHeight > midHeight ? 'high_slack' : 'low_slack';
  }

  return changeRate > 0 ? 'incoming' : 'outgoing';
}

/**
 * Calculate tidal exchange (range between high and low)
 */
export function calculateTidalExchange(tideData: CHSWaterData): number {
  return tideData.tidalRange;
}

/**
 * Evaluate tide trigger conditions
 */
export function evaluateTideTrigger(
  trigger: TideTrigger,
  tideData: CHSWaterData | null,
): TriggerResult {
  if (!tideData) {
    return {
      triggered: false,
      currentValue: 'unavailable',
      threshold: trigger.phases.join(', '),
      details: 'Tide data unavailable',
    };
  }

  const currentPhase = detectTidePhase(tideData);
  const phaseMatches = trigger.phases.includes(currentPhase);

  // Check tidal exchange if specified
  let exchangeMatches = true;
  let exchangeDetails = '';

  if (trigger.exchange_min !== undefined) {
    const exchange = calculateTidalExchange(tideData);
    exchangeMatches = exchange >= trigger.exchange_min;
    exchangeDetails = ` | Exchange: ${exchange.toFixed(2)}m (min: ${trigger.exchange_min}m)`;
  }

  const triggered = phaseMatches && exchangeMatches;

  return {
    triggered,
    currentValue: currentPhase,
    threshold: `Phases: ${trigger.phases.join(', ')}`,
    details: `Current phase: ${currentPhase}${exchangeDetails}`,
  };
}

// =============================================================================
// Pressure Evaluation
// =============================================================================

/**
 * Calculate pressure gradient over 3 hours
 */
export async function calculatePressureGradient(
  lat: number,
  lng: number,
  currentPressure: number,
): Promise<{ gradient: number; trend: 'rising' | 'falling' | 'steady' }> {
  try {
    // Fetch historical data from 3 hours ago
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    const historicalResult = await fetchOpenMeteoHistoricalWeather(
      { lat, lon: lng },
      threeHoursAgo.toISOString().split('T')[0],
      threeHoursAgo.toISOString().split('T')[0],
    );

    if (!historicalResult.success || !historicalResult.data) {
      return { gradient: 0, trend: 'steady' };
    }

    // Find the closest data point to 3 hours ago
    const targetTime = threeHoursAgo.getTime();
    const historicalData = historicalResult.data.minutely15;

    let closestPoint = historicalData[0];
    let minDiff = Infinity;

    for (const point of historicalData) {
      const pointTime = new Date(point.time).getTime();
      const diff = Math.abs(pointTime - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestPoint = point;
      }
    }

    const pastPressure = closestPoint.pressure;
    const gradient = currentPressure - pastPressure;

    let trend: 'rising' | 'falling' | 'steady' = 'steady';
    if (gradient >= 1.5) trend = 'rising';
    else if (gradient <= -1.5) trend = 'falling';

    return { gradient, trend };
  } catch (error) {
    console.error('Error calculating pressure gradient:', error);
    return { gradient: 0, trend: 'steady' };
  }
}

/**
 * Evaluate pressure trigger conditions
 */
export async function evaluatePressureTrigger(
  trigger: PressureTrigger,
  currentPressure: number,
  lat: number,
  lng: number,
): Promise<TriggerResult> {
  const { gradient, trend } = await calculatePressureGradient(lat, lng, currentPressure);

  const trendMatches = trigger.trend === trend;

  // Check gradient threshold if specified
  let gradientMatches = true;
  if (trigger.gradient_threshold !== undefined) {
    if (trigger.trend === 'falling') {
      gradientMatches = gradient <= trigger.gradient_threshold;
    } else if (trigger.trend === 'rising') {
      gradientMatches = gradient >= trigger.gradient_threshold;
    }
  }

  const triggered = trendMatches && gradientMatches;

  return {
    triggered,
    currentValue: gradient,
    threshold: `${trigger.trend} (${trigger.gradient_threshold || '±1.5'} mb/3h)`,
    details: `Pressure: ${currentPressure.toFixed(1)} hPa | Change: ${gradient >= 0 ? '+' : ''}${gradient.toFixed(1)} mb/3h (${trend})`,
  };
}

// =============================================================================
// Water Temperature Evaluation
// =============================================================================

/**
 * Evaluate water temperature trigger conditions
 */
export function evaluateWaterTempTrigger(
  trigger: WaterTempTrigger,
  waterTemp: number | null,
): TriggerResult {
  if (waterTemp === null) {
    return {
      triggered: false,
      currentValue: 'unavailable',
      threshold: `${trigger.min}-${trigger.max}°C`,
      details: 'Water temperature data unavailable',
    };
  }

  const triggered = waterTemp >= trigger.min && waterTemp <= trigger.max;

  return {
    triggered,
    currentValue: waterTemp,
    threshold: `${trigger.min}-${trigger.max}°C`,
    details: `Water temp: ${waterTemp.toFixed(1)}°C`,
  };
}

// =============================================================================
// Solunar Evaluation
// =============================================================================

/**
 * Calculate solunar periods based on moon transit times
 * Major periods: ±1 hour of moon overhead/underfoot (~2 hours each)
 * Minor periods: ±30 minutes of moonrise/moonset (~1 hour each)
 *
 * Simplified calculation using moon phase as proxy
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getSolunarPeriod(date: Date, lat: number, lng: number): SolunarPhase | null {
  const hour = date.getHours();
  const moonPhase = getMoonPhase(date);

  // Simplified solunar calculation based on typical moon transit times
  // Moon transits roughly 50 minutes later each day

  // Major periods (moon overhead ~12:30 + 50min/day from new moon, underfoot is +12h)
  // This is a simplified approximation
  const daysSinceNew = moonPhase * 29.53;
  const transitOffset = (daysSinceNew * 50) / 60; // hours offset
  const moonOverhead = (12.5 + transitOffset) % 24;
  const moonUnderfoot = (moonOverhead + 12) % 24;

  // Moonrise/set roughly ±6 hours from transit (varies by phase)
  const moonRise = (moonOverhead - 6 + 24) % 24;
  const moonSet = (moonOverhead + 6) % 24;

  // Check major periods (±1 hour of transit)
  if (Math.abs(hour - moonOverhead) <= 1 || Math.abs(hour - moonUnderfoot) <= 1) {
    return 'major';
  }

  // Check minor periods (±0.5 hour of rise/set)
  if (Math.abs(hour - moonRise) <= 0.5 || Math.abs(hour - moonSet) <= 0.5) {
    return 'minor';
  }

  return null;
}

/**
 * Evaluate solunar trigger conditions
 */
export function evaluateSolunarTrigger(
  trigger: SolunarTrigger,
  date: Date,
  lat: number,
  lng: number,
): TriggerResult {
  const currentPhase = getSolunarPeriod(date, lat, lng);
  const triggered = currentPhase !== null && trigger.phases.includes(currentPhase);

  return {
    triggered,
    currentValue: currentPhase || 'none',
    threshold: `Phases: ${trigger.phases.join(', ')}`,
    details: `Current solunar: ${currentPhase || 'none'}`,
  };
}

// =============================================================================
// Fishing Score Evaluation
// =============================================================================

/**
 * Evaluate fishing score trigger conditions
 */
export function evaluateFishingScoreTrigger(
  trigger: FishingScoreTrigger,
  weatherData: OpenMeteo15MinData[],
  tideData: CHSWaterData | null,
  sunrise: number,
  sunset: number,
): TriggerResult {
  // Get current data point
  const current = weatherData[weatherData.length - 1];
  if (!current) {
    return {
      triggered: false,
      currentValue: 0,
      threshold: `≥${trigger.min_score}`,
      details: 'Weather data unavailable',
    };
  }

  // Calculate fishing score
  const scoreResult = calculateOpenMeteoFishingScore(
    current,
    sunrise,
    sunset,
    tideData,
    trigger.species || null,
  );

  const triggered = scoreResult.total >= trigger.min_score;

  return {
    triggered,
    currentValue: scoreResult.total,
    threshold: `≥${trigger.min_score}`,
    details: `Score: ${scoreResult.total.toFixed(0)}/100${trigger.species ? ` (${trigger.species})` : ''}`,
  };
}

// =============================================================================
// Anti-Spam Logic
// =============================================================================

/**
 * Check if cooldown period has elapsed since last trigger
 */
export function checkCooldown(
  lastTriggeredAt: string | null,
  cooldownHours: number,
): boolean {
  if (!lastTriggeredAt) return true;

  const lastTrigger = new Date(lastTriggeredAt);
  const now = new Date();
  const hoursSinceLastTrigger = (now.getTime() - lastTrigger.getTime()) / (1000 * 60 * 60);

  return hoursSinceLastTrigger >= cooldownHours;
}

/**
 * Check hysteresis state for a trigger
 * Implements deadband logic to prevent flickering
 *
 * Example for wind:
 * - ON threshold: wind < 10 mph (trigger fires)
 * - OFF threshold: wind > 13 mph (reset, ready to fire again)
 */
export function checkHysteresis(
  triggerName: string,
  currentMatch: boolean,
  currentValue: number,
  stateFlags: StateFlags,
  deadband: number = 0.3, // 30% deadband by default
): { shouldTrigger: boolean; newState: StateFlags[string] } {
  const currentState = stateFlags[triggerName] || { is_active: false };

  if (!currentState.is_active) {
    // Currently clean - can trigger if conditions match
    if (currentMatch) {
      return {
        shouldTrigger: true,
        newState: {
          is_active: true,
          last_value: currentValue,
          activated_at: new Date().toISOString(),
        },
      };
    }
    return { shouldTrigger: false, newState: currentState };
  }

  // Currently active - check if should reset
  // For now, use a simple approach: reset if value exceeds threshold by deadband amount
  const lastValue = currentState.last_value || currentValue;
  const changeRatio = Math.abs(currentValue - lastValue) / Math.max(lastValue, 1);

  if (!currentMatch && changeRatio > deadband) {
    // Reset state - ready to trigger again
    return {
      shouldTrigger: false,
      newState: { is_active: false },
    };
  }

  // Still in active state - don't re-trigger
  return { shouldTrigger: false, newState: currentState };
}

/**
 * Check if current time is within active hours
 */
export function isWithinActiveHours(
  activeHours: { start: string; end: string } | null,
  timezone: string = 'America/Vancouver',
): boolean {
  if (!activeHours) return true;

  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const currentTime = formatter.format(now);
  const [currentHour, currentMin] = currentTime.split(':').map(Number);
  const currentMinutes = currentHour * 60 + currentMin;

  const [startHour, startMin] = activeHours.start.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;

  const [endHour, endMin] = activeHours.end.split(':').map(Number);
  const endMinutes = endHour * 60 + endMin;

  // Handle overnight ranges (e.g., 22:00 to 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

// =============================================================================
// Main Evaluation Function
// =============================================================================

/**
 * Evaluate all triggers for an alert profile
 */


/**
 * How far back to read the ledger. Comfortably longer than the heads-up
 * cooldown, short enough that the read stays a small index scan forever.
 */
const NOTICE_LOOKBACK_DAYS = 30;

/**
 * Read what we have already told this alert's owner.
 *
 * ⚠️ Scoped by SEND date, not by target date. The previous version filtered
 * `target_date >= today`, which is right for the set of days we can still
 * confirm and catastrophic for the rate limit derived from the same rows: once
 * a flagged day slid into the past its row stopped being read, `lastHeadsUpAt`
 * fell back to null, and the "one heads-up a week" cap lifted. The effective
 * rule became "one heads-up per flagged day, then immediately another", so a
 * single alert sent 8 heads-ups in 18 days with gaps of 1, 1, 3, 1, 4, 3 and 4
 * days against a documented cap of 7. Both facts now come from one unfiltered
 * read and each is narrowed where it is used, rather than sharing a filter that
 * can only be correct for one of them.
 */
async function loadNoticeState(profileId: string, today: string): Promise<NoticeState> {
  const since = new Date(Date.now() - NOTICE_LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('alert_day_notices')
    .select('target_date, beat, created_at')
    .eq('alert_profile_id', profileId)
    .eq('beat', 'heads_up')
    .gte('created_at', since);

  if (error) {
    console.error(`[score-alert] notice history unavailable for ${profileId}:`, error);
    // Fail closed. An empty state would read as "we have never spoken", and
    // this alert would re-flag a day it already sent. Silence beats repeating
    // ourselves, and the next run gets another go.
    return { headsUpSentOn: new Map(), lastHeadsUpAt: new Date() };
  }

  const headsUpSentOn = new Map<string, string>();
  let lastHeadsUpAt: Date | null = null;

  for (const row of data ?? []) {
    const at = new Date(row.created_at);
    // Past fishing days cannot be confirmed, so they are dropped from the map.
    // They still count towards the rate limit below, which is the whole point.
    if (row.target_date >= today) {
      headsUpSentOn.set(row.target_date, localDateOf(at));
    }
    if (!lastHeadsUpAt || at > lastHeadsUpAt) lastHeadsUpAt = at;
  }

  return { headsUpSentOn, lastHeadsUpAt };
}



/**
 * Claim a beat in the ledger, returning the row id, or null if it was already
 * claimed.
 *
 * This is the deduplication, and the order matters: the row goes in BEFORE the
 * message goes out. A crash between claiming and sending loses that message,
 * which is the failure we want. The alternative ordering loses the claim on a
 * retry and sends twice, and a duplicate text at six in the morning costs more
 * trust than a missed one.
 */
async function claimBeat(
  profile: AlertProfile,
  candidate: ScoreBeatCandidate,
  channels: string[],
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('alert_day_notices')
    .insert({
      alert_profile_id: profile.id,
      user_id: profile.user_id,
      target_date: candidate.targetDate,
      beat: candidate.beat,
      score_at_send: candidate.score,
      lead_days: candidate.leadDays,
      channels_sent: channels,
      notification_sent: false,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 = unique_violation. Already claimed, by an earlier tick or a
    // concurrent worker. Not an error, just nothing left to do.
    if (error.code === '23505') return null;
    console.error(
      `[score-alert] claim failed for ${profile.id} ${candidate.targetDate} ${candidate.beat}:`,
      error,
    );
    return null;
  }

  return data?.id ?? null;
}

/** Stamp a claimed beat with what actually happened when we tried to send it. */
export async function markBeatSent(
  noticeId: string,
  sent: boolean,
  channels: string[],
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('alert_day_notices')
    .update({
      notification_sent: sent,
      channels_sent: channels,
      notification_error: errorMessage ?? null,
      sent_at: new Date().toISOString(),
    })
    .eq('id', noticeId);

  if (error) console.error(`[score-alert] failed to stamp notice ${noticeId}:`, error);
}

/**
 * Has this angler already had their message today?
 *
 * The cap that was missing. Every limit in this engine was per alert profile,
 * and an angler is not a profile: one Pro user with eight alerts across six
 * Victoria-area spots got 68 messages in 18 days, mail on every single day and
 * up to nine in one day, each one describing the same regional weather from a
 * slightly different angle. No per-alert rule can fix that, because each of the
 * eight alerts was individually behaving.
 *
 * Read off the ledger rather than a new column, so there is one source of truth
 * for what we have said and nothing to keep in sync. Only a delivered message
 * counts: a digest that failed to send should not cost the angler their day.
 */
async function alreadyDigestedToday(userId: string, todayLocal: string): Promise<boolean> {
  const since = new Date(`${todayLocal}T00:00:00-08:00`).toISOString();

  const { data, error } = await supabaseAdmin
    .from('alert_day_notices')
    .select('id')
    .eq('user_id', userId)
    .eq('notification_sent', true)
    .gte('sent_at', since)
    .limit(1);

  if (error) {
    console.error(`[score-alert] digest check failed for user ${userId}:`, error);
    // Fail closed, as everywhere else here. Staying quiet costs one day of
    // alerts; guessing wrong the other way is the bug this function exists for.
    return true;
  }

  return (data ?? []).length > 0;
}

/** "pacific-halibut" → "Pacific Halibut". */
function speciesLabel(slug: string | null): string | null {
  if (!slug) return null;
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Run every score alert and return one message per angler.
 *
 * Grouped by user, then by spot. It used to group by spot alone, which suited
 * the fetch (one outlook serves every alert pointed at a spot) and suited
 * nothing else: the unit of sending is a person, and a person cannot be batched
 * if their alerts are scattered across the loop. The outlook cache is now
 * shared across the whole run instead of per spot group, so grouping by user
 * costs no extra fetches.
 */
async function processScoreAlerts(profiles: AlertProfile[]): Promise<{
  digestJobs: AlertDigestJob[];
  results: Array<{ profileId: string; profileName: string; triggered: boolean; reason: string }>;
  errors: number;
}> {
  const digestJobs: AlertDigestJob[] = [];
  const results: Array<{
    profileId: string;
    profileName: string;
    triggered: boolean;
    reason: string;
  }> = [];
  let errors = 0;

  // One outlook per (spot, species) for the entire run, not per spot group.
  const outlookCache = new Map<string, SpotSpeciesOutlook | null>();
  async function outlookFor(slug: string, species: string | null) {
    const key = `${slug}::${species ?? ''}`;
    if (!outlookCache.has(key)) {
      outlookCache.set(key, await fetchSpotSpeciesOutlook(slug, species));
    }
    return outlookCache.get(key) ?? null;
  }

  const byUser = new Map<string, AlertProfile[]>();
  for (const profile of profiles) {
    if (!profile.target_bluecaster_spot_slug) continue;
    if (!byUser.has(profile.user_id)) byUser.set(profile.user_id, []);
    byUser.get(profile.user_id)!.push(profile);
  }

  const todayLocal = localDateOf(new Date());

  for (const [userId, userProfiles] of byUser) {
    // Checked before anything is claimed. A claim the digest will not carry is
    // a message silently lost: the ledger key is taken, so tomorrow's run sees
    // the day as already spoken for and says nothing.
    if (await alreadyDigestedToday(userId, todayLocal)) {
      for (const profile of userProfiles) {
        results.push({
          profileId: profile.id,
          profileName: profile.name,
          triggered: false,
          reason: 'Already sent this angler their message today',
        });
      }
      continue;
    }

    const items: AlertDigestItem[] = [];
    const channels = new Set<string>();

    for (const profile of userProfiles) {
      try {
        const slug = profile.target_bluecaster_spot_slug!;
        const outlook = await outlookFor(slug, profile.target_species ?? null);

        if (!outlook) {
          results.push({
            profileId: profile.id,
            profileName: profile.name,
            triggered: false,
            reason: 'Spot outlook unavailable',
          });
          continue;
        }

        // Bluecaster's own day-0 label for this spot, so "today" means today
        // where the boat goes in rather than wherever this process is running.
        const today = outlook.days[0]?.date ?? new Date().toISOString().slice(0, 10);
        const notices = await loadNoticeState(profile.id, today);

        const candidates = scoreBeatsFor(profile, outlook, notices);
        if (candidates.length === 0) {
          const best = outlook.days.reduce((m, d) => (d.peak > m ? d.peak : m), 0);
          results.push({
            profileId: profile.id,
            profileName: profile.name,
            triggered: false,
            reason: `Nothing to say: best in window ${best.toFixed(0)} vs threshold ${scoreThresholdFor(profile)}, heads-up ${notices.lastHeadsUpAt ? `last sent ${notices.lastHeadsUpAt.toISOString().slice(0, 10)}` : 'never sent'}`,
          });
          continue;
        }

        const profileChannels: string[] = profile.delivery_channels ?? ['email'];
        let claimed = 0;

        for (const candidate of candidates) {
          const noticeId = await claimBeat(profile, candidate, profileChannels);
          // Already sent for this day and beat. The common case on every tick
          // after the first, and entirely uninteresting.
          if (!noticeId) continue;

          claimed++;
          for (const c of profileChannels) channels.add(c);
          items.push({
            noticeId,
            profileId: profile.id,
            spotName:
              profile.location_name || profile.target_bluecaster_spot_slug || 'your spot',
            spotSlug: profile.target_bluecaster_spot_slug ?? null,
            beat: candidate.beat,
            targetDate: candidate.targetDate,
            leadDays: candidate.leadDays,
            score: candidate.score,
            threshold: scoreThresholdFor(profile),
            speciesName: speciesLabel(outlook.scoredSpeciesSlug ?? profile.target_species ?? null),
            speciesMatched: outlook.speciesMatched,
          });
        }

        results.push({
          profileId: profile.id,
          profileName: profile.name,
          triggered: claimed > 0,
          reason:
            claimed > 0
              ? `${claimed} new beat(s) claimed from ${candidates.length} qualifying day(s)`
              : `${candidates.length} qualifying day(s), all already sent`,
        });
      } catch (err) {
        console.error(`[score-alert] error processing profile ${profile.id}:`, err);
        results.push({
          profileId: profile.id,
          profileName: profile.name,
          triggered: false,
          reason: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
        });
        errors++;
      }
    }

    if (items.length === 0) continue;

    // Soonest day first, and the better day first within a day. The angler's
    // question is "what am I doing next", so the calendar is the right spine.
    items.sort((a, b) =>
      a.targetDate === b.targetDate
        ? b.score - a.score
        : a.targetDate < b.targetDate
          ? -1
          : 1,
    );

    // The union of what their alerts asked for. Channel is a per-alert setting
    // and this is one message covering several alerts, so the alternative is
    // picking one alert's preference to speak for the rest. Anyone who asked
    // for a text about any of these spots gets the text.
    digestJobs.push({
      userId,
      channels: channels.size > 0 ? [...channels] : ['email'],
      items,
    });
  }

  return { digestJobs, results, errors };
}

export async function evaluateAlertProfile(
  profile: AlertProfile,
  weatherData: OpenMeteo15MinData[],
  tideData: CHSWaterData | null,
  sunrise: number,
  sunset: number,
): Promise<EvaluationResult> {
  // Score alerts do not come through here at all any more. They read the
  // bluecaster outlook and emit dated beats, which this function's
  // single-boolean return cannot express, so processAlerts routes them to
  // processScoreAlerts before this point.

  const now = new Date();
  const triggers = profile.triggers;
  const triggerResults: Record<string, TriggerResult> = {};
  const matchedTriggers: string[] = [];

  // Get current weather for snapshot
  const current = weatherData[weatherData.length - 1];
  const conditionSnapshot: ConditionSnapshot = {
    timestamp: now.toISOString(),
    wind_speed_mph: current ? msToMph(current.windSpeed) : undefined,
    wind_direction: current?.windDirection,
    pressure_hpa: current?.pressure,
  };

  // Evaluate each enabled trigger
  if (triggers.wind?.enabled) {
    triggerResults.wind = evaluateWindTrigger(triggers.wind, weatherData);
    if (triggerResults.wind.triggered) matchedTriggers.push('wind');
  }

  if (triggers.tide?.enabled) {
    triggerResults.tide = evaluateTideTrigger(triggers.tide, tideData);
    if (triggerResults.tide.triggered) matchedTriggers.push('tide');

    if (tideData) {
      conditionSnapshot.tide_phase = detectTidePhase(tideData);
      conditionSnapshot.tide_height_m = tideData.currentHeight;
      conditionSnapshot.tidal_exchange_m = tideData.tidalRange;
    }
  }

  if (triggers.pressure?.enabled && current) {
    triggerResults.pressure = await evaluatePressureTrigger(
      triggers.pressure,
      current.pressure,
      profile.location_lat,
      profile.location_lng,
    );
    if (triggerResults.pressure.triggered) matchedTriggers.push('pressure');

    const pressureGradient = await calculatePressureGradient(
      profile.location_lat,
      profile.location_lng,
      current.pressure,
    );
    conditionSnapshot.pressure_trend = pressureGradient.trend;
    conditionSnapshot.pressure_change_3h = pressureGradient.gradient;
  }

  if (triggers.water_temp?.enabled) {
    const waterTemp = tideData?.waterTemperature ?? null;
    triggerResults.water_temp = evaluateWaterTempTrigger(triggers.water_temp, waterTemp);
    if (triggerResults.water_temp.triggered) matchedTriggers.push('water_temp');

    conditionSnapshot.water_temp_c = waterTemp ?? undefined;
  }

  if (triggers.solunar?.enabled) {
    triggerResults.solunar = evaluateSolunarTrigger(
      triggers.solunar,
      now,
      profile.location_lat,
      profile.location_lng,
    );
    if (triggerResults.solunar.triggered) matchedTriggers.push('solunar');

    conditionSnapshot.solunar_phase = getSolunarPeriod(
      now,
      profile.location_lat,
      profile.location_lng,
    ) || undefined;
  }

  if (triggers.fishing_score?.enabled) {
    triggerResults.fishing_score = evaluateFishingScoreTrigger(
      triggers.fishing_score,
      weatherData,
      tideData,
      sunrise,
      sunset,
    );
    if (triggerResults.fishing_score.triggered) matchedTriggers.push('fishing_score');

    conditionSnapshot.fishing_score = triggerResults.fishing_score.currentValue as number;
  }

  // Apply logic mode (AND/OR)
  const enabledTriggerCount = Object.keys(triggerResults).length;
  let matches = false;
  let reason = '';

  if (enabledTriggerCount === 0) {
    reason = 'No triggers enabled';
  } else if (profile.logic_mode === 'AND') {
    matches = matchedTriggers.length === enabledTriggerCount;
    reason = matches
      ? `All ${enabledTriggerCount} triggers matched`
      : `Only ${matchedTriggers.length}/${enabledTriggerCount} triggers matched (AND mode)`;
  } else {
    matches = matchedTriggers.length > 0;
    reason = matches
      ? `${matchedTriggers.length} trigger(s) matched (OR mode)`
      : 'No triggers matched (OR mode)';
  }

  return {
    matches,
    matchedTriggers,
    triggerResults,
    reason,
    conditionSnapshot,
  };
}

// =============================================================================
// Database Operations
// =============================================================================

/**
 * Fetch all active alert profiles
 */
export async function getActiveAlertProfiles(): Promise<AlertProfile[]> {
  const { data, error } = await supabaseAdmin
    .from('user_alert_profiles')
    .select('*')
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching alert profiles:', error);
    throw error;
  }

  return (data || []) as AlertProfile[];
}

/**
 * Update alert profile after trigger
 */
export async function updateAlertProfileAfterTrigger(
  profileId: string,
  stateFlags: StateFlags,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_alert_profiles')
    .update({
      last_triggered_at: new Date().toISOString(),
      state_flags: stateFlags,
    })
    .eq('id', profileId);

  if (error) {
    console.error('Error updating alert profile:', error);
    throw error;
  }
}

/**
 * Update state flags only (for hysteresis tracking)
 */
export async function updateStateFlags(
  profileId: string,
  stateFlags: StateFlags,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('user_alert_profiles')
    .update({ state_flags: stateFlags })
    .eq('id', profileId);

  if (error) {
    console.error('Error updating state flags:', error);
    throw error;
  }
}

/**
 * Log alert to history
 */
export async function logAlertHistory(
  profileId: string,
  userId: string,
  matchedTriggers: string[],
  conditionSnapshot: ConditionSnapshot,
  notificationSent: boolean,
  notificationError?: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('alert_history')
    .insert({
      alert_profile_id: profileId,
      user_id: userId,
      matched_triggers: matchedTriggers,
      condition_snapshot: conditionSnapshot,
      notification_sent: notificationSent,
      notification_error: notificationError,
    });

  if (error) {
    console.error('Error logging alert history:', error);
    throw error;
  }
}

/**
 * Get user email by ID
 */
export async function getUserEmail(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);

  if (error || !data.user) {
    console.error('Error fetching user:', error);
    return null;
  }

  return data.user.email || null;
}

// =============================================================================
// Location Helpers
// =============================================================================

/**
 * Find the nearest CHS station for a location
 */
// =============================================================================
// Main Processing Function
// =============================================================================

/**
 * Process all active alert profiles
 * This is the main entry point called by the cron job
 */
export async function processAlerts(): Promise<{
  processed: number;
  triggered: number;
  skipped: number;
  errors: number;
  results: Array<{
    profileId: string;
    profileName: string;
    triggered: boolean;
    reason: string;
  }>;
  /** One claimed, ready-to-send digest per angler. */
  digestJobs: AlertDigestJob[];
}> {
  const results: Array<{
    profileId: string;
    profileName: string;
    triggered: boolean;
    reason: string;
  }> = [];

  let processed = 0;
  let triggered = 0;
  let skipped = 0;
  let errors = 0;
  let digestJobs: AlertDigestJob[] = [];

  try {
    // Fetch all active profiles
    const profiles = await getActiveAlertProfiles();
    console.log(`Processing ${profiles.length} active alert profiles`);

    // Score alerts and composite alerts share nothing but a table. Score alerts
    // read the bluecaster outlook; composite alerts read Open-Meteo and CHS.
    // Running them through one loop meant every score alert paid for a weather
    // and tide fetch it never opened.
    const scoreProfiles = profiles.filter(
      (p) => p.alert_kind === 'score' && p.target_bluecaster_spot_slug,
    );
    const compositeProfiles = profiles.filter(
      (p) => !(p.alert_kind === 'score' && p.target_bluecaster_spot_slug),
    );

    if (scoreProfiles.length > 0) {
      const scoreRun = await processScoreAlerts(scoreProfiles);
      digestJobs = scoreRun.digestJobs;
      results.push(...scoreRun.results);
      processed += scoreProfiles.length;
      triggered += scoreRun.results.filter((r) => r.triggered).length;
      errors += scoreRun.errors;
      console.log(
        `Score alerts: ${scoreProfiles.length} profiles, ${digestJobs.length} digests to send ` +
          `(${digestJobs.reduce((n, j) => n + j.items.length, 0)} items)`,
      );
    }

    // Group the rest by location to minimize API calls
    const locationGroups = new Map<string, AlertProfile[]>();

    for (const profile of compositeProfiles) {
      const key = `${profile.location_lat.toFixed(2)},${profile.location_lng.toFixed(2)}`;
      if (!locationGroups.has(key)) {
        locationGroups.set(key, []);
      }
      locationGroups.get(key)!.push(profile);
    }

    // Process each location group
    for (const [locationKey, locationProfiles] of locationGroups) {
      const [lat, lng] = locationKey.split(',').map(Number);

      try {
        // Fetch weather data for this location
        const weatherResult = await fetchOpenMeteoWeather({ lat, lon: lng }, 1);
        if (!weatherResult.success || !weatherResult.data) {
          console.error(`Failed to fetch weather for ${locationKey}`);
          for (const profile of locationProfiles) {
            results.push({
              profileId: profile.id,
              profileName: profile.name,
              triggered: false,
              reason: 'Failed to fetch weather data',
            });
            errors++;
          }
          continue;
        }

        const weatherData = weatherResult.data.minutely15;
        const dailyData = weatherResult.data.daily[0];
        const sunrise = dailyData?.sunrise ? new Date(dailyData.sunrise).getTime() / 1000 : 0;
        const sunset = dailyData?.sunset ? new Date(dailyData.sunset).getTime() / 1000 : 0;

        // Fetch tide data using GPS-based station registry
        const tideData = await fetchCHSTideDataByCoordinates(lat, lng).catch(err => {
          console.warn(`Tide data not available for alert at (${lat}, ${lng}):`, err);
          return null;
        });

        // Process each profile at this location
        for (const profile of locationProfiles) {
          processed++;

          try {
            // Check active hours
            if (!isWithinActiveHours(profile.active_hours)) {
              results.push({
                profileId: profile.id,
                profileName: profile.name,
                triggered: false,
                reason: 'Outside active hours',
              });
              skipped++;
              continue;
            }

            // Check cooldown
            if (!checkCooldown(profile.last_triggered_at, profile.cooldown_hours)) {
              results.push({
                profileId: profile.id,
                profileName: profile.name,
                triggered: false,
                reason: `In cooldown (${profile.cooldown_hours}h)`,
              });
              skipped++;
              continue;
            }

            // Evaluate triggers
            const evaluation = await evaluateAlertProfile(
              profile,
              weatherData,
              tideData,
              sunrise,
              sunset,
            );

            if (evaluation.matches) {
              // Apply hysteresis check
              let shouldTrigger = true;
              const newStateFlags = { ...profile.state_flags };

              for (const triggerName of evaluation.matchedTriggers) {
                const result = evaluation.triggerResults[triggerName];
                if (typeof result.currentValue === 'number') {
                  const hysteresisResult = checkHysteresis(
                    triggerName,
                    result.triggered,
                    result.currentValue,
                    profile.state_flags,
                  );

                  if (!hysteresisResult.shouldTrigger) {
                    shouldTrigger = false;
                  }
                  newStateFlags[triggerName] = hysteresisResult.newState;
                }
              }

              if (shouldTrigger) {
                // Alert triggered!
                triggered++;

                // Update profile
                await updateAlertProfileAfterTrigger(profile.id, newStateFlags);

                // Log to history
                await logAlertHistory(
                  profile.id,
                  profile.user_id,
                  evaluation.matchedTriggers,
                  evaluation.conditionSnapshot,
                  false, // Will be updated after notification is sent
                );

                results.push({
                  profileId: profile.id,
                  profileName: profile.name,
                  triggered: true,
                  reason: evaluation.reason,
                });
              } else {
                // Update state flags only
                await updateStateFlags(profile.id, newStateFlags);

                results.push({
                  profileId: profile.id,
                  profileName: profile.name,
                  triggered: false,
                  reason: 'Blocked by hysteresis',
                });
                skipped++;
              }
            } else {
              results.push({
                profileId: profile.id,
                profileName: profile.name,
                triggered: false,
                reason: evaluation.reason,
              });
            }
          } catch (profileError) {
            console.error(`Error processing profile ${profile.id}:`, profileError);
            results.push({
              profileId: profile.id,
              profileName: profile.name,
              triggered: false,
              reason: `Error: ${profileError instanceof Error ? profileError.message : 'Unknown'}`,
            });
            errors++;
          }
        }
      } catch (locationError) {
        console.error(`Error processing location ${locationKey}:`, locationError);
        for (const profile of locationProfiles) {
          results.push({
            profileId: profile.id,
            profileName: profile.name,
            triggered: false,
            reason: `Location error: ${locationError instanceof Error ? locationError.message : 'Unknown'}`,
          });
          errors++;
        }
      }
    }
  } catch (error) {
    console.error('Error in processAlerts:', error);
    throw error;
  }

  return { processed, triggered, skipped, errors, results, digestJobs };
}
