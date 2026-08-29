"use client";

import { useMemo } from "react";
import { angleFrom } from "../_shared/lp-angles";
import {
  reportCampaignCta,
  useCampaignHit,
  type CampaignTarget,
  type LpCtaId,
} from "../_shared/lp-telemetry";
import type { City1City } from "./city1-city";

/**
 * Counting the city-first landing pages.
 *
 * /lp/seattle/1 recorded NOTHING -- not a view, not a click -- from the day it
 * shipped. `useLpHit` and `reportLpCta` read the variant off the path with
 * `/^[0-9]{1,2}$/`, which is true of `/lp/6/seattle-wa` and false of
 * `/lp/seattle/1`: `parseLpPath` returned an empty landing, and both counters
 * treat that as "not a landing page" and return early. Silent, and the kind of
 * silence that looks exactly like a page nobody visited.
 *
 * The dimensions are passed in here rather than teaching the path parser a
 * second grammar, which is what lp-telemetry.tsx already prescribes for
 * surfaces that are not `/lp/<n>/<city>`. Two reasons it is the better fix:
 * the parser is shared with five running variants and is not worth the risk,
 * and it could not get the city right anyway -- this route's path segment is
 * `seattle`, while every existing row in the table carries a full slug like
 * `seattle-wa`. Reading the segment would quietly split this city across two
 * values of the column the report groups by.
 *
 * Both dimensions now come off the page's City1City, so a new city-first page
 * cannot ship silent the way /lp/seattle/1 did: it gets the counter by
 * rendering the shared page at all, rather than by remembering to hand-write a
 * second copy of this file.
 *
 * There is a SECOND copy of the landing-key shape test server-side, in
 * src/app/api/attribution/campaign/route.ts. It answered 400 to `lpseattle1`
 * for four days after the client fix landed. It now accepts `lp[a-z0-9]{1,24}`,
 * which covers `lpvancouver1`, but when a landing key records nothing, check
 * BOTH copies.
 */

/**
 * The angle is read from the URL on the client, not passed down from the
 * server.
 *
 * The page component deliberately does not touch searchParams: reading them
 * there opts the route out of ISR and makes every ad click render from
 * scratch. `campaignDims` already reads the query string in this same file's
 * neighbour for the UTM fields, so the angle rides along the same way and the
 * page stays cacheable.
 */
function currentAngle(): string {
  if (typeof window === "undefined") return "";
  const q = new URLSearchParams(window.location.search);
  return angleFrom({
    a: q.get("a") ?? undefined,
    utm_content: q.get("utm_content") ?? undefined,
  }).id;
}

function targetFor(city: City1City, angle: string): CampaignTarget {
  return {
    landing: city.landing,
    target_city: city.slug,
    target_spot: "",
    wall: "",
    angle,
  };
}

/** Count this visit, once per tab. Renders nothing. */
export function City1Hit({ city }: { city: City1City }) {
  const angle = useMemo(currentAngle, []);
  useCampaignHit(targetFor(city, angle));
  return null;
}

/**
 * A CTA that counts the press before it navigates.
 *
 * `cta` is the POSITION, never the label -- that is what makes the hero here
 * comparable with the hero on every other variant, and it is why renaming the
 * button does not break the series.
 *
 * The counter is fired on click rather than on the destination page: these
 * links leave immediately, and `reportCampaignCta` uses sendBeacon precisely
 * so a navigation cannot race the count away.
 */
export function TrackedCta({
  city,
  cta,
  href,
  className,
  children,
}: {
  city: City1City;
  cta: LpCtaId;
  href: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={className}
      href={href}
      onClick={() => reportCampaignCta(cta, targetFor(city, currentAngle()))}
    >
      {children}
    </a>
  );
}
