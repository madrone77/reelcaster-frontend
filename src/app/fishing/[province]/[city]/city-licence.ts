// The licence a city page needs, pulled from the same data /fishing-licence
// renders.
//
// Every city we cover is saltwater, so this is the tidal licence only, and it
// says so: conflating tidal with freshwater is the single most common mistake
// the licence pages exist to fix. In BC they are issued by two different
// governments.
//
// Nothing here restates a figure. Fees change on April 1 and the whole point
// of `licence-data.ts` being one file is that the refresh is one edit; a city
// page with its own copy of "$25.86" would quietly go stale in every city at
// once. If a fee is not reachable from the imported tables, this returns null
// and the section does not render.

import {
  SALMON_STAMP_FEE,
  SOURCES as BC_SOURCES,
  TIDAL_FEES,
  LICENCE_YEAR as BC_YEAR,
} from "@/app/fishing-licence/bc/licence-data";
import {
  ANNUAL_FEES as WA_ANNUAL_FEES,
  ENDORSEMENTS as WA_ENDORSEMENTS,
  SOURCES as WA_SOURCES,
  LICENCE_YEAR as WA_YEAR,
} from "@/app/fishing-licence/wa/licence-data";
import type { FeeTable } from "@/app/fishing-licence/types";

export interface CityLicence {
  /** "Tidal Waters Sport Fishing Licence" */
  name: string;
  /** Who issues it, spelled out. The BC split is federal vs provincial. */
  regulator: string;
  /** Resident annual price, exactly as the regulator publishes it. */
  residentAnnual: string | null;
  /** Label for the price above, e.g. "Canadian resident, 16 to 64". */
  residentLabel: string;
  /** The add-on people forget. Null when the jurisdiction has none. */
  addOn: { name: string; fee: string; when: string } | null;
  /** The sentence that stops someone buying the wrong licence. */
  caveat: string;
  yearLabel: string;
  href: string;
  officialHref: string;
}

/** Price at (row term, column header), or null if either has been renamed. */
function priceAt(table: FeeTable, term: string, column: string): string | null {
  const columnIndex = table.columns.indexOf(column);
  if (columnIndex === -1) return null;
  const row = table.rows.find((r) => r.term === term);
  const price = row?.prices[columnIndex];
  // "—" is how these tables spell "not offered".
  return price && price !== "—" ? price : null;
}

export function licenceFor(provinceCode: string): CityLicence | null {
  const code = provinceCode.toLowerCase();

  if (code === "bc") {
    return {
      name: "Tidal Waters Sport Fishing Licence",
      regulator: "Fisheries and Oceans Canada",
      residentAnnual: priceAt(TIDAL_FEES, "Annual (16-64)", "Canadian resident"),
      residentLabel: "Canadian resident, 16 to 64",
      addOn: {
        name: "Salmon Conservation Stamp",
        fee: SALMON_STAMP_FEE,
        when: "required to keep any salmon. Releasing does not need it.",
      },
      caveat:
        "This is the federal tidal licence. Fishing fresh water in BC needs a separate provincial licence, and one does not cover the other.",
      yearLabel: BC_YEAR.label,
      href: "/fishing-licence/bc",
      officialHref: BC_SOURCES.nrls,
    };
  }

  if (code === "wa") {
    const crab = WA_ENDORSEMENTS.find((e) =>
      e.name.toLowerCase().includes("crab"),
    );
    const crabAnnual = crab?.figures.find((f) => f.label === "Annual")?.value;
    return {
      name: "Saltwater fishing licence",
      regulator: "Washington Department of Fish and Wildlife",
      residentAnnual: priceAt(WA_ANNUAL_FEES, "Saltwater", "Resident 16-69"),
      residentLabel: "Resident, 16 to 69",
      addOn:
        crab && crabAnnual
          ? {
              name: crab.name,
              fee: crabAnnual,
              when: "required to drop a pot in Puget Sound, on top of a shellfish licence.",
            }
          : null,
      caveat:
        "A saltwater licence does not cover shellfish. The combination licence covers both and works out cheaper than buying them apart.",
      yearLabel: WA_YEAR.label,
      href: "/fishing-licence/wa",
      officialHref: WA_SOURCES.buy,
    };
  }

  return null;
}
