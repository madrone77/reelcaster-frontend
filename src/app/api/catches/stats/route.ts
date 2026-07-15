/**
 * Catch Log season stats
 *
 * GET /api/catches/stats?since=<ISO> — aggregates the caller's logged
 * (non-draft) catches for the "My catches" header row. `since` defaults
 * to Jan 1 of the current year (the "season").
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function getUserFromRequest(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.substring(7)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)
  if (error || !user) return null
  return user.id
}

interface StatsRow {
  weight_kg: number | null
  species_id: string | null
  species_name: string | null
  spot_id: string | null
  location_name: string | null
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sinceParam = searchParams.get('since')
    const since =
      sinceParam && !isNaN(Date.parse(sinceParam))
        ? new Date(sinceParam)
        : new Date(new Date().getFullYear(), 0, 1)

    const { data, error } = await supabaseAdmin
      .from('catch_logs')
      .select('weight_kg, species_id, species_name, spot_id, location_name')
      .eq('user_id', userId)
      .eq('status', 'logged')
      .gte('caught_at', since.toISOString())

    if (error) {
      console.error('Error fetching catch stats:', error)
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
    }

    const rows = (data ?? []) as StatsRow[]
    const weights = rows
      .map((r) => (r.weight_kg === null ? null : Number(r.weight_kg)))
      .filter((w): w is number => w !== null && Number.isFinite(w))

    const species = new Set<string>()
    const spots = new Set<string>()
    for (const r of rows) {
      const sp = r.species_id || r.species_name
      if (sp) species.add(sp)
      const spot = r.spot_id || r.location_name
      if (spot) spots.add(spot)
    }

    return NextResponse.json({
      since: since.toISOString(),
      catches: rows.length,
      avg_weight_kg: weights.length
        ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100) / 100
        : null,
      best_weight_kg: weights.length ? Math.max(...weights) : null,
      species_count: species.size,
      spots_fished: spots.size,
    })
  } catch (error) {
    console.error('Error in GET /api/catches/stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
