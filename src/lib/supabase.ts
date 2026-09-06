import { createClient, NavigatorLockAcquireTimeoutError } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pehcvwiwtubzfgahuzuz.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBlaGN2d2l3dHViemZnYWh1enV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyOTEzMjksImV4cCI6MjA2ODg2NzMyOX0.1BXQS068Ruo9F7CBz7Hb3_eXKx4hAOozLsFh6S9BJyU'

/**
 * How long a session read waits for the auth tab lock before proceeding
 * without it. Uncontended, the lock is granted at once and this never
 * matters. Contended, it is nearly always a tab that will never let go.
 */
const LOCK_WAIT_MS = 4000

/**
 * The auth client serialises its session reads across tabs with a Web Lock
 * (`lock:sb-<ref>-auth-token`), and this version of auth-js asks for that
 * lock with NO timeout: `getSession()`, and the client's own initialisation,
 * wait until whoever holds it lets go. A holder that is frozen does not let
 * go. Android Chrome freezes background tabs and keeps their locks, so a
 * reader with a dozen ReelCaster tabs open lands on a spot page whose every
 * `getSession()` hangs: the tier never resolves, the 14-day strip stays an
 * empty box, the forecast refetch never sends, and nothing on the page can
 * tell it is stuck.
 *
 * So the lock is bounded here. Wait a few seconds like the library would,
 * then run without it, the same fallback auth-js itself takes when a browser
 * hands back a null lock. Running unlocked risks two live tabs refreshing
 * the same token at once, which the server tolerates (refresh tokens stay
 * valid for a reuse window), and that is a far better failure than a page
 * that never finishes loading. `acquireTimeout === 0` is the library's
 * "only if free right now" mode (its background refresh tick) and keeps
 * that meaning: it must not steal time from a real holder.
 */
async function boundedNavigatorLock<R>(
  name: string,
  acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> {
  const locks = globalThis.navigator?.locks
  if (!locks) return fn()
  if (acquireTimeout === 0) {
    return locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
      // The library's own error class: its refresh tick checks for it and
      // skips the tick quietly instead of logging a failure.
      if (!lock) {
        throw new NavigatorLockAcquireTimeoutError(
          `Acquiring an exclusive Navigator LockManager lock "${name}" immediately failed`,
        )
      }
      return fn()
    })
  }
  const controller = new AbortController()
  const wait = acquireTimeout > 0 ? acquireTimeout : LOCK_WAIT_MS
  const timer = setTimeout(() => controller.abort(), wait)
  // Set once the lock is ours. Aborting a granted request is a no-op, so a
  // slow `fn` that outlives the timer must not be mistaken for a lost wait
  // and run a second time.
  let granted = false
  try {
    return await locks.request(name, { mode: 'exclusive', signal: controller.signal }, async () => {
      granted = true
      return fn()
    })
  } catch (e) {
    if (granted || !controller.signal.aborted) throw e
    // The wait ran out. Proceed without the lock rather than sit behind a
    // tab that is never coming back.
    console.warn(`[supabase] auth lock "${name}" held for ${wait}ms; proceeding without it`)
    return fn()
  } finally {
    clearTimeout(timer)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { lock: boundedNavigatorLock },
})