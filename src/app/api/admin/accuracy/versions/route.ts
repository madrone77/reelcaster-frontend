/**
 * Algorithm Versions API
 *
 * GET /api/admin/accuracy/versions?location=...&from=...&to=...
 *
 * Returns all algorithm versions with their accuracy metrics for comparison.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const location = searchParams.get('location')
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    // Fetch all algorithm versions
    const { data: versions, error: verError } = await supabase
      .from('algorithm_versions')
      .select('*')
      .order('created_at', { ascending: false })

    if (verError) {
      return NextResponse.json({ error: verError.message }, { status: 500 })
    }

    // Fetch accuracy data per version
    const endDate = to || new Date().toISOString().split('T')[0]
    const startDate = from || (() => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - 30)
      return d.toISOString().split('T')[0]
    })()

    let query = supabase
      .from('accuracy_comparisons')
      .select('algorithm_version, abs_error, blocks_compared, blocks_within_1pt, blocks_within_2pt')
      .gte('comparison_date', startDate)
      .lte('comparison_date', endDate)
      .is('species_name', null)

    if (location) query = query.eq('location_id', location)

    const { data: comparisons, error: compError } = await query

    if (compError) {
      return NextResponse.json({ error: compError.message }, { status: 500 })
    }

    // Aggregate metrics per version
    const versionMetrics = new Map<string, {
      totalError: number
      totalBlocks: number
      within1pt: number
      within2pt: number
      dataPoints: number
    }>()

    for (const row of comparisons || []) {
      const v = row.algorithm_version
      if (!versionMetrics.has(v)) {
        versionMetrics.set(v, { totalError: 0, totalBlocks: 0, within1pt: 0, within2pt: 0, dataPoints: 0 })
      }
      const m = versionMetrics.get(v)!
      m.totalError += (row.abs_error || 0) * (row.blocks_compared || 0)
      m.totalBlocks += row.blocks_compared || 0
      m.within1pt += row.blocks_within_1pt || 0
      m.within2pt += row.blocks_within_2pt || 0
      m.dataPoints++
    }

    const result = (versions || []).map(v => {
      const m = versionMetrics.get(v.id)
      return {
        id: v.id,
        name: v.name,
        description: v.description,
        isProduction: v.is_production,
        createdAt: v.created_at,
        notes: v.notes,
        metrics: m ? {
          meanAbsError: m.totalBlocks > 0
            ? Math.round((m.totalError / m.totalBlocks) * 100) / 100
            : null,
          hitRate1pt: m.totalBlocks > 0
            ? Math.round((m.within1pt / m.totalBlocks) * 100)
            : null,
          hitRate2pt: m.totalBlocks > 0
            ? Math.round((m.within2pt / m.totalBlocks) * 100)
            : null,
          blocksCompared: m.totalBlocks,
          dataPoints: m.dataPoints,
        } : null,
      }
    })

    return NextResponse.json({ versions: result })
  } catch (err: any) {
    console.error('Versions accuracy error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
