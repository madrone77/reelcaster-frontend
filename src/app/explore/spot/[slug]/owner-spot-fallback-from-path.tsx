"use client";

import { usePathname } from "next/navigation";
import OwnerSpotFallback from "./owner-spot-fallback";

/**
 * Next hands not-found.tsx no params, so recover the slug from the URL.
 *
 * The pathname is always /explore/spot/<slug> here — this file only renders
 * under that segment — but fall back to rendering the plain "not found" copy
 * (OwnerSpotFallback with an empty slug denies immediately) rather than
 * fetching a garbage URL if that ever stops being true.
 */
export default function OwnerSpotFallbackFromPath() {
  const pathname = usePathname() ?? "";
  const match = /^\/explore\/spot\/([^/]+)/.exec(pathname);
  const slug = match ? decodeURIComponent(match[1]) : "";

  return <OwnerSpotFallback slug={slug} />;
}
