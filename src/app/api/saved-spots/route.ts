/**
 * Saved spots — the star on a spot card, server-side.
 *
 *   GET    /api/saved-spots              → { slugs: string[] }
 *   POST   /api/saved-spots              → star a spot   { slug, spot_id? }
 *   DELETE /api/saved-spots?slug=<slug>  → un-star it
 *
 * Backed by `user_favorite_spots`. Not to be confused with the older
 * `/api/favorite-spots`, which reads the `favorite_spots` table — that one
 * stores arbitrary places the user typed and now feeds only the
 * default-location picker. Same word, different feature; see
 * `src/lib/plan-features.ts`.
 *
 * Favourites were `localStorage` until now, which is why this route exists at
 * all: per-browser state can't sync, can't be read server-side, and — as
 * reelcaster-frontend #259 found the hard way — can't be repaired when
 * something writes to it by mistake.
 *
 * The free-tier cap is enforced HERE, not in the browser. The client checks it
 * too, but only so it can open the upgrade modal instead of firing a request it
 * knows will fail; the client check is a courtesy and this one is the rule.
 * That is also why the RLS policies on the table grant select and delete but
 * not insert: a direct PostgREST insert with the anon key would walk past the
 * cap, so inserts have to come through here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { resolveEntitlement } from '@/lib/entitlement'
import { FREE_FAVORITE_SPOTS } from '@/lib/plan-features'

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

/** A BlueCaster spot slug: lowercase words plus the base36 id suffix. */
function isValidSlug(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 120 && /^[a-z0-9-]+$/.test(v)
}

// =============================================================================
// GET — this user's saved slugs
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    // Signed out isn't an error here — stars are a signed-in feature, and every
    // surface that renders one asks for this list on load. 401 would put a
    // failed request in the console of every anonymous visit.
    if (!userId) return NextResponse.json({ slugs: [] })

    const { data, error } = await supabaseAdmin
      .from('user_favorite_spots')
      .select('spot_slug')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching saved spots:', error)
      return NextResponse.json({ error: 'Failed to fetch saved spots' }, { status: 500 })
    }

    return NextResponse.json({
      slugs: (data ?? []).map((r) => r.spot_slug as string),
    })
  } catch (error) {
    console.error('Error in GET /api/saved-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// POST — star a spot
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Sign in to save spots', signin_required: true },
        { status: 401 },
      )
    }

    const body = await request.json()
    if (!isValidSlug(body.slug)) {
      return NextResponse.json({ error: 'A valid slug is required' }, { status: 400 })
    }

    const [{ isPro: isPaid }, { data: existing, error: readErr }] = await Promise.all([
      resolveEntitlement(supabaseAdmin, userId),
      supabaseAdmin
        .from('user_favorite_spots')
        .select('spot_slug')
        .eq('user_id', userId),
    ])

    if (readErr) {
      console.error('Error reading saved spots for cap check:', readErr)
      return NextResponse.json({ error: 'Failed to save spot' }, { status: 500 })
    }

    const slugs = (existing ?? []).map((r) => r.spot_slug as string)

    // Re-starring something already starred is a no-op, and must stay one even
    // at the cap: a free user at their limit tapping their own saved spot again
    // should not be told to upgrade.
    if (slugs.includes(body.slug)) {
      return NextResponse.json({ slug: body.slug, already: true })
    }

    if (!isPaid && slugs.length >= FREE_FAVORITE_SPOTS) {
      return NextResponse.json(
        {
          error: `Free accounts can save ${FREE_FAVORITE_SPOTS} ${
            FREE_FAVORITE_SPOTS === 1 ? 'spot' : 'spots'
          }`,
          upgrade_required: true,
        },
        { status: 402 },
      )
    }

    const { error } = await supabaseAdmin.from('user_favorite_spots').insert({
      user_id: userId,
      spot_slug: body.slug,
      spot_id: typeof body.spot_id === 'string' ? body.spot_id : null,
    })

    // Two taps racing past the read above both pass the cap check and both
    // insert. The unique constraint turns the loser into 23505, which is the
    // same outcome the user asked for — not an error to report.
    if (error && error.code !== '23505') {
      console.error('Error saving spot:', error)
      return NextResponse.json({ error: 'Failed to save spot' }, { status: 500 })
    }

    return NextResponse.json({ slug: body.slug }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/saved-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// =============================================================================
// DELETE — un-star a spot
// =============================================================================

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const slug = new URL(request.url).searchParams.get('slug')
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: 'A valid slug is required' }, { status: 400 })
    }

    // Scoped to the caller, so there is no ownership check to forget: a slug
    // belonging to someone else simply matches no row.
    const { error } = await supabaseAdmin
      .from('user_favorite_spots')
      .delete()
      .eq('user_id', userId)
      .eq('spot_slug', slug)

    if (error) {
      console.error('Error removing saved spot:', error)
      return NextResponse.json({ error: 'Failed to remove saved spot' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/saved-spots:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
