import type { Metadata } from "next";
import Link from "next/link";
import { Anchor, ChevronDown, Fish, Info, Waves } from "lucide-react";
import { btn } from "@/app/components/ui/button";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { DetailCards, Fees, SectionHeading, Source, Steps } from "../guide-ui";
import {
  ADD_ONS,
  ANNUAL_FEES,
  FREE_FISHING_DAYS_2026,
  LICENSE_YEAR,
  SHORT_TERM_FEES,
  SOURCES,
  VERIFIED_ON,
} from "./licence-data";

const PATH = "/fishing-licence/ca";
const CANONICAL = siteUrl(PATH);

// American spelling in all copy, as on the Washington page: CDFW writes
// "license". Only the URL segment keeps the site-wide "/fishing-licence/"
// spelling so every region shares one route and one layout; /fishing-license/ca
// 308s in (see next.config.ts).
export const metadata: Metadata = {
  // Bare title: the root layout's "%s | ReelCaster" template adds the brand.
  title: `California Fishing License ${LICENSE_YEAR.label}: Costs and How to Get One`,
  description: `How to get a California sport fishing license in ${LICENSE_YEAR.label}. CDFW fees, the Ocean Enhancement Validation Southern California needs, the public pier exemption, report cards and free fishing days.`,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: `California Fishing License ${LICENSE_YEAR.label} | ReelCaster`,
    description:
      "What a CDFW sport fishing license costs, the validation Southern California needs, and when you need no license at all.",
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
    q: "Do I need a license to fish in California?",
    a: "From age 16, yes, with one big exception: you need no license to fish from a public pier in ocean waters. Anglers 15 and younger need no license anywhere. Every other rule, including bag limits, size limits and report cards, applies on the pier exactly as it does on a boat.",
  },
  {
    q: "What counts as a public pier?",
    a: "A publicly owned structure built for fishing or public access that extends into the ocean, such as a municipal pier or a jetty open to the public. A private dock, a marina float or a boat are not public piers. If a sign at the entrance says it is a public fishing pier, it is.",
  },
  {
    q: "How long is a California fishing license valid?",
    a: `An annual license is valid for ${LICENSE_YEAR.validity}. This is different from British Columbia and Washington, where the license year runs April to March no matter when you buy. Buy in June and it runs to the following June.`,
  },
  {
    q: "What is the Ocean Enhancement Validation?",
    a: "A $7.30 add-on to an annual license that is required to fish in ocean waters south of Point Arguello in Santa Barbara County. That covers all of Southern California, so every San Diego spot on ReelCaster needs it. One-day and two-day licenses do not need it.",
  },
  {
    q: "Do I need a second-rod validation for the ocean?",
    a: "No. CDFW says a second-rod validation is not required when fishing in ocean waters. It is an inland-waters item, so skip it unless you also fish lakes and rivers.",
  },
  {
    q: "Which report cards matter for saltwater?",
    a: "Spiny lobster. Anyone taking lobster needs a report card, at any age and even on a public pier where no license is needed. Sturgeon also needs a report card, but sturgeon fishing is catch-and-release only. Steelhead and salmon report cards apply to specific inland river systems, not the ocean.",
  },
  {
    q: "Are there free fishing days in California?",
    a: `Two a year: ${FREE_FISHING_DAYS_2026}. No license is needed on those days, but bag limits, size limits, gear rules, closures and report card requirements all still apply.`,
  },
  {
    q: "I have a Washington or BC license. Does it work in California?",
    a: "No. Each state and province licenses its own water and none of them recognise the others. CDFW is the authority in California and its license is the only one that counts here.",
  },
];

/** Ordered anchors for the jump list and the section headings they point at. */
const SECTIONS = [
  { id: "which", label: "Do you need one?" },
  { id: "costs", label: "What it costs" },
  { id: "add-ons", label: "Validations and report cards" },
  { id: "buy", label: "How to buy" },
  { id: "limits", label: "What it doesn't cover" },
  { id: "faq", label: "FAQ" },
] as const;

const BREADCRUMBS = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "California Fishing License", path: PATH },
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

/** Where you fish decides what you carry. */
const SITUATIONS = [
  {
    icon: Anchor,
    title: "Public pier",
    covers: "Ocean Beach, Oceanside, Imperial Beach and any other public pier in ocean waters.",
    product: "No license needed",
    price: "Report card still required for lobster",
  },
  {
    icon: Waves,
    title: "Boat, kayak or shore, south of Point Arguello",
    covers: "Every San Diego spot on ReelCaster, from the bay to Cortes Bank.",
    product: "Sport fishing license + Ocean Enhancement Validation",
    price: "$64.54 + $7.30 a year, resident",
  },
  {
    icon: Fish,
    title: "A day or a weekend",
    covers: "Visiting, or trying it once before committing to a year.",
    product: "One-day or two-day license",
    price: "$21.09 or $32.40, no validation needed",
  },
  {
    icon: Info,
    title: "Under 16",
    covers: "Anywhere in the state, any water.",
    product: "No license needed",
    price: "Report cards still apply",
  },
];

export default function CaFishingLicensePage() {
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
                California Fishing License
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink text-balance">
            California fishing license, {LICENSE_YEAR.label}
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-rc-ink-soft text-pretty">
            One agency, one base license, and the most generous exemption on
            the West Coast: you need no license at all to fish from a public
            pier in the ocean. Off the pier, CDFW sells a sport fishing license
            that runs a full year from the day you buy it, plus a validation
            that every Southern California angler needs and most first-timers
            miss. This page works out which pieces you actually need.
          </p>

          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-rc-mono text-[11px] text-rc-ink-mute">
            <span className="text-rc-ink-soft">
              Fees verified {VERIFIED_ON} against CDFW.
            </span>
            <span>An annual license is valid for {LICENSE_YEAR.validity}.</span>
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
            Required from age 16, except on a public pier. Pick by where you
            will stand, not by what you hope to catch.
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
                  The public pier exemption is the best way to start.
                </p>
                <p className="mt-2">
                  CDFW&rsquo;s own wording: a sport fishing license is not
                  required to take fish for any purpose other than profit by
                  angling from a public pier in the ocean waters of the state.
                  That makes a pier the one place a beginner can fish legally
                  with no paperwork at all. The catch is that the exemption
                  covers the license and nothing else: bag limits, size limits
                  and seasons apply on the pier, and a spiny lobster report
                  card is still required.
                </p>
                <p className="mt-2">
                  If you also fish north of the border, note that neither
                  Washington nor BC has a pier exemption. See the{" "}
                  <Link
                    href="/fishing-licence/wa"
                    className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
                  >
                    Washington fishing license guide
                  </Link>{" "}
                  and the{" "}
                  <Link
                    href="/fishing-licence/bc"
                    className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
                  >
                    BC fishing licence guide
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
            California Department of Fish and Wildlife
          </p>
          <SectionHeading id="costs">What it costs</SectionHeading>

          <h3 className="mt-6 text-lg font-bold text-rc-ink">Annual licenses</h3>
          <Fees
            table={ANNUAL_FEES}
            caption={`California annual sport fishing license fees, ${LICENSE_YEAR.label}`}
            termHeader="License"
          />

          <h3 className="mt-8 text-lg font-bold text-rc-ink">
            Short-term licenses
          </h3>
          <Fees
            table={SHORT_TERM_FEES}
            caption={`California short-term sport fishing license fees, ${LICENSE_YEAR.label}`}
            termHeader="License"
          />
          <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-mute">
            CDFW adjusts its fees each year. Check{" "}
            <Source href={SOURCES.fees}>CDFW: sport fishing licenses</Source>{" "}
            for the current figures before you buy.
          </p>
        </section>

        {/* 3. Validations and report cards */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="add-ons">Validations and report cards</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            A validation is a permission bolted onto a license you already
            hold. Without the right one your license is valid and you still
            aren&rsquo;t allowed to do the thing. The Ocean Enhancement
            Validation is the one that catches Southern California anglers.
          </p>
          <DetailCards
            items={ADD_ONS.map((a) => ({
              name: a.name,
              figures: a.figures,
              detail: a.detail,
            }))}
          />
          <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-mute">
            Sturgeon also carries a report card, but sturgeon is catch and
            release only in California. Steelhead and salmon cards apply to
            specific inland river systems, not the ocean.{" "}
            <Source href={SOURCES.fees}>CDFW: validations and report cards</Source>.
          </p>
        </section>

        {/* 4. How to buy */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="buy">How to buy one</SectionHeading>
          <Steps
            steps={[
              <>
                Go to{" "}
                <Source href={SOURCES.buy}>CDFW online license sales</Source>{" "}
                and set up a customer profile. Licenses are also sold by
                phone, over the counter by license agents (most tackle shops
                and many big-box stores) and at CDFW license sales offices.
              </>,
              <>
                Pick the license. Annual if you will fish more than twice this
                year, since two two-day licenses already cost more than an
                annual one. Residency is where you live; short-term licenses
                cost the same either way.
              </>,
              <>
                Add the Ocean Enhancement Validation to an annual license if
                you will fish anywhere south of Point Arguello. That is every
                San Diego spot on ReelCaster. Skip the second-rod validation
                for the ocean.
              </>,
              <>
                Add a spiny lobster report card if you will take lobster,
                including for anyone under 16 and anyone fishing from a pier.
              </>,
              <>
                Carry it. The license must be in your immediate possession
                while fishing, so keep the printed copy or the confirmation in
                your tackle box, not at home.
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
                "Groundfish Management Area rules",
                "CDFW splits the coast into Groundfish Management Areas, and San Diego sits in the Southern one. Each area runs its own rockfish, lingcod and other groundfish seasons and depth limits, and the Southern area's depth limit changes through the year.",
              ],
              [
                "In-season changes",
                "CDFW opens and closes fisheries in season, sometimes at short notice. The printed booklet is a starting point, not the current state.",
              ],
              [
                "Size and daily limits",
                "Vary by species, area and season. Some species, such as giant sea bass and sturgeon, cannot be kept at all.",
              ],
              [
                "Marine Protected Areas",
                "California has a network of MPAs along the whole coast, including several around San Diego and the Channel Islands. Many are closed to all take, and a valid license means nothing inside one.",
              ],
              [
                "Mexican waters",
                "Cortes Bank and the far banks sit close to the border. South of it you need a Mexican fishing license, and CDFW's does not carry.",
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
            <Source href={SOURCES.regulations}>CDFW ocean regulations</Source>,
            and browse{" "}
            <Link
              href="/fishing/us/ca"
              className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              fishing spots across California
            </Link>{" "}
            to see conditions and forecasts for where you are headed.
          </p>

          <div className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <p className="text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">Free Fishing Days.</span>{" "}
              Two days a year, {FREE_FISHING_DAYS_2026}, you can fish without
              a license. Bag and size limits, gear rules, closures and report
              card requirements all still apply.{" "}
              <Source href={SOURCES.freeFishing}>CDFW: Free Fishing Days</Source>.
            </p>
          </div>

          <p className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5 text-[13px] leading-relaxed text-rc-ink-mute">
            This page is a plain-language reference, not legal advice, and fees
            and rules change. CDFW is the authority. Every figure here links
            back to the page it came from. Verified {VERIFIED_ON}.
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
                Live conditions, tides and 14-day fishing forecasts for San
                Diego and the offshore banks.
              </p>
            </div>
            <TrialModalButton
              from="ca-licence-guide"
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
