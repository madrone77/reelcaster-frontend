import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Fish, Info, Shell, Waves } from "lucide-react";
import { btn } from "@/app/components/ui/button";
import TrialModalButton from "@/app/components/paywall/trial-modal-button";
import { breadcrumbJsonLd, DEFAULT_OG, siteUrl } from "@/lib/site";
import { DetailCards, Fees, SectionHeading, Source, Steps } from "../guide-ui";
import {
  ANNUAL_FEES,
  CATCH_CARDS,
  ENDORSEMENTS,
  LICENCE_YEAR,
  SHORT_TERM_FEES,
  SOURCES,
  VERIFIED_ON,
} from "./licence-data";

const PATH = "/fishing-licence/wa";
const CANONICAL = siteUrl(PATH);

// American spelling in all copy — WDFW writes "license", and so does everyone
// searching for one in Washington. Only the URL segment keeps the site-wide
// "/fishing-licence/" spelling, so both regions share one route and one layout;
// /fishing-license/wa 308s in (see next.config.ts).
export const metadata: Metadata = {
  // Bare title — the root layout's "%s | ReelCaster" template adds the brand.
  title: `Washington Fishing License ${LICENCE_YEAR.label}: Costs and How to Get One`,
  description:
    `How to get a Washington fishing license in ${LICENCE_YEAR.label}. WDFW freshwater, saltwater, shellfish and combination licenses with current fees, the endorsements people miss, catch record card rules, and Discover Pass parking.`,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: `Washington Fishing License ${LICENCE_YEAR.label} | ReelCaster`,
    description:
      "Which of the four WDFW licenses you need, what each costs, and the endorsements that catch people out.",
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
    q: "Do I need a license to fish in Washington?",
    a: "From age 16, yes. Anglers 15 and younger need no license at all — but they do still need a catch record card for salmon, steelhead, sturgeon, halibut or Puget Sound Dungeness crab, and that trips up a lot of families.",
  },
  {
    q: "Does a saltwater license cover crab and clams?",
    a: "No, and this is the most expensive assumption in Washington. Finfish and shellfish are sold as separate licenses: a saltwater license covers salmon, halibut and bottomfish, while crab, clams, oysters and seaweed need a shellfish/seaweed license. A combination license covers both. If you also want to crab in Puget Sound you need a third thing on top — the Puget Sound Dungeness crab endorsement.",
  },
  {
    q: "Which license should I buy if I do a bit of everything?",
    a: "The combination, at $74.37 for a resident. Freshwater, saltwater and shellfish/seaweed bought separately come to $102.24, so the combination saves $27.87 and removes any risk of being on the water with the wrong one. Washington residents who also want all three endorsements should look at the Fish Washington package at $101.88.",
  },
  {
    q: "How long is a Washington fishing license valid?",
    a: `The license year runs ${LICENCE_YEAR.start} to ${LICENCE_YEAR.end} — not twelve months from purchase. It is the same license year British Columbia uses, so if you fish both sides of the border, both licenses expire on the same night.`,
  },
  {
    q: "What is a catch record card and do I need one?",
    a: "It is a harvest record you must carry and fill in for salmon, steelhead, sturgeon, halibut and Puget Sound Dungeness crab. You record each fish or crab before you carry on fishing or redeploy your gear — not at the end of the day. You must also return the card by its deadline even if you caught nothing, or never went out at all.",
  },
  {
    q: "Can I use my phone instead of a paper catch record card?",
    a: "Yes. Electronic catch record cards are available through the MyWDFW and Fish Washington apps. They work without cell service and report themselves when you submit, so there is nothing to mail. Paper cards remain valid if you prefer them.",
  },
  {
    q: "Do I need a Discover Pass to go fishing?",
    a: "You need something to park on WDFW land. Most annual licenses include a free Vehicle Access Pass covering WDFW wildlife areas and water access sites — but an annual razor clam or shellfish/seaweed license does not include one. A Discover Pass ($51.50 a year, $11.50 a day) covers those sites plus state parks and DNR land.",
  },
  {
    q: "Is there free fishing in Washington?",
    a: "One weekend each June — June 6–7 in 2026. The catch is how much it excludes: you still need a license for salmon, steelhead, sturgeon, halibut and all shellfish, and catch record cards are still required. It genuinely covers trout, bass, perch and most bottomfish. Every other rule — seasons, size limits, bag limits, closures — still applies.",
  },
  {
    q: "I have a BC licence. Does it work in Washington?",
    a: "No. They are different countries with different agencies, and neither recognises the other. The marine boundary in the Strait of Juan de Fuca and the San Juans is not signposted on the water, so if you fish near it, know which side you are on and carry the licence for it.",
  },
];

/** Ordered anchors for the jump list and the section headings they point at. */
const SECTIONS = [
  { id: "which", label: "Which license?" },
  { id: "costs", label: "What it costs" },
  { id: "endorsements", label: "Endorsements" },
  { id: "catch-cards", label: "Catch record cards" },
  { id: "parking", label: "Parking" },
  { id: "buy", label: "How to buy" },
  { id: "limits", label: "What it doesn't cover" },
  { id: "faq", label: "FAQ" },
] as const;

const BREADCRUMBS = breadcrumbJsonLd([
  { name: "Home", path: "/" },
  { name: "Washington Fishing License", path: PATH },
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

/** The four base products, as a choose-one grid. */
const LICENCE_TYPES = [
  {
    icon: Fish,
    title: "Fresh water",
    covers: "Lakes, rivers and streams. Trout, bass, walleye, perch.",
    product: "Freshwater license",
    price: "$39.95/yr resident",
  },
  {
    icon: Waves,
    title: "Salt water — finfish",
    covers:
      "Marine Areas 1–13. Salmon, halibut, lingcod, rockfish and other bottomfish.",
    product: "Saltwater license",
    price: "$40.71/yr resident",
  },
  {
    icon: Shell,
    title: "Shellfish & seaweed",
    covers:
      "Crab, clams, oysters, mussels, shrimp, seaweed. Sold separately from finfish.",
    product: "Shellfish/Seaweed license",
    price: "$21.58/yr resident",
  },
  {
    icon: Info,
    title: "All of the above",
    covers:
      "The usual answer. Cheaper than buying all three of the above separately.",
    product: "Combination license",
    price: "$74.37/yr resident",
  },
];

export default function WaFishingLicensePage() {
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
                Washington Fishing License
              </li>
            </ol>
          </nav>

          <h1 className="mt-4 text-4xl md:text-5xl font-black tracking-[-0.02em] text-rc-ink text-balance">
            Washington fishing license, {LICENCE_YEAR.label}
          </h1>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-rc-ink-soft text-pretty">
            One agency runs licensing in Washington, which makes it sound
            simpler than British Columbia. It isn&rsquo;t. WDFW sells four
            separate licenses, then layers endorsements and catch record cards
            on top, and the combination you need depends on both the water and
            the species. This page works out which pieces you actually need.
          </p>

          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 font-rc-mono text-[11px] text-rc-ink-mute">
            <span className="text-rc-ink-soft">
              Fees verified {VERIFIED_ON} against WDFW.
            </span>
            <span>
              License year {LICENCE_YEAR.start} – {LICENCE_YEAR.end}.
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
          <SectionHeading id="which">Which license do you need?</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            Required from age 16. Pick by what you intend to catch, not where
            you launch.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {LICENCE_TYPES.map((t) => (
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
                  A saltwater license does not cover crab.
                </p>
                <p className="mt-2">
                  This is the assumption that costs Washington anglers the most
                  money. Finfish and shellfish are separate products, so
                  dropping a crab pot on a saltwater license alone is not
                  legal. In Puget Sound you need three things stacked: a
                  shellfish/seaweed or combination license, the{" "}
                  <a
                    href="#endorsements"
                    className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
                  >
                    Puget Sound Dungeness crab endorsement
                  </a>
                  , and a crab catch record card.
                </p>
                <p className="mt-2">
                  If you also fish north of the border, note that BC works the
                  opposite way — one tidal licence covers finfish and shellfish
                  together. See the{" "}
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

        {/* ── 2. Costs ───────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-ink-mute">
            Washington Department of Fish &amp; Wildlife
          </p>
          <SectionHeading id="costs">What it costs</SectionHeading>

          <h3 className="mt-6 text-lg font-bold text-rc-ink">Annual licenses</h3>
          <Fees
            table={ANNUAL_FEES}
            caption={`Washington annual fishing license fees, ${LICENCE_YEAR.label}`}
            termHeader="License"
          />

          <h3 className="mt-8 text-lg font-bold text-rc-ink">
            Short-term licenses
          </h3>
          <Fees
            table={SHORT_TERM_FEES}
            caption={`Washington short-term fishing license fees, ${LICENCE_YEAR.label}`}
            termHeader="License"
          />
        </section>

        {/* ── 3. Endorsements ────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="endorsements">Endorsements</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            An endorsement is a permission bolted onto a license you already
            hold. Without the right one your license is valid and you still
            aren&rsquo;t allowed to do the thing.
          </p>
          <DetailCards
            items={ENDORSEMENTS.map((e) => ({
              name: e.name,
              figures: e.figures,
              detail: e.detail,
            }))}
          />
          <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-mute">
            Washington residents who want all three should compare the total
            against the Fish Washington package ($101.88), which bundles them
            with a combination license.{" "}
            <Source href={SOURCES.endorsements}>WDFW — endorsements</Source>.
          </p>
        </section>

        {/* ── 4. Catch record cards ──────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="catch-cards">Catch record cards</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            Required for salmon, steelhead, sturgeon, halibut and Puget Sound
            Dungeness crab. Two rules do most of the damage: you record a fish{" "}
            <em>before you carry on fishing</em>, not at the end of the day —
            and for crab, before you redeploy your gear.
          </p>

          <div className="mt-5 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <p className="text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">
                Children need one even though they need no license.
              </span>{" "}
              Anglers 15 and younger are exempt from licensing but not from
              catch record cards. A family fishing for salmon needs a card for
              every person on the boat.
            </p>
          </div>

          <DetailCards
            items={CATCH_CARDS.map((c) => ({
              name: c.species,
              figures: [{ label: "Deadline", value: c.deadline }],
              detail: c.detail,
            }))}
          />

          <div className="mt-6 rounded-xl border border-rc-brand/30 bg-rc-brand-soft p-5">
            <p className="font-rc-mono text-[10px] tracking-[0.14em] uppercase text-rc-brand">
              New for 2026
            </p>
            <p className="mt-2 text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">
                Electronic catch record cards.
              </span>{" "}
              You can now record and report on your phone through the MyWDFW
              and Fish Washington apps. They work without cell service and
              report themselves on submission, so there is no card to mail and
              no deadline to forget. Paper cards are still valid if you prefer
              them.{" "}
              <Source href={SOURCES.catchRecordCard}>
                WDFW — catch record cards
              </Source>
              .
            </p>
          </div>

          <p className="mt-5 text-[15px] leading-relaxed text-rc-ink-soft">
            You must return every card by its deadline{" "}
            <strong className="font-semibold text-rc-ink">
              even if you caught nothing, and even if you never went out
            </strong>
            . Miss a crab report and a $10 penalty is added to your next
            license purchase.
          </p>
        </section>

        {/* ── 5. Parking ─────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="parking">Parking: the pass you also need</SectionHeading>
          <p className="mt-4 text-[15px] md:text-base leading-relaxed text-rc-ink-soft">
            A license lets you fish. It does not, on its own, let you leave the
            car anywhere — and a ticket at a boat ramp is the most avoidable
            cost in Washington fishing.
          </p>
          <ul className="mt-5 space-y-3">
            {[
              [
                "Vehicle Access Pass — free with most annual licenses",
                "Covers WDFW wildlife areas and water access sites, and works on two vehicles. It comes with any annual fishing license EXCEPT an annual razor clam or shellfish/seaweed license — buy only one of those two and you get no pass at all.",
              ],
              [
                "Discover Pass — $51.50 a year, $11.50 a day",
                "Covers the WDFW sites plus Washington State Parks and DNR land. Both prices include the processing fee. Worth it if you park anywhere beyond WDFW's own sites, or if your license type doesn't include the free pass.",
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
          <p className="mt-4 text-[13px] leading-relaxed text-rc-ink-mute">
            <Source href={SOURCES.parking}>WDFW — parking and access passes</Source>.
          </p>
        </section>

        {/* ── 6. How to buy ──────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-6 py-10 border-t border-rc-rule">
          <SectionHeading id="buy">How to buy one</SectionHeading>
          <Steps
            steps={[
              <>
                Go to{" "}
                <Source href={SOURCES.buy}>fishhunt.dfw.wa.gov</Source> and sign
                in, or buy through the MyWDFW app. Hundreds of dealers around
                the state sell the same licenses over the counter, and WDFW
                takes phone orders on 360-902-2464.
              </>,
              <>
                Pick your license — combination unless you are certain you only
                want one water type. Residency is where you live; there is no
                senior or youth discount for non-residents.
              </>,
              <>
                Add any endorsements you need. Puget Sound crab is the one
                people forget, and a shellfish license without it does not let
                you set a pot.
              </>,
              <>
                Add your catch record cards if you will fish salmon, steelhead,
                sturgeon, halibut or Puget Sound crab — including cards for any
                under-16s fishing with you.
              </>,
              <>
                Buying online or by phone can take 10–15 days for the license to
                arrive in the mail, so do not leave it to the night before.
                Temporary licenses are emailed immediately if your account has
                an address on file.
              </>,
            ]}
          />
        </section>

        {/* ── 7. Limits ──────────────────────────────────────────── */}
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
                "Marine Area rules",
                "Washington's 13 Marine Areas each run their own salmon seasons and limits, and adjacent areas often differ. Area 9 and Area 10 are not interchangeable.",
              ],
              [
                "Emergency rule changes",
                "WDFW opens and closes fisheries in-season, sometimes within days. The printed pamphlet is a starting point, not the current state.",
              ],
              [
                "Size and daily limits",
                "Vary by species, area and season, and hatchery-marked fish are frequently treated differently from wild ones.",
              ],
              [
                "Shellfish safety closures",
                "Beaches close for biotoxins and pollution independently of season. These are health closures issued by the Department of Health, and a valid shellfish license means nothing against them.",
              ],
              [
                "Tribal and treaty waters",
                "Some areas carry co-management arrangements that affect what is open to recreational harvest.",
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
            <Source href={SOURCES.regulations}>WDFW regulations</Source>, check
            beaches with{" "}
            <Source href={SOURCES.shellfishSafety}>
              the Department of Health
            </Source>{" "}
            before harvesting shellfish, and browse{" "}
            <Link
              href="/fishing/wa"
              className="text-rc-brand underline underline-offset-2 hover:text-rc-brand-hover"
            >
              fishing spots across Washington
            </Link>{" "}
            to see conditions and forecasts for where you are headed.
          </p>

          <div className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5">
            <p className="text-sm leading-relaxed text-rc-ink-soft">
              <span className="font-medium text-rc-ink">
                Free Fishing Weekend.
              </span>{" "}
              One weekend each June — 6–7 June in 2026 — you can fish without a
              license, and the Discover Pass is waived too. It does{" "}
              <em>not</em> cover salmon, steelhead, sturgeon, halibut or any
              shellfish, catch record cards are still required, and every other
              rule still applies.{" "}
              <Source href={SOURCES.freeFishing}>WDFW — Free Fishing Weekend</Source>
              .
            </p>
          </div>

          <p className="mt-6 rounded-xl border border-rc-rule bg-rc-surface p-5 text-[13px] leading-relaxed text-rc-ink-mute">
            This page is a plain-language reference, not legal advice, and fees
            and rules change. WDFW is the authority — every figure here links
            back to the page it came from. Verified {VERIFIED_ON}.
          </p>
        </section>

        {/* ── 8. FAQ ─────────────────────────────────────────────── */}
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
                License sorted. Now pick the day.
              </h2>
              <p className="mt-3 text-pretty text-base text-white/80">
                Live conditions, tides and 14-day fishing forecasts for Puget
                Sound and the Washington coast.
              </p>
            </div>
            <TrialModalButton
              from="wa-licence-guide"
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
