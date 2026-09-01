import OwnerSpotFallbackFromPath from "./owner-spot-fallback-from-path";

/**
 * Rendered whenever the spot page calls notFound() — which is every slug the
 * anonymous server render couldn't load, private custom spots included.
 *
 * The response status is a genuine 404, which is what crawlers need: an
 * unpublished or deleted spot has to stop answering 200 or it lingers in the
 * index as a soft 404 forever.
 *
 * The *body* still tries to recover, because "the server couldn't read it"
 * and "it doesn't exist" are the same response from BlueCaster. An owner
 * arrives here with a Bearer token the server render never saw, so the client
 * re-asks through the authenticated proxy and renders their private spot.
 * A 404 status under real content is the honest trade: search engines drop the
 * URL, the one angler entitled to see it still does.
 */
export default function SpotNotFound() {
  return <OwnerSpotFallbackFromPath />;
}
