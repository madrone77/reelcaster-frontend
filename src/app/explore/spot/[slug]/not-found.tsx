import OwnerSpotFallbackFromPath from "@/app/fishing/[country]/[state]/[city]/[spot]/owner-spot-fallback-from-path";

/**
 * Same job as the new route's not-found: a genuine 404 status, with a body
 * that still lets an owner recover their private custom spot client-side using
 * a token the anonymous server render never saw.
 *
 * This segment keeps its own copy because private custom spots are exactly the
 * case that never leaves this URL.
 */
export default function LegacySpotNotFound() {
  return <OwnerSpotFallbackFromPath />;
}
