import type { Metadata } from "next";
import Link from "next/link";
import { Anchor, ChevronDown, Fish, Info, Waves } from "lucide-react";
import { btn } from "@/app/components/ui/button";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { DetailCards, Fees, SectionHeading, Source, Steps } from "../guide-ui";
import {
  ADD_ONS,
  FREE_FISHING_DAYS_2026,
  LICENSE_FEES,
  LICENSE_YEAR,
  SOURCES,
  VERIFIED_ON,
} from "./licence-data";

const PATH = "/fishing-licence/or";
const CANONICAL = siteUrl(PATH);

// American spelling in all copy, as on the Washington and California pages:
// ODFW writes "license". Only the URL segment keeps the site-wide
// "/fishing-licence/" spelling; /fishing-license/or 308s in (next.config.ts).
export const metadata: Metadata = {
  // Bare title: the root layout's "%s | ReelCaster" template adds the brand.
  title: `Oregon Fishing License ${LICENSE_YEAR.label}: What You Need for the Coast`,
  description: `How to get an Oregon fishing license in ${LICENSE_YEAR.label}. The new ODFW Ocean Endorsement, the Combined Angling Tag for salmon and halibut, shellfish licenses, youth rules and free fishing days.`,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: `Oregon Fishing License ${LICENSE_YEAR.label} | ReelCaster`,
    description:
      "What an ODFW license covers, the Ocean Endorsement every coast angler now needs, and which tag goes with salmon and halibut.",
    url: CANONICAL,
    siteName: "ReelCaster",
    type: "article",
    locale: "en_US",
    ...DEFAULT_OG,
  },
  robots: { index: true, follow: true },
};

const FAQS: Array<{ q: string; a: string }> = [
  {
    q: "Do I need a license to fish in Oregon?",
    a: "From age 12, yes. Anglers 18 and older buy an adult license, anglers 12 to 17 buy a $10 youth license, and children under 12 need no license to fish, crab or clam. The only other exception is ODFW's Free Fishing Days.",
  },
  {
    q: "What is the Ocean Endorsement?",
    a: "A new add-on from 1 January 2026, $9 a year or $4 a day for everyone. You need it to fish the ocean from a beach, jetty or boat for finfish like rockfish, lingcod, halibut and tuna. You do not need it for salmon, steelhead, crab or clams. Youth, pioneer and resident disabled veteran licenses already include it.",
  },
  {
    q: "Where does the ocean start?",
    a: "Past the visible ends of the jetties on the coast, and past Buoy 10 on the Columbia River. Inside a bay you are not in the ocean for the endorsement, but your license and any tag still apply.",
  },
  {
    q: "Do I need the Combined Angling Tag for halibut?",
    a: "Yes. ODFW lists Pacific halibut with salmon, steelhead and sturgeon: record the fish on the Combined Angling Tag as soon as you keep it, with its length in inches. The MyODFW app works as an electronic tag.",
  },
  {
    q: "How long is an Oregon fishing license valid?",
    a: `An annual license runs ${LICENSE_YEAR.validity}, whenever you buy it. A license bought in October covers the rest of that year only. Daily and multi-day licenses are sold for shorter trips.`,
  },
  {
    q: "What does an Oregon fishing license cost?",
    a: "ODFW raised recreational fees an average of 12 to 14 percent for 2026 and shows current prices when you buy. Check ODFW for current fees. The youth license is $10 and the Ocean Endorsement is $9 a year.",
  },
  {
    q: "Are there free fishing days in Oregon?",
    a: `Three weekends in 2026: ${FREE_FISHING_DAYS_2026}. Anyone can fish, crab and clam without a license, tag or endorsement on those days. Area closures, bag limits and every other rule still apply.`,
  },
  {
    q: "I have a Washington or California license. Does it work in Oregon?",
    a: "Not in general. ODFW licenses Oregon water. The exception ODFW names for the Ocean Endorsement is Washington residents with a valid Washington license fishing north of Cape Falcon, where the two states share the Columbia River subarea. Check ODFW before you rely on any out-of-state license.",
  },
];

/** Ordered anchors for the jump list and the section headings they point at. */
const SECTIONS = [
  { id: "which", label: "Do you need one?" },
  { id: "costs", label: "What it costs" },
  { id: "add-ons", label: "Endorsements and tags" },
  { id: "buy", label: "How to buy" },
  { id: "limits", label: "What it doesn't cover" },
  { id: "faq", label: "FAQ" },
] as const;

const BREADCRUMBS = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Oregon Fishing License", path: PATH },
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

/** What you are fishing for decides what you carry. */
const SITUATIONS = [
  {
    icon: Anchor,
    title: "Rockfish, lingcod or tuna in the ocean",
    covers: "Jetties, beaches and boats past the jetty tips, from Brookings to Astoria.",
    product: "Angling license + Ocean Endorsement",
    price: "Endorsement $9 a year or $4 a day",
  },
  {
    icon: Fish,
    title: "Pacific halibut",
    covers: "The all-depth and nearshore halibut seasons off the Oregon coast.",
    product: "Angling license + Ocean Endorsement + Combined Angling Tag",
    price: "Record each halibut and its length",
  },
  {
    icon: Waves,
    title: "Salmon, in the ocean or a bay",
    covers: "Ocean salmon, fall Chinook in the bays, and Buoy 10 at the Columbia mouth.",
    product: "Angling license + Combined Angling Tag",
    price: "No Ocean Endorsement for salmon",
  },
  {
    icon: Info,
    title: "Crab, clams, or under 12",
    covers: "Bay crabbing off a dock or boat, and clamming on the flats.",
    product: "Shellfish license from age 12",
    price: "Under 12 needs nothing",
  },
];

export default function OrFishingLicensePage() {
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
        {/* Header */}
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
                Oregon Fishing License
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink text-balance">
            Oregon fishing license, {LICENSE_YEAR.label}
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-rc-ink-soft text-pretty">
            One agency, ODFW, and a license that runs the calendar year. What
            changed for 2026 is the ocean: fishing past the jetties for
            rockfish, lingcod, halibut or tuna now needs an Ocean Endorsement on
            top of the license. Salmon and halibut also need the Combined
            Angling Tag. This page works out which pieces you actually need.
          </p>

          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-rc-mono text-[11px] text-rc-ink-mute">
            <span className="text-rc-ink-soft">
              Checked {VERIFIED_ON} against myodfw.com.
            </span>
            <span>An annual license runs {LICENSE_YEAR.validity}.</span>
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

        {/* 1. Do you need one */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="which">Do you need a license?</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            Required from age 12. Pick by what you are fishing for and where,
            because the add-ons follow the species.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {SITUATIONS.map((t) => (
              <div
                key={t.title}
                className="rounded-xl border border-rc-rule bg-rc-panel p-5"
              >
                <div className="flex items-center gap-2">
                  <t.icon className="w-4 h-4 text-rc-brand" aria-hidden />
                  <h3 className="font-bold text-rc-ink">{t.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
                  {t.covers}
                </p>
                <p className="mt-3 text-sm font-medium text-rc-ink">{t.product}</p>
                <p className="mt-1 font-rc-mono text-[11px] text-rc-ink-mute">
                  {t.price}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-rc-brand shrink-0 mt-0.5" aria-hidden />
              <div className="text-sm leading-relaxed text-rc-ink-soft">
                <p className="font-medium text-rc-ink">
                  The Ocean Endorsement is the piece most people miss.
                </p>
                <p className="mt-2">
                  It started on 1 January 2026 and pays for marine fish
                  research such as black rockfish surveys. A license you bought
                  before then does not include it. The line is the visible end
                  of the jetty: cast from the jetty tip into the ocean for
                  rockfish and you need it, crab from a dock inside the bay and
                  you do not.
                </p>
                <p className="mt-2">
                  Heading across a state line? See the{" "}
                  <Link
                    href="/fishing-licence/wa"
                    className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
                  >
                    Washington fishing license guide
                  </Link>{" "}
                  and the{" "}
                  <Link
                    href="/fishing-licence/ca"
                    className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
                  >
                    California fishing license guide
                  </Link>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Costs */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
            Oregon Department of Fish and Wildlife
          </p>
          <SectionHeading id="costs">What it costs</SectionHeading>
          <Fees
            table={LICENSE_FEES}
            caption={`Oregon fishing license fees, ${LICENSE_YEAR.label}`}
            termHeader="License"
          />
          <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-mute">
            Check ODFW for current fees. The full price list shows in the
            licensing system when you buy. See{" "}
            <Source href={SOURCES.whatsNew}>ODFW: what&rsquo;s new for 2026</Source>{" "}
            for this year&rsquo;s changes.
          </p>
        </section>

        {/* 3. Endorsements and tags */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="add-ons">Endorsements and tags</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            An endorsement or tag is a permission added to a license you
            already hold. Without the right one your license is valid and you
            still aren&rsquo;t allowed to do the thing.
          </p>
          <DetailCards
            items={ADD_ONS.map((a) => ({
              name: a.name,
              figures: a.figures,
              detail: a.detail,
            }))}
          />
          <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-mute">
            Sources:{" "}
            <Source href={SOURCES.oceanEndorsement}>Ocean Endorsement</Source>,{" "}
            <Source href={SOURCES.combinedTag}>Combined Angling Tag</Source>,{" "}
            <Source href={SOURCES.columbiaEndorsement}>
              Columbia River Basin Endorsement
            </Source>
            , <Source href={SOURCES.shellfish}>shellfish licenses</Source>.
          </p>
        </section>

        {/* 4. How to buy */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="buy">How to buy one</SectionHeading>
          <Steps
            steps={[
              <>
                Go to{" "}
                <Source href={SOURCES.howToBuy}>ODFW: how to buy a license</Source>{" "}
                and log in to the electronic licensing system. Licenses are also
                sold at ODFW offices and by licensed vendors, most tackle shops
                included.
              </>,
              <>
                Pick the license. Annual if you will fish more than a few days
                this year, remembering it ends on 31 December. Youth anglers 12
                to 17 buy the $10 youth license instead.
              </>,
              <>
                Add the Ocean Endorsement if you will fish past the jetties for
                anything but salmon. That is most of the Oregon water on
                ReelCaster.
              </>,
              <>
                Add the Combined Angling Tag for salmon, steelhead, sturgeon or
                halibut, and the Columbia River Basin Endorsement for salmon,
                steelhead or sturgeon on the Columbia. Add a shellfish license
                for crab and clams.
              </>,
              <>
                Carry it. A paper copy or the MyODFW app on your own phone both
                count, and the app doubles as your electronic tag.
              </>,
            ]}
          />
        </section>

        {/* 5. Limits */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="limits">
            What a license does not give you
          </SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            A license is permission to participate. It says nothing about what
            is open today. Sitting on top of a perfectly valid license:
          </p>
          <ul className="mt-5 space-y-3">
            {[
              [
                "Bottomfish depth lines",
                "ODFW runs rockfish and lingcod by regulatory depth lines. The offshore long-leader fishery is only seaward of the 40-fathom line, and a descending device is required to release rockfish outside the 30-fathom line. Depth rules can change in season.",
              ],
              [
                "Halibut subareas and all-depth days",
                "The Oregon coast is split into halibut subareas, each with its own all-depth and nearshore seasons. On some subareas all-depth fishing is open only on set days, and nearshore halibut stays inside the 40-fathom line.",
              ],
              [
                "In-season changes",
                "ODFW opens and closes ocean fisheries in season, sometimes at short notice. The printed regulations are a starting point, not the current state.",
              ],
              [
                "Size and daily limits",
                "Vary by species, area and season. Yelloweye and quillback rockfish cannot be kept at all, in any Oregon water.",
              ],
              [
                "Marine reserves",
                "Oregon has marine reserves along its coast where fishing is limited or closed. A valid license means nothing inside one.",
              ],
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
            Check current rules with{" "}
            <Source href={SOURCES.bottomfish}>ODFW sport bottomfish seasons</Source>,{" "}
            <Source href={SOURCES.halibut}>ODFW halibut regulations</Source> and
            the <Source href={SOURCES.marineZone}>ODFW Marine Zone</Source> page,
            and browse{" "}
            <Link
              href="/fishing/us/or"
              className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              fishing spots across Oregon
            </Link>{" "}
            to see conditions and forecasts for where you are headed.
          </p>

          <div className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <p className="text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">Free Fishing Days.</span>{" "}
              On {FREE_FISHING_DAYS_2026}, anyone can fish, crab and clam in
              Oregon without a license, tag or endorsement. Area closures, bag
              limits and all other rules still apply.{" "}
              <Source href={SOURCES.freeFishing}>ODFW: Free Fishing Days</Source>.
            </p>
          </div>

          <p className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5 text-[13px] leading-relaxed text-rc-ink-mute">
            This page is a plain-language reference, not legal advice, and fees
            and rules change. ODFW is the authority. Every fact here links back
            to the page it came from. Checked {VERIFIED_ON}.
          </p>
        </section>

        {/* 6. FAQ */}
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

        {/* CTA */}
        <section className="bg-rc-brand">
          <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between sm:gap-12">
            <div>
              <h2 className="text-balance text-3xl md:text-4xl font-black tracking-[-0.02em] text-white">
                License sorted. Now pick the day.
              </h2>
              <p className="mt-3 text-pretty text-base text-white/80">
                Live conditions, tides and 14-day fishing forecasts for the
                Oregon coast, from Brookings to Astoria.
              </p>
            </div>
            <TrialModalButton
              from="or-licence-guide"
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
