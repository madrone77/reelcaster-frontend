"use client";

/**
 * The Explore nav item, as rendered on the dashboard: a link to the home
 * city, named in the URL.
 *
 * A bare /explore already opens on the home city on a cold arrival (the
 * server reads the rc-home-city cookie, see app/explore/explore-route.tsx).
 * It does not on a warm one: the tab-scoped view memory
 * (app/explore/lib/view-memory.ts) restores the last camera on any bare
 * /explore, so an angler who panned to another coast an hour ago and then
 * taps Explore from the dashboard lands back on that coast. `?loc=` is the
 * one thing that outranks the restore, so the dashboard's Explore links name
 * the city instead of hoping.
 *
 * A component rather than a hook so the effective-city read only runs where
 * it is used. Both nav bars mount on every page, and `useEffectiveHomeCity`
 * asks the server for a guess whenever there is no stated city; that is one
 * request per page for every signed-out visitor if it sits in the bar itself.
 * Mount this on the dashboard only and render a plain Link elsewhere.
 *
 * Starts as the bare link on server and client, so it hydrates clean, and
 * becomes the home-city link once the city settles.
 */

import Link from "next/link";
import type { ComponentProps } from "react";
import { useEffectiveHomeCity } from "@/app/explore/lib/use-home-city";

export const DASHBOARD_PATH = "/dashboard";

export function exploreHomeCityHref(slug: string | null): string {
  return slug ? `/explore?loc=${encodeURIComponent(slug)}` : "/explore";
}

type Props = ComponentProps<typeof Link>;

/** Same props as Link so the nav can swap it in; `href` is replaced. */
export default function ExploreNavLink(props: Props) {
  const { slug } = useEffectiveHomeCity();
  return <Link {...props} href={exploreHomeCityHref(slug)} />;
}
