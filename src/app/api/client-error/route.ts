import { NextResponse } from 'next/server'

/**
 * Sink for `?diag=1` client error reports (see `lib/client-diag.ts`).
 *
 * Writes to the server log so a crash on someone else's phone is readable with
 * `vercel logs`. Deliberately storage-free: this exists to catch one
 * reproduction, not to accumulate telemetry.
 */
export async function POST(request: Request) {
  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    payload = { parseError: true }
  }

  const p = (payload ?? {}) as Record<string, unknown>

  // Vercel's log viewer collapses multi-line entries, so keep it to one line.
  console.error(
    '[client-error]',
    JSON.stringify({
      build: p.build,
      errors: p.errors,
      diff: p.diff,
      env: p.env,
      ip: request.headers.get('x-forwarded-for'),
      country: request.headers.get('x-vercel-ip-country'),
      region: request.headers.get('x-vercel-ip-country-region'),
      ua: request.headers.get('user-agent'),
    })
  )

  return NextResponse.json({ ok: true })
}
