// supabase-js keeps the session in localStorage under `sb-<project-ref>-auth-token`,
// not in a cookie, so neither middleware nor a server render can tell a
// signed-in visitor apart from anyone else. This peek is the fastest answer
// the browser can give: synchronous, no network, usable before first paint.
//
// It is optimistic, not authoritative. A stale token that can no longer be
// refreshed still matches here, so anything that acts on a `true` must be
// harmless when the session turns out to be dead. `useAuth()` is the
// authoritative pass.
const SUPABASE_SESSION_KEY = /^sb-.+-auth-token$/

export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (key && SUPABASE_SESSION_KEY.test(key)) return true
    }
  } catch {
    // Storage blocked (private mode, embedded webview): iOS THROWS on the
    // accessor itself, not just on write. Report no session and let the
    // authoritative pass decide.
  }
  return false
}
