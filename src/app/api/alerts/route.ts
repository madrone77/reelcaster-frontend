/**
 * Alert Profiles CRUD API
 *
 * GET    /api/alerts         - List user's alert profiles
 * POST   /api/alerts         - Create new alert profile
 * PUT    /api/alerts         - Update alert profile (requires id in body)
 * DELETE /api/alerts?id=xxx  - Delete alert profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { AlertTriggers } from '@/lib/custom-alert-engine';
import type { LeadTimeMode } from '@/lib/score-beats';
import { resolveEntitlement } from '@/lib/entitlement';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// =============================================================================
// Validation
// =============================================================================

interface CreateAlertProfileInput {
  name: string;
  location_lat: number;
  location_lng: number;
  location_name?: string;
  triggers: AlertTriggers;
  active_hours?: { start: string; end: string };
  logic_mode?: 'AND' | 'OR';
  cooldown_hours?: number;
  // Phase 6 simple Score Alert flow
  alert_kind?: 'composite' | 'score';
  target_bluecaster_spot_slug?: string | null;
  target_species?: string | null;
  score_threshold?: number | null;
  delivery_channels?: ('email' | 'sms')[];
  /**
   * How far ahead a score alert may speak. The column has existed since the
   * lead-time migration with a DB default of 'asap', but nothing ever wrote
   * it, so every alert got the six-day heads-up whether the angler wanted
   * one or not. The create dialog now asks. Day caps live in score-beats.ts.
   */
  lead_time_mode?: LeadTimeMode;
}

function isLeadTimeMode(v: unknown): v is LeadTimeMode {
  return v === 'asap' || v === 'short' || v === 'day_of';
}

interface UpdateAlertProfileInput extends Partial<CreateAlertProfileInput> {
  id: string;
  is_active?: boolean;
}

function validateTriggers(triggers: AlertTriggers): { valid: boolean; error?: string } {
  if (!triggers || typeof triggers !== 'object') {
    return { valid: false, error: 'Triggers must be an object' };
  }

  // Validate wind trigger
  if (triggers.wind?.enabled) {
    if (typeof triggers.wind.speed_min !== 'number' || typeof triggers.wind.speed_max !== 'number') {
      return { valid: false, error: 'Wind trigger requires speed_min and speed_max' };
    }
    if (triggers.wind.speed_min < 0 || triggers.wind.speed_max > 100) {
      return { valid: false, error: 'Wind speed must be between 0 and 100 mph' };
    }
    if (triggers.wind.speed_min > triggers.wind.speed_max) {
      return { valid: false, error: 'Wind speed_min must be less than speed_max' };
    }
    if (triggers.wind.direction_center !== undefined) {
      if (triggers.wind.direction_center < 0 || triggers.wind.direction_center > 360) {
        return { valid: false, error: 'Wind direction must be between 0 and 360 degrees' };
      }
    }
    if (triggers.wind.direction_tolerance !== undefined) {
      if (triggers.wind.direction_tolerance < 0 || triggers.wind.direction_tolerance > 180) {
        return { valid: false, error: 'Wind direction tolerance must be between 0 and 180 degrees' };
      }
    }
  }

  // Validate tide trigger
  if (triggers.tide?.enabled) {
    if (!Array.isArray(triggers.tide.phases) || triggers.tide.phases.length === 0) {
      return { valid: false, error: 'Tide trigger requires at least one phase' };
    }
    const validPhases = ['incoming', 'outgoing', 'high_slack', 'low_slack'];
    for (const phase of triggers.tide.phases) {
      if (!validPhases.includes(phase)) {
        return { valid: false, error: `Invalid tide phase: ${phase}` };
      }
    }
    if (triggers.tide.exchange_min !== undefined && triggers.tide.exchange_min < 0) {
      return { valid: false, error: 'Tidal exchange minimum must be positive' };
    }
  }

  // Validate pressure trigger
  if (triggers.pressure?.enabled) {
    if (!['rising', 'falling', 'steady'].includes(triggers.pressure.trend)) {
      return { valid: false, error: 'Pressure trend must be rising, falling, or steady' };
    }
  }

  // Validate water temp trigger
  if (triggers.water_temp?.enabled) {
    if (typeof triggers.water_temp.min !== 'number' || typeof triggers.water_temp.max !== 'number') {
      return { valid: false, error: 'Water temp trigger requires min and max' };
    }
    if (triggers.water_temp.min > triggers.water_temp.max) {
      return { valid: false, error: 'Water temp min must be less than max' };
    }
  }

  // Validate solunar trigger
  if (triggers.solunar?.enabled) {
    if (!Array.isArray(triggers.solunar.phases) || triggers.solunar.phases.length === 0) {
      return { valid: false, error: 'Solunar trigger requires at least one phase' };
    }
    const validSolunarPhases = ['major', 'minor'];
    for (const phase of triggers.solunar.phases) {
      if (!validSolunarPhases.includes(phase)) {
        return { valid: false, error: `Invalid solunar phase: ${phase}` };
      }
    }
  }

  // Validate fishing score trigger
  if (triggers.fishing_score?.enabled) {
    if (typeof triggers.fishing_score.min_score !== 'number') {
      return { valid: false, error: 'Fishing score trigger requires min_score' };
    }
    if (triggers.fishing_score.min_score < 0 || triggers.fishing_score.min_score > 100) {
      return { valid: false, error: 'Fishing score must be between 0 and 100' };
    }
  }

  // Check that at least one trigger is enabled
  const hasEnabledTrigger = Object.values(triggers).some(
    (t) => t && typeof t === 'object' && 'enabled' in t && t.enabled
  );
  if (!hasEnabledTrigger) {
    return { valid: false, error: 'At least one trigger must be enabled' };
  }

  return { valid: true };
}

function validateActiveHours(activeHours: { start: string; end: string }): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(activeHours.start) && timeRegex.test(activeHours.end);
}

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  // Use anon key client with auth header to validate user JWT
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user.id;
}

// =============================================================================
// GET - List user's alert profiles
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeHistory = searchParams.get('include_history') === 'true';

    // Fetch profiles
    const { data: profiles, error } = await supabaseAdmin
      .from('user_alert_profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching profiles:', error);
      return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
    }

    // Optionally include recent history
    const history: Record<string, unknown[]> = {};
    if (includeHistory && profiles && profiles.length > 0) {
      const profileIds = profiles.map((p) => p.id);
      const { data: historyData } = await supabaseAdmin
        .from('alert_history')
        .select('*')
        .in('alert_profile_id', profileIds)
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (historyData) {
        // Group by profile
        for (const entry of historyData) {
          if (!history[entry.alert_profile_id]) {
            history[entry.alert_profile_id] = [];
          }
          history[entry.alert_profile_id].push(entry);
        }
      }
    }

    return NextResponse.json({
      profiles,
      history: includeHistory ? history : undefined,
    });
  } catch (error) {
    console.error('Error in GET /api/alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// POST - Create new alert profile
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateAlertProfileInput = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (typeof body.location_lat !== 'number' || typeof body.location_lng !== 'number') {
      return NextResponse.json({ error: 'Location coordinates are required' }, { status: 400 });
    }

    if (body.location_lat < -90 || body.location_lat > 90) {
      return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
    }

    if (body.location_lng < -180 || body.location_lng > 180) {
      return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
    }

    // Validate triggers
    const triggerValidation = validateTriggers(body.triggers);
    if (!triggerValidation.valid) {
      return NextResponse.json({ error: triggerValidation.error }, { status: 400 });
    }

    // Validate active hours if provided
    if (body.active_hours && !validateActiveHours(body.active_hours)) {
      return NextResponse.json({ error: 'Invalid active hours format (use HH:MM)' }, { status: 400 });
    }

    // Validate logic mode
    if (body.logic_mode && !['AND', 'OR'].includes(body.logic_mode)) {
      return NextResponse.json({ error: 'Logic mode must be AND or OR' }, { status: 400 });
    }

    // Validate cooldown hours
    if (body.cooldown_hours !== undefined) {
      if (body.cooldown_hours < 1 || body.cooldown_hours > 168) {
        return NextResponse.json({ error: 'Cooldown hours must be between 1 and 168' }, { status: 400 });
      }
    }

    if (body.lead_time_mode !== undefined && !isLeadTimeMode(body.lead_time_mode)) {
      return NextResponse.json({ error: 'Invalid lead_time_mode' }, { status: 400 });
    }

    // Tier-aware limit: free users get 1 alert, paid get 10.
    const { count } = await supabaseAdmin
      .from('user_alert_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { isPro: isPaid } = await resolveEntitlement(supabaseAdmin, userId);
    const limit = isPaid ? 10 : 1;

    if (count !== null && count >= limit) {
      return NextResponse.json(
        {
          error: isPaid
            ? 'Maximum of 10 alert profiles allowed'
            : 'Member accounts get 1 alert. Upgrade to Pro for up to 10.',
          upgrade_required: !isPaid,
        },
        { status: 400 },
      );
    }

    // SMS delivery requires a verified phone — strip 'sms' if not verified.
    let deliveryChannels = body.delivery_channels ?? ['email'];
    if (deliveryChannels.includes('sms')) {
      const { data: phoneCheck } = await supabaseAdmin
        .from('user_settings')
        .select('phone_verified')
        .eq('user_id', userId)
        .maybeSingle();
      if (!phoneCheck?.phone_verified) {
        deliveryChannels = deliveryChannels.filter((c) => c !== 'sms');
      }
    }
    if (deliveryChannels.length === 0) deliveryChannels = ['email'];

    // Create profile
    const { data: profile, error } = await supabaseAdmin
      .from('user_alert_profiles')
      .insert({
        user_id: userId,
        name: body.name.trim(),
        location_lat: body.location_lat,
        location_lng: body.location_lng,
        location_name: body.location_name?.trim() || null,
        triggers: body.triggers,
        active_hours: body.active_hours || null,
        logic_mode: body.logic_mode || 'AND',
        cooldown_hours: body.cooldown_hours || 12,
        alert_kind: body.alert_kind ?? 'composite',
        target_bluecaster_spot_slug: body.target_bluecaster_spot_slug ?? null,
        target_species: body.target_species ?? null,
        score_threshold: body.score_threshold ?? null,
        delivery_channels: deliveryChannels,
        lead_time_mode: body.lead_time_mode ?? 'asap',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
    }

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// PUT - Update alert profile
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: UpdateAlertProfileInput = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('user_alert_profiles')
      .select('user_id')
      .eq('id', body.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build update object
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.location_lat !== undefined) {
      if (body.location_lat < -90 || body.location_lat > 90) {
        return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
      }
      updates.location_lat = body.location_lat;
    }

    if (body.location_lng !== undefined) {
      if (body.location_lng < -180 || body.location_lng > 180) {
        return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
      }
      updates.location_lng = body.location_lng;
    }

    if (body.location_name !== undefined) {
      updates.location_name = body.location_name?.trim() || null;
    }

    if (body.triggers !== undefined) {
      const triggerValidation = validateTriggers(body.triggers);
      if (!triggerValidation.valid) {
        return NextResponse.json({ error: triggerValidation.error }, { status: 400 });
      }
      updates.triggers = body.triggers;
    }

    if (body.active_hours !== undefined) {
      if (body.active_hours && !validateActiveHours(body.active_hours)) {
        return NextResponse.json({ error: 'Invalid active hours format' }, { status: 400 });
      }
      updates.active_hours = body.active_hours;
    }

    if (body.logic_mode !== undefined) {
      if (!['AND', 'OR'].includes(body.logic_mode)) {
        return NextResponse.json({ error: 'Logic mode must be AND or OR' }, { status: 400 });
      }
      updates.logic_mode = body.logic_mode;
    }

    if (body.cooldown_hours !== undefined) {
      if (body.cooldown_hours < 1 || body.cooldown_hours > 168) {
        return NextResponse.json({ error: 'Cooldown hours must be between 1 and 168' }, { status: 400 });
      }
      updates.cooldown_hours = body.cooldown_hours;
    }

    if (body.lead_time_mode !== undefined) {
      if (!isLeadTimeMode(body.lead_time_mode)) {
        return NextResponse.json({ error: 'Invalid lead_time_mode' }, { status: 400 });
      }
      updates.lead_time_mode = body.lead_time_mode;
    }

    if (body.is_active !== undefined) {
      updates.is_active = body.is_active;
    }

    // Update profile
    const { data: profile, error } = await supabaseAdmin
      .from('user_alert_profiles')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error in PUT /api/alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =============================================================================
// DELETE - Delete alert profile
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('id');

    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('user_alert_profiles')
      .select('user_id')
      .eq('id', profileId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete profile (cascade will delete history)
    const { error } = await supabaseAdmin
      .from('user_alert_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      console.error('Error deleting profile:', error);
      return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/alerts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
