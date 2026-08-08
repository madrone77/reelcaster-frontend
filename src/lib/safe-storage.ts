/**
 * Make `localStorage` / `sessionStorage` safe to touch.
 *
 * iOS Safari with Settings → Safari → "Block All Cookies" does not merely make
 * web storage empty — reading the `window.localStorage` *getter* throws
 * `SecurityError: The operation is insecure.` Any consumer doing the ordinary
 * thing (`localStorage.getItem(...)`) throws with it, including vendor SDKs we
 * don't control.
 *
 * Our own callers already guard their reads (`use-favorite`, `use-home-spot`,
 * `unit-preferences-context`), and `@supabase/auth-js` guards its own. The one
 * that did not was `mixpanel-browser`, which took the whole site down for those
 * visitors — see the note in `lib/mixpanel.ts`.
 *
 * Swapping the unusable objects for an in-memory stand-in keeps every consumer
 * working; storage-backed features simply stop persisting across reloads, which
 * is what a visitor blocking storage is asking for anyway.
 *
 * This is a runtime call rather than an injected `<script>` on purpose. Next
 * 15's `next/script` with `strategy="beforeInteractive"` does *not* hoist into
 * `<head>` in the App Router — the tag is emitted in the body, after the ~29
 * `async` bundle tags Next puts in `<head>` — so it cannot be relied on to win
 * the race. Calling this directly, before the code that needs it, can.
 */

function usable(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    const store = window[name]
    if (!store) return false
    const probe = '__rc_storage_probe__'
    store.setItem(probe, '1')
    store.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function memoryStorage(): Storage {
  let data: Record<string, string> = {}
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v)
    },
    removeItem: (k) => {
      delete data[k]
    },
    clear: () => {
      data = {}
    },
    key: (i) => Object.keys(data)[i] ?? null,
    get length() {
      return Object.keys(data).length
    },
  } as Storage
}

let done = false

/**
 * Replace any unusable web-storage object with an in-memory equivalent.
 *
 * Safe to call repeatedly and safe to call on the server (no-ops there).
 */
export function ensureSafeStorage(): void {
  if (done || typeof window === 'undefined') return
  done = true

  for (const name of ['localStorage', 'sessionStorage'] as const) {
    if (usable(name)) continue
    try {
      Object.defineProperty(window, name, {
        value: memoryStorage(),
        configurable: true,
      })
    } catch {
      // Nothing more we can do; leave the native object in place.
    }
  }
}
