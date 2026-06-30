/**
 * Catch Logs CRUD API
 *
 * GET    /api/catches         - List user's catches (paginated)
 * POST   /api/catches         - Create new catch
 * PUT    /api/catches         - Update catch (requires id in body)
 * DELETE /api/catches?id=xxx  - Delete catch
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// =============================================================================
// Types
// =============================================================================

type CatchOutcome = 'bite' | 'landed'
type RetentionStatus = 'released' | 'kept'

interface CreateCatchInput {
  // Required
  caught_at: string
  location_lat: number
  location_lng: number
  outcome: CatchOutcome
  // Optional location details
  location_accuracy_m?: number
  location_heading?: number
  location_speed_kph?: number
  location_name?: string
  // Optional catch details
  species_id?: string
  species_name?: string
  retention_status?: RetentionStatus
  length_cm?: number
  weight_kg?: number
  depth_m?: number
  lure_id?: string
  lure_name?: string
  notes?: string
  photos?: string[]
  // Conditions context (jsonb) captured at log time
  weather_snapshot?: Record<string, unknown>
  tide_snapshot?: Record<string, unknown>
  moon_phase?: number
  // Offline sync
  client_id?: string
}

interface UpdateCatchInput extends Partial<CreateCatchInput> {
  id: string
}

// =============================================================================
// Validation
// =============================================================================

const VALID_OUTCOMES: CatchOutcome[] = ['bite', 'landed']
const VALID_RETENTION: RetentionStatus[] = ['released', 'kept']

function validateCatchInput(
  input: CreateCatchInput
): { valid: boolean; error?: string } {
  // Required fields
  if (!input.caught_at) {
    return { valid: false, error: 'caught_at is required' }
  }

  if (typeof input.location_lat !== 'number') {
    return { valid: false, error: 'location_lat is required' }
  }

  if (typeof input.location_lng !== 'number') {
    return { valid: false, error: 'location_lng is required' }
  }

  if (!input.outcome || !VALID_OUTCOMES.includes(input.outcome)) {
    return { valid: false, error: 'outcome must be bite or landed' }
  }

  // Validate coordinates
  if (input.location_lat < -90 || input.location_lat > 90) {
    return { valid: false, error: 'Invalid latitude' }
  }

  if (input.location_lng < -180 || input.location_lng > 180) {
    return { valid: false, error: 'Invalid longitude' }
  }

  // Validate optional fields
  if (input.retention_status && !VALID_RETENTION.includes(input.retention_status)) {
    return { valid: false, error: 'retention_status must be released or kept' }
  }

  if (input.length_cm !== undefined && (input.length_cm < 0 || input.length_cm > 500)) {
    return { valid: false, error: 'length_cm must be between 0 and 500' }
  }

  if (input.weight_kg !== undefined && (input.weight_kg < 0 || input.weight_kg > 500)) {
    return { valid: false, error: 'weight_kg must be between 0 and 500' }
  }

  if (input.depth_m !== undefined && (input.depth_m < 0 || input.depth_m > 1000)) {
    return { valid: false, error: 'depth_m must be between 0 and 1000' }
  }

  if (input.location_heading !== undefined && (input.location_heading < 0 || input.location_heading > 360)) {
    return { valid: false, error: 'location_heading must be between 0 and 360' }
  }

  return { valid: true }
}

// =============================================================================
// Auth Helper
// =============================================================================

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.substring(7)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return null
  }

  return user.id
}

// =============================================================================
// GET - List user's catches
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')
    const species = searchParams.get('species')
    const outcome = searchParams.get('outcome') as CatchOutcome | null
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Build query
    let query = supabaseAdmin
      .from('catch_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('caught_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (species) {
      query = query.eq('species_id', species)
    }

    if (outcome && VALID_OUTCOMES.includes(outcome)) {
      query = query.eq('outcome', outcome)
    }

    if (startDate) {
      query = query.gte('caught_at', startDate)
    }

    if (endDate) {
      query = query.lte('caught_at', endDate)
    }

    const { data: catches, error, count } = await query

    if (error) {
      console.error('Error fetching catches:', error)
      return NextResponse.json({ error: 'Failed to fetch catches' }, { status: 500 })
    }

    return NextResponse.json({
      catches,
      total: count,
      limit,
      offset,
    })
  } catch (error) {
    console.error('Error in GET /api/catches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// POST - Create new catch
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateCatchInput = await request.json()

    // Validate input
    const validation = validateCatchInput(body)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    // Check for duplicate (offline sync deduplication)
    if (body.client_id) {
      const { data: existing } = await supabaseAdmin
        .from('catch_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('client_id', body.client_id)
        .single()

      if (existing) {
        // Return existing record instead of creating duplicate
        const { data: fullRecord } = await supabaseAdmin
          .from('catch_logs')
          .select('*')
          .eq('id', existing.id)
          .single()

        return NextResponse.json({ catch: fullRecord, deduplicated: true }, { status: 200 })
      }
    }

    // Create catch
    const { data: catchRecord, error } = await supabaseAdmin
      .from('catch_logs')
      .insert({
        user_id: userId,
        caught_at: body.caught_at,
        location_lat: body.location_lat,
        location_lng: body.location_lng,
        location_accuracy_m: body.location_accuracy_m || null,
        location_heading: body.location_heading || null,
        location_speed_kph: body.location_speed_kph || null,
        location_name: body.location_name || null,
        outcome: body.outcome,
        species_id: body.species_id || null,
        species_name: body.species_name || null,
        retention_status: body.retention_status || null,
        length_cm: body.length_cm || null,
        weight_kg: body.weight_kg || null,
        depth_m: body.depth_m || null,
        lure_id: body.lure_id || null,
        lure_name: body.lure_name || null,
        notes: body.notes || null,
        photos: body.photos || [],
        weather_snapshot: body.weather_snapshot || null,
        tide_snapshot: body.tide_snapshot || null,
        moon_phase: body.moon_phase ?? null,
        client_id: body.client_id || null,
        synced_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating catch:', error)
      return NextResponse.json({ error: 'Failed to create catch' }, { status: 500 })
    }

    return NextResponse.json({ catch: catchRecord }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/catches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// PUT - Update catch
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: UpdateCatchInput = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Catch ID is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('catch_logs')
      .select('user_id')
      .eq('id', body.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Catch not found' }, { status: 404 })
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (body.outcome !== undefined) {
      if (!VALID_OUTCOMES.includes(body.outcome)) {
        return NextResponse.json({ error: 'outcome must be bite or landed' }, { status: 400 })
      }
      updates.outcome = body.outcome
    }

    if (body.species_id !== undefined) {
      updates.species_id = body.species_id
    }

    if (body.species_name !== undefined) {
      updates.species_name = body.species_name
    }

    if (body.retention_status !== undefined) {
      if (body.retention_status && !VALID_RETENTION.includes(body.retention_status)) {
        return NextResponse.json({ error: 'retention_status must be released or kept' }, { status: 400 })
      }
      updates.retention_status = body.retention_status
    }

    if (body.length_cm !== undefined) {
      if (body.length_cm !== null && (body.length_cm < 0 || body.length_cm > 500)) {
        return NextResponse.json({ error: 'length_cm must be between 0 and 500' }, { status: 400 })
      }
      updates.length_cm = body.length_cm
    }

    if (body.weight_kg !== undefined) {
      if (body.weight_kg !== null && (body.weight_kg < 0 || body.weight_kg > 500)) {
        return NextResponse.json({ error: 'weight_kg must be between 0 and 500' }, { status: 400 })
      }
      updates.weight_kg = body.weight_kg
    }

    if (body.depth_m !== undefined) {
      if (body.depth_m !== null && (body.depth_m < 0 || body.depth_m > 1000)) {
        return NextResponse.json({ error: 'depth_m must be between 0 and 1000' }, { status: 400 })
      }
      updates.depth_m = body.depth_m
    }

    if (body.lure_id !== undefined) {
      updates.lure_id = body.lure_id
    }

    if (body.lure_name !== undefined) {
      updates.lure_name = body.lure_name
    }

    if (body.notes !== undefined) {
      updates.notes = body.notes
    }

    if (body.photos !== undefined) {
      updates.photos = body.photos
    }

    if (body.location_name !== undefined) {
      updates.location_name = body.location_name
    }

    // Update catch
    const { data: catchRecord, error } = await supabaseAdmin
      .from('catch_logs')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating catch:', error)
      return NextResponse.json({ error: 'Failed to update catch' }, { status: 500 })
    }

    return NextResponse.json({ catch: catchRecord })
  } catch (error) {
    console.error('Error in PUT /api/catches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// DELETE - Delete catch
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const catchId = searchParams.get('id')

    if (!catchId) {
      return NextResponse.json({ error: 'Catch ID is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('catch_logs')
      .select('user_id')
      .eq('id', catchId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Catch not found' }, { status: 404 })
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete catch
    const { error } = await supabaseAdmin.from('catch_logs').delete().eq('id', catchId)

    if (error) {
      console.error('Error deleting catch:', error)
      return NextResponse.json({ error: 'Failed to delete catch' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/catches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
