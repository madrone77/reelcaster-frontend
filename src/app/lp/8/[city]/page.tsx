import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { angleFrom } from "../../_shared/lp-angles";
import { resolveLpCard } from "../../_shared/lp-spot";
import { lpRegionFor } from "../../_shared/lp-region";
import { lpCheckoutHref, trialChargeDate } from "../../_shared/lp-checkout";
import { PRICE } from "../../_shared/lp-content";
import { fetchMapSpots } from "@/lib/bluecaster";
import { formatHour12 } from "@/lib/time-format";
import { LP8_CSS } from "./lp8-css";
import Lp8TrialForm from "./trial-form";
import { buildCityProof, type CityProof } from "./city-proof";

/**
 * /lp/8/[city] — the wide, city-led variant.
 *
 * Every other variant sells the product and then proves it with the city's
 * data. This one opens with the city's actual day and lets the product be the
 * explanation for it: the hero is one real mark, one real species and its 24
 * real hourly scores, with the good window lit. A cold reader understands what
 * this is before reading a word of copy, which is the thing a feature list has
 * never managed on this traffic.
 *
 * What it isolates against /lp/6 and /lp/7 is whether leading with the answer
 * beats leading with the pitch. Everything else is held as close to constant
 * as a different layout allows: same trial, same checkout route, same
 * attribution shape, same jurisdiction resolution.
 *
 * It carries its own shell (see lp8-css.ts) for the same reason /lp/1 does.
 * The shared shell describes a 480px phone column, and bending it around a
 * two-column hero would put every other running variant at risk.
 *
 * The CTA is the standard card-required 7-day trial. There is no email-capture
 * alternative on this page: two asks for the same promise split the click, and
 * the weekend digest lives on the indexed city page instead.
 *
 * noindex comes from src/app/lp/layout.tsx.
 */

// Matches the other variants. Inert while the page reads searchParams for the
// angle, and correct the moment it stops.
export const revalidate = 900;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ city: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);
  const card = await resolveLpCard(slug);
  const angle = angleFrom(sp);
  return {
    title: {
      absolute: card
        ? `${card.cityName} fishing: the hours worth going | ReelCaster`
        : `${angle.title} | ReelCaster`,
    },
    description: card
      ? `Every hour at every ${card.cityName} mark, scored. ${angle.subhead}`
      : angle.subhead,
    robots: { index: false, follow: true },
  };
}

export default async function Lp8CityPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ city: slug }, sp] = await Promise.all([params, searchParams]);

  const card = await resolveLpCard(slug);
  if (!card) notFound();

  const angle = angleFrom(sp);
  const region = lpRegionFor(card.provinceCode);
  const from = `lp8-${angle.id}`;
  const checkoutHref = lpCheckoutHref("8", angle.id, card);
  const chargeDate = trialChargeDate(PRICE.trialDays);

  // The city-wide numbers and the marks band. Separate from the card because
  // resolveLpCard deliberately returns ONE spot; this page also wants the
  // roster around it. A failure here costs the two proof bands, not the page.
  const payload = await fetchMapSpots({ city: slug }).catch(() => null);
  const proof: CityProof | null = payload ? buildCityProof(payload, card) : null;

  // The hero reads off the SAME ranking as the marks band below it. Taking
  // the card's spot instead put Constance Bank at 88 above a list topped by
  // Victoria Waterfront at 91, which is a page disagreeing with itself in the
  // reader's first screen. The card still supplies everything that is not a
  // score: the city, the species, the region and the checkout.
  const hero = proof?.hero ?? {
    name: card.spotName,
    score: card.score,
    hours: card.hours,
    bestFrom: card.bestFrom,
    bestTo: card.bestTo,
    peakHour: card.bestFrom >= 0 ? card.bestFrom : 12,
  };

  const windowLabel =
    hero.bestFrom >= 0
      ? `${formatHour12(hero.bestFrom)} to ${formatHour12(hero.bestTo + 1)}`
      : card.windowTime;

  const peakHourLabel = formatHour12(hero.peakHour);

  return (
    <div className="l8">
      <style dangerouslySetInnerHTML={{ __html: LP8_CSS }} />

      <div className="nav">
        <div className="navin">
          <span
            style={{
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: ".13em",
              color: "var(--l8-brand)",
            }}
          >
            REELCASTER
          </span>
          <a className="navcta" href="#start">
            Start {PRICE.trialDays}-day free trial
          </a>
        </div>
      </div>

      {/* HERO: the city's real day, then the ask */}
      <div className="hero">
        <div className="shell herogrid">
          <div>
            <p className="pin">
              <i />
              {card.cityName}
              {region.areaBadge ? ` · ${region.areaBadge}` : ""}
            </p>
            <h1>
              The bite has a schedule.{" "}
              <em>Here is {card.cityName}&rsquo;s.</em>
            </h1>
            <p className="herosub">
              {windowLabel ? (
                <>
                  {card.species} are on at {hero.name} from{" "}
                  <strong style={{ color: "#fff", fontWeight: 600 }}>
                    {windowLabel}
                  </strong>
                  . Every other hour today is worth less, and we scored all of
                  them.
                </>
              ) : (
                <>
                  Every hour at every {card.cityName} mark, scored against how
                  each species actually feeds there. Not a tide table with an
                  opinion.
                </>
              )}
            </p>

            <div id="start">
              <Lp8TrialForm
                from={from}
                region={card.provinceCode}
                chargeDate={chargeDate}
                price={PRICE.year}
                trialDays={PRICE.trialDays}
                fallbackHref={checkoutHref}
                inputId="lp8-email-hero"
                cta="hero"
                angle={angle.id}
              />
            </div>
          </div>

          <div className="day">
            <div className="dayhead">
              <div>
                <div className="dayspot">{hero.name}</div>
                <div className="daymeta">{card.meta || card.species}</div>
              </div>
              <div className="daynum">
                {hero.score}
                <small>OF 100</small>
              </div>
            </div>

            <div
              className="bars"
              role="img"
              aria-label={`Hourly score today at ${hero.name}, peaking at ${hero.score}${
                windowLabel ? ` between ${windowLabel}` : ""
              }`}
            >
              {hero.hours.map((v, h) => {
                const inWindow =
                  hero.bestFrom >= 0 && h >= hero.bestFrom && h <= hero.bestTo;
                return (
                  <i
                    key={h}
                    className={inWindow ? "on" : v < 40 ? "dim" : undefined}
                    style={{
                      height: `${Math.max(4, ((v - 15) / 75) * 100)}%`,
                      animationDelay: `${h * 16}ms`,
                    }}
                  />
                );
              })}
            </div>
            <div className="hrs">
              <span>12a</span>
              <span>6a</span>
              <span>noon</span>
              <span>6p</span>
              <span>11p</span>
            </div>

            <div className="bracket">
              {windowLabel ? <span className="tag">{windowLabel}</span> : null}
              {proof?.conditionNote ? (
                <span className="tag plain">{proof.conditionNote}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* PROOF STRIP */}
      {proof ? (
        <div className="strip">
          <div className="shell stripin">
            <div className="stat">
              <div className="n">{proof.hoursScored.toLocaleString("en-CA")}</div>
              <div className="t">
                hourly scores in your next two weeks
              </div>
            </div>
            <div className="stat">
              <div className="n">{proof.spotCount}</div>
              <div className="t">
                marks, every one of them scored separately
              </div>
            </div>
            <div className="stat">
              <div className="n">24</div>
              <div className="t">hours a day, scored one at a time</div>
            </div>
            <div className="stat">
              <div className="n">14</div>
              <div className="t">days ahead, rebuilt every morning</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* WHY THE NUMBER IS NOT A GUESS */}
      <section className="white">
        <div className="shell two">
          <div>
            <span className="lab">Where the number comes from</span>
            <h2>Not a tide table with an opinion.</h2>
            <p className="sub">
              A tide table tells you the water is moving. It cannot tell you
              that the same current at first light and at noon are worth
              completely different things to the fish you are after. Every hour
              at every mark is scored against how that species actually feeds
              there, then checked against whether a person can fish it.
            </p>
          </div>

          <div className="ladder">
            <div className="rung">
              <div className="rname">
                Season
                <small>
                  {card.species} run timing near {card.cityName}, week by week
                </small>
              </div>
              <div className="rval">weighted</div>
            </div>
            <div className="rung">
              <div className="rname">
                Light
                <small>Sun angle through the whole day, not just sunrise</small>
              </div>
              <div className="meter">
                <u>
                  <b style={{ width: "100%" }} />
                </u>
                <span className="rval">high</span>
              </div>
            </div>
            <div className="rung">
              <div className="rname">
                Current
                <small>
                  Speed and stage from {region.tideAuthority}, hour by hour
                </small>
              </div>
              <div className="meter">
                <u>
                  <b style={{ width: "62%" }} />
                </u>
                <span className="rval">mid</span>
              </div>
            </div>
            <div className="rung">
              <div className="rname">
                Tide exchange
                <small>How hard the whole day is moving water</small>
              </div>
              <div className="rval">weighted</div>
            </div>
            <div className="rung">
              <div className="rname">
                Fishable
                <small>Wind, sea state, rain and visibility</small>
              </div>
              <div className="meter">
                <u>
                  <b style={{ width: "89%" }} />
                </u>
                <span className="rval">good</span>
              </div>
            </div>
            <div className="sum">
              <span>
                {peakHourLabel} at {hero.name}
              </span>
              <b>{hero.score}</b>
            </div>
          </div>
        </div>
      </section>

      {/* THE MARKS */}
      {proof && proof.marks.length > 2 ? (
        <section>
          <div className="shell">
            <span className="lab">
              {card.species} today, mark by mark
            </span>
            {/* Counts the marks actually LISTED, not the city's roster. The
                map payload carries only the species scoring today, so Seattle
                lists 7 of its 15 marks for halibut; a heading that said 15
                over a list of 7 was the same self-contradiction as the hero
                and the leaderboard naming different spots. */}
            <h2 style={{ marginBottom: 28 }}>
              We scored all {proof.marks.length} so you can skip{" "}
              {proof.marks.length - 1}.
            </h2>
            <div className="marks">
              {proof.marks.map((m) => (
                <div className={`mrow${m.name === hero.name ? " top" : ""}`} key={m.name}>
                  <div className="mn">{m.name}</div>
                  <div className="mb">
                    <i
                      style={{
                        width: `${Math.max(8, Math.min(100, ((m.score - 60) / 35) * 100))}%`,
                      }}
                    />
                  </div>
                  <div className="mv">{m.score}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* WHAT IT REPLACES */}
      <section className="white">
        <div className="shell">
          <span className="lab">Before you launch</span>
          <h2>Six tabs, one answer.</h2>
          <div className="chips">
            <span>Tide table</span>
            <span>Wind app</span>
            <span>Current chart</span>
            <span>{region.regulator.name} regulations PDF</span>
            <span>Forum thread</span>
            <span>Your notebook</span>
          </div>
          <div className="one">One number, per hour, per mark.</div>
        </div>
      </section>

      {/* THE TRIAL, SPELLED OUT */}
      <section>
        <div className="shell">
          <span className="lab">How the trial works</span>
          <h2 style={{ marginBottom: 24 }}>
            {PRICE.trialDays} days free, and you will know inside two.
          </h2>
          <div className="steps">
            <div className="step">
              <b>Today</b>
              <p>
                Card on file, <strong>charged nothing</strong>. All 14 days open
                across every {card.cityName} mark, straight away.
              </p>
            </div>
            <div className="step">
              <b>Day {PRICE.reminderDay}</b>
              <p>
                We email you before the trial ends. Not on the morning it
                charges, with <strong>three days</strong> still to decide.
              </p>
            </div>
            <div className="step">
              <b>Day {PRICE.trialDays}</b>
              <p>
                {PRICE.year} on {chargeDate}, or{" "}
                <strong>cancel in one click</strong> before then and pay
                nothing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="white">
        <div className="shell">
          <span className="lab">Straight answers</span>
          <h2 style={{ marginBottom: 28 }}>
            What you are actually signing up for.
          </h2>
          <div className="faq">
            <div className="qa">
              <h3>Does it tell me where the fish are?</h3>
              <p>
                No, and be careful with anything that claims to. It tells you
                when conditions at a mark line up with how that species feeds
                there, which is the part you can plan a morning around.
              </p>
            </div>
            <div className="qa">
              <h3>Where does the data come from?</h3>
              <p>
                {region.tideAuthority} for tides and currents, marine weather
                models and buoys for wind and sea state, and{" "}
                {region.regulator.name} for what is open and what you may keep.
              </p>
            </div>
            <div className="qa">
              <h3>Do I need to install anything?</h3>
              <p>
                No app and no boat computer. It runs in a browser on the phone
                you already carry, and it works the same on the ramp as it does
                at the kitchen table.
              </p>
            </div>
            <div className="qa">
              <h3>What if I cancel?</h3>
              <p>
                One click in your account, any time in the {PRICE.trialDays}{" "}
                days, and you are never charged. No email, no phone call, no
                retention offer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="close">
        <div className="shell">
          <h2>Fish the three hours, not the whole day.</h2>
          <p className="sub">
            Open all 14 days across every {card.cityName} mark. Free for{" "}
            {PRICE.trialDays} days.
          </p>
          <Lp8TrialForm
            from={from}
            region={card.provinceCode}
            chargeDate={chargeDate}
            price={PRICE.year}
            trialDays={PRICE.trialDays}
            fallbackHref={checkoutHref}
            inputId="lp8-email-final"
            cta="final"
            angle={angle.id}
          />
        </div>
      </section>

      <div className="foot">
        ReelCaster {"·"} {card.cityName} and the Salish Sea
        <br />
        Forecasts are guidance, not a guarantee. Always check current{" "}
        {region.regulator.name} regulations before you keep a fish.
      </div>
    </div>
  );
}
