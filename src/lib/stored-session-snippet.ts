/**
 * Inline <head> script: stamps `data-rc-session` on <html> when supabase-js
 * has a session stored.
 *
 * The session lives in localStorage, so the server render cannot know who is
 * signed in and every public page ships the signed-out version. Anything that
 * swaps itself out for a signed-in reader after hydration (the SEO hero in
 * fishing/seo-hero.tsx) therefore flashes first. This runs while <head> is
 * parsed, before anything paints, so CSS keyed on the attribute can pick the
 * right version on the first frame. The HTML stays identical for everyone,
 * crawlers included.
 *
 * It only PEEKS: a stored token can be dead. The attribute is a hint for the
 * frames before `useAuth()` resolves, and CSS must only honour it while the
 * component is still waiting on that answer.
 */
export const STORED_SESSION_SNIPPET = `(function(){try{var s=window.localStorage;for(var i=0;i<s.length;i++){var k=s.key(i);if(k&&/^sb-.+-auth-token$/.test(k)){document.documentElement.setAttribute('data-rc-session','');return}}}catch(e){}})();`
