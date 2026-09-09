/**
 * The one bit of auth state the edge is allowed to see: is this browser signed
 * in, yes or no.
 *
 * WHY A COOKIE AT ALL. The page-view counter runs in middleware
 * (src/middleware.ts), off the request, before any of our JavaScript exists.
 * It can therefore see everything about the request except the one thing that
 * separates the two audiences a spot page serves: supabase-js keeps the
 * session in localStorage, which no request ever carries. So the client
 * mirrors the ANSWER — one character, never the session — into a cookie, and
 * the counter reads that.
 *
 * WHAT IS IN IT, and what deliberately is not. `1` or `0`. No user id, no
 * email, no token, nothing that identifies anybody or that would be worth
 * stealing if a page leaked its own cookie jar. traffic_events_daily is a
 * counter table with no visitor id in it and this keeps it that way: the most
 * it can ever say is "some signed-in reader opened a spot page today".
 *
 * WHERE IT IS WRONG, because it is worth knowing before reading the split.
 * The cookie is written by the client after the session resolves, so it
 * describes the reader's state as of their LAST page load, not this one:
 *
 *   • A brand new browser's very first request carries no cookie. Counted as
 *     signed out, which it is — nobody signs in before their first page.
 *   • A reader who signs in, or out, is counted correctly from their next page
 *     view onward. The view they were on when they did it keeps the old value.
 *   • Safari caps script-written cookies at seven days. A member who stays
 *     away longer comes back with no cookie and their first page reads as
 *     signed out; the next one is right again.
 *
 * All three lean the same way — toward "out" — so the signed-in share is a
 * floor, not an estimate that could be wrong in either direction.
 */

/** Read by src/middleware.ts. Not httpOnly: the client is what writes it. */
export const AUTH_COOKIE = 'rc_auth'

/**
 * Ninety days, and rewritten on every page load while the session is live.
 *
 * Long enough that an ordinary member is never between visits long enough to
 * lapse, short enough that a browser somebody signed out of and abandoned
 * does not carry a stale `1` for a year. Safari overrides it downward to seven
 * days, which is the case documented above.
 */
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 90

/** What the counter stores. See the migration for why '' is a value. */
export type AuthState = 'in' | 'out' | ''

/**
 * Mirror the session state into the cookie.
 *
 * Called on every auth resolution rather than only on the transitions, because
 * the transitions are the case this already handles: it is the reader who has
 * been signed in for a month and never touches a login form whose cookie has
 * to be kept alive.
 */
export function writeAuthCookie(signedIn: boolean): void {
  if (typeof document === 'undefined') return
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${AUTH_COOKIE}=${signedIn ? '1' : '0'}; path=/; max-age=${AUTH_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
  } catch {
    // Safari with "Block All Cookies" throws on storage access rather than
    // failing quietly, which is how the app has white-screened before. A view
    // filed under the wrong heading is not worth an error path; see
    // src/lib/cookies.ts, which takes the same trade for the same reason.
  }
}

/**
 * What the edge should file this request under.
 *
 * Absent reads as 'out' rather than '' on purpose. '' means "nothing asked",
 * which is true of every row written before the counter learned the question
 * and of nothing since; a request with no cookie HAS been asked, and the
 * answer for all three of the cases in the header comment is that nobody was
 * signed in at the moment our code last looked. Returning '' here instead
 * would file most of a search audience — one page, one visit, no second load —
 * under "not recorded" and leave the split unreadable for exactly the readers
 * it was built to see.
 */
export function authStateFromCookie(value: string | undefined): AuthState {
  return value === '1' ? 'in' : 'out'
}
