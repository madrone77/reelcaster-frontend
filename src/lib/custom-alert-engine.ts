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

export type LeadTimeMode = 'asap' | 'short' | 'day_of';

export type AlertBeat = 'heads_up' | 'confirm' | 'stand_down';

/**
 * How many days ahead each mode is willing to look.
 *
 * These live in code, not in the database, so they can be retuned against
 * measured forecast stability without a migration and without changing what an
 * angler's saved alert means. Six is a deliberate ceiling: past roughly a week
 * the weather models sit close to climatology, and an alert that is wrong a
 * third of the time trains people to ignore it.
 */
const LEAD_CAP_DAYS: Record<LeadTimeMode, number> = {
  asap: 6,
  short: 3,
  day_of: 0,
};

/**
 * Below this many days out we do not bother with a heads-up: the confirm beat
 * is already about to fire, and two messages a day apart saying the same thing
 * is how an alert becomes noise.
 */
const MIN_HEADS_UP_LEAD_DAYS = 2;

/** One message we intend to send, already claimed in the ledger. */
export interface AlertSendJob {
  /** alert_day_notices row id, to stamp once the send resolves. */
  noticeId: string;
  profileId: string;
  beat: AlertBeat;
  /** The fishing day this message is about, YYYY-MM-DD. */
  targetDate: string;
  leadDays: number;
  score: number;
  /** False when we fell back to the spot's best species. */
  speciesMatched: boolean;
  scoredSpeciesSlug: string | null;
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
// Daytime window (spot-local) in which a "today's peak" score alert may fire —
// keeps us from texting "today looks great" at 1am when the day rolls over.
const SCORE_ALERT_HOUR_START = 6;
const SCORE_ALERT_HOUR_END = 21;

function currentHourInZone(timezone = 'America/Vancouver'): number {
  const hh = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  // '24' can appear for midnight in some environments; normalize to 0.
  return Number(hh) % 24;
}

export function scoreThresholdFor(profile: AlertProfile): number {
  return profile.score_threshold ?? profile.triggers.fishing_score?.min_score ?? 75;
}

function leadModeFor(profile: AlertProfile): LeadTimeMode {
  const mode = profile.lead_time_mode;
  return mode === 'asap' || mode === 'short' || mode === 'day_of' ? mode : 'asap';
}

/** A message we want to send, before it has been claimed in the ledger. */
interface ScoreBeatCandidate {
  beat: AlertBeat;
  targetDate: string;
  leadDays: number;
  score: number;
}

/**
 * Work out which messages a score alert owes the angler, given the spot's
 * 14-day outlook.
 *
 * Pure and synchronous: the caller fetches the outlook once per spot and passes
 * it in, so ten alerts on Victoria Waterfront cost one round trip rather than
 * ten. Deduplication is not this function's job either. It happily proposes the
 * same heads-up every run, and the unique constraint on `alert_day_notices` is
 * what makes the second one a no-op.
 *
 * Beats, by how far out the qualifying day is:
 *
 *   2 days or more   heads_up, the early warning that makes booking possible
 *   0 to 1 days      confirm, "it held, go"
 *
 * `stand_down` (the day fell apart after we promised it) is not emitted yet. It
 * needs to look up whether a heads-up went out for that day, which lands with
 * the morning-check job.
 */
export function scoreBeatsFor(
  profile: AlertProfile,
  outlook: SpotSpeciesOutlook,
): ScoreBeatCandidate[] {
  // The quiet-hours gate is about when we SEND, not what we send about, so it
  // short-circuits everything. Nobody wants a text about next Saturday at 2am.
  const hour = currentHourInZone();
  if (hour < SCORE_ALERT_HOUR_START || hour >= SCORE_ALERT_HOUR_END) return [];

  const threshold = scoreThresholdFor(profile);
  const mode = leadModeFor(profile);
  const cap = LEAD_CAP_DAYS[mode];

  // day_of never looks past today, so its confirm window is today alone.
  const confirmMaxLead = mode === 'day_of' ? 0 : 1;

  const beats: ScoreBeatCandidate[] = [];
  let headsUpSent = false;

  for (const day of outlook.days) {
    if (day.dayIndex > cap) continue;
    if (day.peak < threshold) continue;

    if (day.dayIndex <= confirmMaxLead) {
      // Today and tomorrow are different days, and both being good is worth
      // two messages. There are at most two of them.
      beats.push({
        beat: 'confirm',
        targetDate: day.date,
        leadDays: day.dayIndex,
        score: day.peak,
      });
    } else if (day.dayIndex >= MIN_HEADS_UP_LEAD_DAYS && !headsUpSent) {
      // At most ONE heads-up per run, the nearest qualifying day.
      //
      // A settled summer week can put five days over the threshold at once.
      // Without this, the first run after an alert is created (or after this
      // feature shipped, when the ledger was empty for every existing alert)
      // fires a separate message for each of them inside one tick. Five emails
      // in a minute reads as a broken integration, not a useful service.
      //
      // The other days are not lost. They stay unclaimed in the ledger, so the
      // next run picks up the next nearest one, and the window naturally doles
      // them out over following days instead of dumping them.
      beats.push({
        beat: 'heads_up',
        targetDate: day.date,
        leadDays: day.dayIndex,
        score: day.peak,
      });
      headsUpSent = true;
    }
  }

  return beats;
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
 * Run every score alert and return the messages to send.
 *
 * Grouped by spot slug rather than by lat/lng: score alerts read the bluecaster
 * outlook and touch neither Open-Meteo nor CHS, so they have no business in the
 * location loop that fetches both.
 */
async function processScoreAlerts(profiles: AlertProfile[]): Promise<{
  sendJobs: AlertSendJob[];
  results: Array<{ profileId: string; profileName: string; triggered: boolean; reason: string }>;
  errors: number;
}> {
  const sendJobs: AlertSendJob[] = [];
  const results: Array<{
    profileId: string;
    profileName: string;
    triggered: boolean;
    reason: string;
  }> = [];
  let errors = 0;

  const bySlug = new Map<string, AlertProfile[]>();
  for (const profile of profiles) {
    const slug = profile.target_bluecaster_spot_slug;
    if (!slug) continue;
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug)!.push(profile);
  }

  for (const [slug, slugProfiles] of bySlug) {
    // One outlook per spot, shared by every alert pointed at it. The species
    // resolution inside differs per alert, so the fetch is per (spot, species)
    // in principle, but the overwhelmingly common case is a handful of alerts
    // on the same spot and the response carries every species' grid anyway.
    const outlookCache = new Map<string, SpotSpeciesOutlook | null>();

    for (const profile of slugProfiles) {
      try {
        const speciesKey = profile.target_species ?? '';
        if (!outlookCache.has(speciesKey)) {
          outlookCache.set(speciesKey, await fetchSpotSpeciesOutlook(slug, profile.target_species ?? null));
        }
        const outlook = outlookCache.get(speciesKey) ?? null;

        if (!outlook) {
          results.push({
            profileId: profile.id,
            profileName: profile.name,
            triggered: false,
            reason: 'Spot outlook unavailable',
          });
          continue;
        }

        const candidates = scoreBeatsFor(profile, outlook);
        if (candidates.length === 0) {
          const best = outlook.days.reduce((m, d) => (d.peak > m ? d.peak : m), 0);
          results.push({
            profileId: profile.id,
            profileName: profile.name,
            triggered: false,
            reason: `No day in window at or above ${scoreThresholdFor(profile)} (best ${best.toFixed(0)}), or outside send hours`,
          });
          continue;
        }

        const channels: string[] = profile.delivery_channels ?? ['email'];
        let claimed = 0;

        for (const candidate of candidates) {
          const noticeId = await claimBeat(profile, candidate, channels);
          // Already sent for this day and beat. The common case on every tick
          // after the first, and entirely uninteresting.
          if (!noticeId) continue;

          claimed++;
          sendJobs.push({
            noticeId,
            profileId: profile.id,
            beat: candidate.beat,
            targetDate: candidate.targetDate,
            leadDays: candidate.leadDays,
            score: candidate.score,
            speciesMatched: outlook.speciesMatched,
            scoredSpeciesSlug: outlook.scoredSpeciesSlug,
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
  }

  return { sendJobs, results, errors };
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
  /** Claimed score-alert messages awaiting delivery. */
  sendJobs: AlertSendJob[];
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
  let sendJobs: AlertSendJob[] = [];

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
      sendJobs = scoreRun.sendJobs;
      results.push(...scoreRun.results);
      processed += scoreProfiles.length;
      triggered += scoreRun.results.filter((r) => r.triggered).length;
      errors += scoreRun.errors;
      console.log(
        `Score alerts: ${scoreProfiles.length} profiles, ${sendJobs.length} messages to send`,
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

  return { processed, triggered, skipped, errors, results, sendJobs };
}
