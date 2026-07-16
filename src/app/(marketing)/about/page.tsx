import { redirect } from 'next/navigation';

// The marketing site IS the about pitch — "About" in the nav points at "/",
// so there's no separate about surface to drift out of sync with it.
//
// Kept as a redirect rather than deleted: /about is on the middleware
// allowlist and was in the sitemap, so live links exist. Deleting the route
// would hand those to the /coming-soon rewrite, which looks like a real page
// until you read it. A 307 (not permanent) keeps this reversible — browsers
// cache 308s aggressively.
export default function AboutPage() {
  redirect('/');
}
