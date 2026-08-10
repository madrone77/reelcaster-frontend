import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ExternalLink, Fish, Info, Waves } from "lucide-react";
import { btn } from "@/app/components/ui/button";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import {
  FRESHWATER_FEES,
  LICENCE_YEAR,
  SALMON_STAMP_FEE,
  SOURCES,
  SURCHARGES,
  TIDAL_CATCH_RECORDS,
  TIDAL_FEES,
  VERIFIED_ON,
  type FeeTable,
} from "./licence-data";

const PATH = "/fishing-licence/bc";
const CANONICAL = siteUrl(PATH);

// Fully static — every figure is a literal in licence-data.ts, so there is no
// upstream to revalidate against. The page changes when someone edits that
// file and redeploys, which is exactly the cadence the fees change on.
export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  // "Licence" matches DFO and gov.bc.ca; /fishing-license/bc 308s in here for
  // the American spelling (see next.config.ts).
  title: `BC Fishing Licence ${LICENCE_YEAR.label}: Costs and How to Get One`,
  description:
    `How to get a British Columbia fishing licence in ${LICENCE_YEAR.label}. Tidal (saltwater) licences from DFO and freshwater licences through the new WILD system, with current fees, the Salmon Conservation Stamp, catch-recording rules, and which one you actually need.`,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: `BC Fishing Licence ${LICENCE_YEAR.label} | ReelCaster`,
    description:
      "Tidal vs freshwater, what each costs, and how to buy one — verified against DFO and gov.bc.ca.",
    url: CANONICAL,
    siteName: "ReelCaster",
    type: "article",
    locale: "en_CA",
    ...DEFAULT_OG,
  },
  robots: { index: true, follow: true },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do I need a licence to fish in the ocean in BC?",
    a: "Yes. Everyone fishing in tidal waters needs a Tidal Waters Sport Fishing Licence from DFO, at any age — including children under 16, whose licence is free but still mandatory. This catches people out because the freshwater rule is the opposite: under-16s need no freshwater licence at all.",
  },
  {
    q: "Does one licence cover both saltwater and freshwater?",
    a: "No. They are issued by two different governments — tidal by Fisheries and Oceans Canada, freshwater by the Province of BC — and neither is valid where the other applies. If you fish the ocean and lakes in the same year, you buy both.",
  },
  {
    q: "Do I need a separate licence for crab or prawns?",
    a: "No. The tidal waters licence covers shellfish as well as finfish, including crab, prawns, bivalves like clams and oysters, and octopus. What you do need to check is whether the area is open: bivalve harvesting is closed in many places for biotoxin or sanitary reasons, and eating shellfish from a closed area is both illegal and genuinely dangerous.",
  },
  {
    q: "Do I need the Salmon Conservation Stamp?",
    a: `Only if you intend to keep a salmon in tidal waters. The stamp is ${SALMON_STAMP_FEE} and attaches to your licence. Releasing salmon does not require it — but if you land one you would like to keep and have no stamp, you cannot buy it retroactively, so most people just add it.`,
  },
  {
    q: "How long is a BC fishing licence valid?",
    a: `Both the tidal and freshwater annual licences run the same licence year: ${LICENCE_YEAR.start} to ${LICENCE_YEAR.end}. It is not twelve months from purchase. A licence bought in February expires at the end of March, which makes short-term licences better value late in the year.`,
  },
  {
    q: "What is a Fish and Wildlife ID (FWID) and do I need one?",
    a: "It is a free provincial ID number, and you need one before you can buy a freshwater licence — the province moved freshwater licensing into the WILD system for the 2026–27 season, and WILD is keyed on your FWID. It has no bearing on tidal licences, which are federal. Register through a Basic BCeID or BC Services Card Account, or in person at Service BC or FrontCounter BC.",
  },
  {
    q: "Can I keep my licence on my phone?",
    a: "For tidal, yes — an electronic copy is fine as long as you can display it on screen on demand. The catch is catch recording: if you retain chinook, halibut or lingcod you must record it immediately, so out of cell range you need a paper licence or the FishingBC app to write it on. For freshwater, from 1 April 2026 you no longer need to carry a licence copy at all; your FWID and photo ID are the proof.",
  },
  {
    q: "Is there free fishing in BC?",
    a: "Once a year. During BC's Family Fishing Weekend — the third weekend in June plus the Friday before — anyone who has lived in Canada for the past 12 months can fish fresh water without a basic licence. Conservation surcharges still apply, and it does not cover tidal waters: you still need a DFO licence to fish the ocean that weekend.",
  },
  {
    q: "Does having a licence mean I can fish anywhere for anything?",
    a: "No, and this is the most expensive misunderstanding in BC fishing. A licence is permission to participate; it says nothing about what is open today. Closures, size limits, daily quotas and gear restrictions change constantly and vary by management area — Rockfish Conservation Areas, salmon non-retention windows, and shellfish biotoxin closures all sit on top of a perfectly valid licence.",
  },
];

/** Ordered anchors for the jump list and the section headings they point at. */
const SECTIONS = [
  { id: "which", label: "Which licence?" },
  { id: "tidal", label: "Tidal (saltwater)" },
  { id: "freshwater", label: "Freshwater" },
  { id: "obligations", label: "After you buy" },
  { id: "limits", label: "What it doesn't cover" },
  { id: "faq", label: "FAQ" },
] as const;

const BREADCRUMBS = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "BC Fishing Licence", path: PATH },
]);

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

/** External link to a regulator, marked so it reads as leaving the site. */
function Source({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-1 text-rc-brand hover:text-rc-brand-hover underline underline-offset-2"
    >
      {children}
      <ExternalLink className="w-3 h-3 self-center shrink-0" aria-hidden />
    </a>
  );
}

/**
 * Fee grid. Scrolls horizontally on compact rather than wrapping — a fee table
 * that reflows puts a price under the wrong column heading, which is worse than
 * a scrollbar.
 */
function Fees({ table, caption }: { table: FeeTable; caption: string }) {
  return (
    <div className="mt-5">
      <div className="overflow-x-auto rounded-xl border border-rc-rule bg-rc-panel">
        <table className="w-full text-sm border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-rc-rule">
              <th scope="col" className="text-left font-rc-mono text-[11px] uppercase tracking-[0.08em] text-rc-ink-mute px-4 py-3">
                Licence
              </th>
              {table.columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="text-right font-rc-mono text-[11px] uppercase tracking-[0.08em] text-rc-ink-mute px-4 py-3 whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.term} className="border-b border-rc-rule-soft last:border-b-0">
                <th scope="row" className="text-left font-medium text-rc-ink px-4 py-3 whitespace-nowrap">
                  {row.term}
                </th>
                {row.prices.map((p, i) => (
                  <td
                    key={table.columns[i]}
                    className="text-right font-rc-mono tabular-nums text-rc-ink px-4 py-3 whitespace-nowrap"
                  >
                    {p}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 space-y-1.5">
        {table.notes.map((n) => (
          <li key={n} className="text-[13px] leading-relaxed text-rc-ink-mute">
            {n}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Numbered how-to-buy list. */
function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="mt-5 space-y-4">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-4">
          <span
            className="shrink-0 w-7 h-7 rounded-full bg-rc-brand-soft text-rc-brand font-rc-mono text-xs font-bold grid place-items-center"
            aria-hidden
          >
            {i + 1}
          </span>
          <div className="text-[15px] leading-relaxed text-rc-ink-soft pt-0.5">{s}</div>
        </li>
      ))}
    </ol>
  );
}

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-2xl md:text-3xl font-black tracking-[-0.02em] text-rc-ink"
    >
      {children}
    </h2>
  );
}

export default function BcFishingLicencePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMBS) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSONLD) }}
      />

      <article>
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="max-w-3xl mx-auto px-6 pt-10 pb-8 md:pt-14">
          <nav aria-label="Breadcrumb" className="font-rc-mono text-[11px] text-rc-ink-mute">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-rc-ink transition-colors">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-rc-ink-soft" aria-current="page">
                BC Fishing Licence
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink text-balance">
            BC fishing licence, {LICENCE_YEAR.label}
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-rc-ink-soft text-pretty">
            British Columbia has two fishing licences, issued by two different
            governments, and neither one is valid where the other applies. This
            page covers both: what each costs, how to buy it, and — the part
            that actually gets people fined — what a licence does not permit.
          </p>

          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-rc-mono text-[11px] text-rc-ink-mute">
            <span className="text-rc-ink-soft">
              Fees verified {VERIFIED_ON} against DFO and gov.bc.ca.
            </span>
            <span>
              Licence year {LICENCE_YEAR.start} – {LICENCE_YEAR.end}. Prices
              exclude tax.
            </span>
          </p>

          <nav aria-label="On this page" className="mt-7 flex flex-wrap gap-2">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="font-rc-mono text-[11px] uppercase tracking-[0.08em] text-rc-ink-soft border border-rc-rule rounded-full px-3 py-1.5 hover:border-rc-brand hover:text-rc-brand transition-colors"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </header>

        {/* ── 1. Which licence ───────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="which">Which licence do you need?</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            It comes down to which side of the tidal boundary you are standing
            on, not what you are fishing for.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-rc-rule bg-rc-panel p-5">
              <div className="flex items-center gap-2">
                <Waves className="w-4 h-4 text-rc-brand" aria-hidden />
                <h3 className="font-bold text-rc-ink">Salt water</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
                The ocean, and rivers below their tidal boundary. Salmon,
                halibut, lingcod, rockfish, crab, prawns, clams.
              </p>
              <p className="mt-3 text-sm font-medium text-rc-ink">
                Tidal Waters Sport Fishing Licence
              </p>
              <p className="mt-1 font-rc-mono text-[11px] text-rc-ink-mute">
                DFO · federal · from $25.86/yr
              </p>
            </div>

            <div className="rounded-xl border border-rc-rule bg-rc-panel p-5">
              <div className="flex items-center gap-2">
                <Fish className="w-4 h-4 text-rc-brand" aria-hidden />
                <h3 className="font-bold text-rc-ink">Fresh water</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
                Lakes, and rivers above their tidal boundary. Trout, steelhead,
                kokanee, sturgeon, river salmon.
              </p>
              <p className="mt-3 text-sm font-medium text-rc-ink">
                Basic freshwater licence
              </p>
              <p className="mt-1 font-rc-mono text-[11px] text-rc-ink-mute">
                Province of BC · WILD · from $41.15/yr
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-rc-brand shrink-0 mt-0.5" aria-hidden />
              <div className="text-sm leading-relaxed text-rc-ink-soft">
                <p className="font-medium text-rc-ink">
                  Fishing both? You need both, bought separately.
                </p>
                <p className="mt-2">
                  There is no combined BC licence and no reciprocity between
                  them. On a river, the dividing line is a specific,
                  signposted tidal boundary — the Fraser, the Cowichan and the
                  Campbell all have one, and standing on the wrong side of it
                  with the wrong licence is an offence even if you never move.
                  Boundaries are listed per-river in the{" "}
                  <Source href={SOURCES.dfoRec}>BC Tidal Waters Sport Fishing Guide</Source>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Tidal ───────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
            Federal · Fisheries and Oceans Canada
          </p>
          <SectionHeading id="tidal">Tidal waters (saltwater) licence</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            Required to fish for any finfish or harvest any shellfish in tidal
            waters, and you must have it on you while fishing{" "}
            <em>and</em> while transporting your catch. One licence covers
            everything: salmon, halibut, groundfish, crab, prawns, bivalves and
            octopus — there is no separate crab or shellfish licence in BC.
          </p>

          <div className="mt-5 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <p className="text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">Every age needs one.</span>{" "}
              Unlike freshwater, there is no under-16 exemption in tidal waters.
              A child&rsquo;s licence is free, but it is not optional, and it
              must be obtained before they fish.
            </p>
          </div>

          <h3 className="mt-8 text-lg font-bold text-rc-ink">What it costs</h3>
          <Fees table={TIDAL_FEES} caption={`Tidal waters sport fishing licence fees, ${LICENCE_YEAR.label}`} />

          <h3 className="mt-8 text-lg font-bold text-rc-ink">How to buy one</h3>
          <Steps
            steps={[
              <>
                Go to the{" "}
                <Source href={SOURCES.nrls}>National Recreational Licensing System</Source>{" "}
                (NRLS) and create an account, or sign in if you have fished
                before. Retail vendors — tackle shops, marinas — sell the same
                licence as Independent Access Providers if you would rather do
                it in person.
              </>,
              <>
                Choose your residency and term. Residency is where you live, not
                your citizenship: a Canadian citizen living abroad pays the
                non-resident rate.
              </>,
              <>
                Add the Salmon Conservation Stamp ({SALMON_STAMP_FEE}) if there
                is any chance you will keep a salmon. You cannot add it after
                the fact from the water.
              </>,
              <>
                Pay, then save or print the licence. Keep the paper copy if you
                plan to retain chinook, halibut or lingcod — see{" "}
                <a href="#obligations" className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover">
                  catch recording
                </a>{" "}
                below.
              </>,
            ]}
          />

          <p className="mt-6 text-[13px] leading-relaxed text-rc-ink-mute">
            One niche exception worth knowing: non-residents fishing halibut in
            Areas 121, 23 and 123 must buy from an in-Canada Independent Access
            Provider rather than online.
          </p>
        </section>

        {/* ── 3. Freshwater ──────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
            Provincial · Province of British Columbia
          </p>
          <SectionHeading id="freshwater">Freshwater licence</SectionHeading>

          <div className="mt-5 rounded-xl border border-rc-brand/30 bg-rc-brand-soft p-5">
            <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-brand">
              Changed for {LICENCE_YEAR.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">
                Freshwater licensing moved into the WILD system.
              </span>{" "}
              The old Freshwater Fishing E-Licensing System closed on 31 March
              2026. Licences are now bought through{" "}
              <Source href={SOURCES.wild}>WILD</Source>, the same system used
              for hunting, and every angler needs a free{" "}
              <strong className="font-semibold text-rc-ink">
                Fish and Wildlife ID (FWID)
              </strong>{" "}
              before they can buy one. Fees did not change in the move. The
              upside: from 1 April 2026 you no longer have to carry a paper or
              digital licence for basic angling — your FWID and photo ID are
              the proof.
            </p>
          </div>

          <p className="mt-6 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            Required from age 16. BC residents under 16 need no licence at all;
            non-residents under 16 may fish unlicensed only while accompanied by
            someone 16 or over who holds one.
          </p>

          <h3 className="mt-8 text-lg font-bold text-rc-ink">What it costs</h3>
          <Fees
            table={FRESHWATER_FEES}
            caption={`Basic freshwater fishing licence fees, ${LICENCE_YEAR.label}`}
          />

          <h3 className="mt-8 text-lg font-bold text-rc-ink">
            Conservation surcharges
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-rc-ink-soft">
            A basic licence does not cover the province&rsquo;s flagship
            species. These are bought on top of it, and each is valid for the
            same licence year.
          </p>

          {/* Cards, not a table. Each surcharge is mostly prose — a table
              column starves that prose to two words a line on a phone, and
              horizontal scroll to reach a $11.43 is worse than no table at
              all. The fee grids above stay tabular because they are pure
              numbers with short labels, which is what tables are good at. */}
          <ul className="mt-5 space-y-3">
            {SURCHARGES.map((s) => (
              <li
                key={s.name}
                className="rounded-xl border border-rc-rule bg-rc-panel p-5"
              >
                {/* Stacked on compact, name-left/prices-right from medium up.
                    Explicit rather than relying on flex-wrap: with wrap alone
                    a short name keeps its prices inline while a long one
                    pushes them to the next line, so the list rendered ragged
                    row to row. */}
                <div className="flex flex-col gap-y-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-6">
                  <h4 className="font-medium text-rc-ink">{s.name}</h4>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 font-rc-mono text-[13px] tabular-nums">
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <dt className="text-rc-ink-mute">Resident</dt>
                      <dd className="text-rc-ink">{s.resident}</dd>
                    </div>
                    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <dt className="text-rc-ink-mute">Non-resident</dt>
                      <dd className="text-rc-ink">{s.nonResident}</dd>
                    </div>
                  </dl>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-rc-ink-soft">
                  {s.requiredFor}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[13px] leading-relaxed text-rc-ink-mute">
            Full conditions and the classified-waters schedule are on{" "}
            <Source href={SOURCES.surcharges}>the province&rsquo;s surcharge page</Source>
            .
          </p>

          <h3 className="mt-8 text-lg font-bold text-rc-ink">How to buy one</h3>
          <Steps
            steps={[
              <>
                Register for a{" "}
                <strong className="font-semibold text-rc-ink">
                  Fish and Wildlife ID
                </strong>
                . It is free and required first. A Basic BCeID is the quickest
                route; a BC Services Card Account is slower to set up but
                verifies your identity and residency automatically, which saves
                proving BC residency later.
              </>,
              <>
                Sign in to <Source href={SOURCES.wildLogin}>WILD</Source> with
                that ID.
              </>,
              <>
                Buy the basic licence for your residency and term, then add any
                conservation surcharges you need. Remember the steelhead
                surcharge is required even for catch-and-release.
              </>,
              <>
                Carry your FWID and photo ID when you fish. A licence copy is no
                longer required for basic angling.
              </>,
            ]}
          />
          <p className="mt-6 text-[13px] leading-relaxed text-rc-ink-mute">
            Prefer to do it in person? FrontCounter BC, Service BC and
            participating vendors can register your FWID and sell you the
            licence over the counter.
          </p>

          <div className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <p className="text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">
                One free weekend a year.
              </span>{" "}
              During BC&rsquo;s Family Fishing Weekend — the third weekend in
              June, plus the Friday before — anyone resident in Canada for the
              past 12 months can fish fresh water without a basic licence.
              Surcharges still apply, and it does not extend to tidal waters.
            </p>
          </div>
        </section>

        {/* ── 4. Obligations ─────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="obligations">
            What the licence obliges you to do
          </SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            A tidal licence is not just a receipt — it carries conditions that
            sit outside the regulations most anglers read, which is why they are
            so often discovered during a check.
          </p>

          <h3 className="mt-7 text-lg font-bold text-rc-ink">
            Record these the moment you keep one
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-rc-ink-soft">
            &ldquo;Immediately and permanently&rdquo; is the legal standard —
            on your paper licence, your NRLS catch log, or in the FishingBC app.
            After the trip is too late, and out of cell range the app will not
            save you, so carry paper.
          </p>

          {/* Cards for the same reason as the surcharges: the scope column is
              a sentence, and Lingcod's is a long one. */}
          <ul className="mt-5 space-y-3">
            {TIDAL_CATCH_RECORDS.map((r) => (
              <li
                key={r.species}
                className="rounded-xl border border-rc-rule bg-rc-panel p-5"
              >
                {/* Same stack-then-inline rule as the surcharge cards. */}
                <div className="flex flex-col gap-y-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-x-6">
                  <h4 className="font-medium text-rc-ink">{r.species}</h4>
                  <p className="flex items-baseline gap-1.5 whitespace-nowrap font-rc-mono text-[13px]">
                    <span className="text-rc-ink-mute">Annual quota</span>
                    <span className="text-rc-ink tabular-nums">{r.annualQuota}</span>
                  </p>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-rc-ink-soft">
                  {r.scope}
                </p>
              </li>
            ))}
          </ul>

          <h3 className="mt-8 text-lg font-bold text-rc-ink">
            The iREC survey is mandatory
          </h3>
          <p className="mt-3 text-[15px] leading-relaxed text-rc-ink-soft">
            Every tidal licence holder is enrolled in DFO&rsquo;s Internet
            Recreational Effort and Catch survey and will be selected for one
            month of their licence&rsquo;s validity. Report at{" "}
            <Source href={SOURCES.irec}>irecreport.ca</Source> using the access
            ID on your licence, before the 19th of the following month. You
            must file even if you did not fish that month — a nil report is
            still a report. Juvenile licence holders are exempt.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-rc-ink-mute">
            Full reporting rules:{" "}
            <Source href={SOURCES.dfoReport}>DFO — Report your effort and catch</Source>
            .
          </p>
        </section>

        {/* ── 5. Limits ──────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="limits">
            What a licence does not give you
          </SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            A licence is permission to participate. It says nothing about what
            is open today, and that is where almost every recreational violation
            in BC comes from. On top of a perfectly valid licence sit:
          </p>
          <ul className="mt-5 space-y-3">
            {[
              ["Openings and closures", "Salmon retention windows open and close by management area, sometimes mid-season and sometimes with days of notice."],
              ["Rockfish Conservation Areas", "Roughly 160 closed areas along the coast where groundfish fishing is prohibited outright. They are not marked on the water."],
              ["Size and daily limits", "Vary by species and area, and are separate from the annual quotas above."],
              ["Shellfish biotoxin closures", "Bivalve areas close for paralytic shellfish poisoning and sanitary contamination. Always current-check before harvesting."],
              ["Gear restrictions", "Barbless hooks, single hooks, bait bans and trap limits differ by water."],
            ].map(([term, detail]) => (
              <li key={term} className="flex gap-3">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-rc-brand shrink-0" aria-hidden />
                <p className="text-[15px] leading-relaxed text-rc-ink-soft">
                  <span className="font-medium text-rc-ink">{term}.</span>{" "}
                  {detail}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[15px] leading-relaxed text-rc-ink-soft">
            Check the current rules for your area with{" "}
            <Source href={SOURCES.dfoRec}>DFO Pacific Region</Source> before
            every trip, and browse{" "}
            <Link
              href="/fishing/bc"
              className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              fishing spots across British Columbia
            </Link>{" "}
            to see conditions and forecasts for where you are headed.
          </p>

          <p className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5 text-[13px] leading-relaxed text-rc-ink-mute">
            This page is a plain-language reference, not legal advice, and fees
            and rules change. DFO and the Province are the authorities — every
            figure here links back to the page it came from. Verified{" "}
            {VERIFIED_ON}.
          </p>
        </section>

        {/* ── 6. FAQ ─────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="faq">Common questions</SectionHeading>
          <ul className="mt-6 bg-rc-panel border border-rc-rule rounded-xl overflow-hidden">
            {FAQS.map((f) => (
              <li key={f.q} className="border-b border-rc-rule-soft last:border-b-0">
                <details className="group">
                  <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none hover:bg-rc-surface transition-colors">
                    <span className="text-rc-ink font-medium text-sm md:text-base">
                      {f.q}
                    </span>
                    <ChevronDown
                      className="w-4 h-4 text-rc-ink-mute shrink-0 transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="px-5 pb-5 -mt-1 text-sm md:text-base leading-relaxed text-rc-ink-soft">
                    {f.a}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* ── CTA ────────────────────────────────────────────────── */}
        <section className="bg-rc-brand">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-12">
            <div>
              <h2 className="text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] text-white">
                Licence sorted. Now pick the day.
              </h2>
              <p className="mt-3 text-pretty text-base text-white/80">
                Live conditions, tides and 14-day fishing forecasts for every
                spot on the BC coast.
              </p>
            </div>
            <TrialModalButton
              from="bc-licence-guide"
              className={`shrink-0 ${btn.onBrand}`}
            >
              Start free
            </TrialModalButton>
          </div>
        </section>
      </article>
    </>
  );
}
