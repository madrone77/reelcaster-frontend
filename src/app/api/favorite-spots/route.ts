/**
 * Saved locations CRUD API — NOT the star on a spot card.
 *
 * Despite the path, this has nothing to do with saved spots. It stores an
 * arbitrary place the user described (a name and a lat/lon they typed or
 * picked), enriched against BlueCaster reference data, and today its only
 * product surface is the default-location picker — the location panel and the
 * "set default location" modal. The path and the `favorite_spots` table keep
 * their names because renaming a live route and table buys nothing; the concept
 * is saved *locations*.
 *
 * The star on a spot card is `/api/saved-spots`, backed by
 * `user_favorite_spots`. If you are looking for what the dashboard's "Saved
 * spots" section reads, it is that one, not this.
 *
 * GET    /api/favorite-spots         - List user's saved locations
 * POST   /api/favorite-spots         - Create one (with BlueCaster enrichment + tier gate)
 * PUT    /api/favorite-spots         - Update one (requires id in body)
 * DELETE /api/favorite-spots?id=xxx  - Delete one
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchSpotsByCoordinates } from '@/lib/bluecaster'
import { resolveEntitlement } from '@/lib/entitlement'
import { COVERED_PROVINCES } from '@/lib/regions'
import { FREE_FAVORITE_SPOTS } from '@/lib/plan-features'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!


function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'spot'
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

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
// GET - List user's favorite spots
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: spots, error } = await supabaseAdmin
      .from('favorite_spots')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching favorite spots:', error)
      return NextResponse.json({ error: 'Failed to fetch favorite spots' }, { status: 500 })
    }

    return NextResponse.json({ spots })
  } catch (error) {
    console.error('Error in GET /api/favorite-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// POST - Create new favorite spot
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
      return NextResponse.json({ error: 'Valid lat is required' }, { status: 400 })
    }
    if (typeof body.lon !== 'number' || body.lon < -180 || body.lon > 180) {
      return NextResponse.json({ error: 'Valid lon is required' }, { status: 400 })
    }

    // Tier gate: free tier capped at FREE_FAVORITE_SPOTS; paid is unlimited.
    const [{ isPro: isPaid }, { count: existingCount }] = await Promise.all([
      resolveEntitlement(supabaseAdmin, userId),
      supabaseAdmin
        .from('favorite_spots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    if (!isPaid && (existingCount ?? 0) >= FREE_FAVORITE_SPOTS) {
      return NextResponse.json(
        {
          error: `Member accounts are limited to ${FREE_FAVORITE_SPOTS} ${
            FREE_FAVORITE_SPOTS === 1 ? 'spot' : 'spots'
          }`,
          upgrade_required: true,
        },
        { status: 402 },
      )
    }

    // Enrich coordinates against BlueCaster reference data. Best-effort —
    // a missing/erroring backend should not block spot creation.
    const enrichment = await fetchSpotsByCoordinates(body.lat, body.lon)
    const provinceCode = enrichment?.province?.code ?? null
    const isCovered = provinceCode
      ? (COVERED_PROVINCES as readonly string[]).includes(provinceCode)
      : false

    // Free user in uncovered region → push to waitlist instead.
    if (!isPaid && !isCovered && enrichment) {
      return NextResponse.json(
        {
          error: 'This region is not yet covered',
          waitlist_required: true,
          province_code: provinceCode,
        },
        { status: 403 },
      )
    }

    const coverageTier = isCovered ? 't1' : !isPaid ? null : 't3'

    // Generate a unique slug per user. Append counter on collision.
    const baseSlug = slugify(body.name)
    let slug = baseSlug
    for (let i = 1; i < 50; i++) {
      const { data: dupe } = await supabaseAdmin
        .from('favorite_spots')
        .select('id')
        .eq('user_id', userId)
        .eq('slug', slug)
        .maybeSingle()
      if (!dupe) break
      slug = `${baseSlug}-${i}`
    }

    const { data: spot, error } = await supabaseAdmin
      .from('favorite_spots')
      .insert({
        user_id: userId,
        name: body.name.trim(),
        location: body.location || enrichment?.nearest_city?.name || null,
        lat: body.lat,
        lon: body.lon,
        notes: body.notes || null,
        slug,
        coverage_tier: coverageTier,
        dfo_area: enrichment?.dfo?.name ?? null,
        tide_offset_minutes: enrichment?.nearest_tide_station?.time_offset_minutes ?? null,
        suggested_species_fingerprint: enrichment?.suggested_species ?? null,
        expected_species: Array.isArray(body.expected_species) ? body.expected_species : null,
        access_notes: typeof body.access_notes === 'string' ? body.access_notes : null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating favorite spot:', error)
      return NextResponse.json({ error: 'Failed to create favorite spot' }, { status: 500 })
    }

    return NextResponse.json({ spot, enrichment }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/favorite-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// PUT - Update favorite spot
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    if (!body.id) {
      return NextResponse.json({ error: 'Spot ID is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('favorite_spots')
      .select('user_id')
      .eq('id', body.id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Build update object
    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 })
      }
      updates.name = body.name.trim()
    }

    if (body.location !== undefined) updates.location = body.location
    if (body.notes !== undefined) updates.notes = body.notes

    if (body.lat !== undefined) {
      if (typeof body.lat !== 'number' || body.lat < -90 || body.lat > 90) {
        return NextResponse.json({ error: 'Invalid lat' }, { status: 400 })
      }
      updates.lat = body.lat
    }

    if (body.lon !== undefined) {
      if (typeof body.lon !== 'number' || body.lon < -180 || body.lon > 180) {
        return NextResponse.json({ error: 'Invalid lon' }, { status: 400 })
      }
      updates.lon = body.lon
    }

    const { data: spot, error } = await supabaseAdmin
      .from('favorite_spots')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating favorite spot:', error)
      return NextResponse.json({ error: 'Failed to update favorite spot' }, { status: 500 })
    }

    return NextResponse.json({ spot })
  } catch (error) {
    console.error('Error in PUT /api/favorite-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// DELETE - Delete favorite spot
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const spotId = searchParams.get('id')

    if (!spotId) {
      return NextResponse.json({ error: 'Spot ID is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('favorite_spots')
      .select('user_id')
      .eq('id', spotId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
    }

    if (existing.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const { error } = await supabaseAdmin.from('favorite_spots').delete().eq('id', spotId)

    if (error) {
      console.error('Error deleting favorite spot:', error)
      return NextResponse.json({ error: 'Failed to delete favorite spot' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/favorite-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
