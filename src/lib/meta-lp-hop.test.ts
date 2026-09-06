import assert from "node:assert";
import { isMetaLpArrival, isMetaTraffic, lpCityFor, lpFiveHop, metaExploreHop, metaLpDestination } from "./meta-lp-hop";

const tests: Array<[string, () => void]> = [];
const test = (name: string, fn: () => void) => tests.push([name, fn]);

test("fbclid alone marks Meta", () => {
  assert.equal(isMetaTraffic({ search: "?fbclid=abc", referrer: "" }), true);
});

test("utm_source meta, facebook, instagram mark Meta, case-insensitively", () => {
  for (const s of ["meta", "Facebook", "instagram", "IG", "fb"]) {
    assert.equal(isMetaTraffic({ search: `?utm_source=${s}`, referrer: "" }), true, s);
  }
});

test("a Meta referrer marks Meta, including subdomains", () => {
  for (const r of [
    "https://l.facebook.com/",
    "https://lm.facebook.com/l.php?u=x",
    "https://www.instagram.com/",
    "https://l.instagram.com/",
    "http://fb.com/x",
  ]) {
    assert.equal(isMetaTraffic({ search: "", referrer: r }), true, r);
  }
});

test("Google, direct and organic are not Meta", () => {
  assert.equal(isMetaTraffic({ search: "?gclid=x&utm_source=google&utm_medium=cpc", referrer: "https://www.google.com/" }), false);
  assert.equal(isMetaTraffic({ search: "", referrer: "" }), false);
  assert.equal(isMetaTraffic({ search: "?utm_medium=paid_social", referrer: "" }), false);
  assert.equal(isMetaTraffic({ search: "", referrer: "https://notfacebook.com/" }), false);
  assert.equal(isMetaTraffic({ search: "", referrer: "garbage" }), false);
});

test("city-first landing pages name their city", () => {
  assert.equal(lpCityFor("/lp/seattle/5", ""), "seattle-wa");
  assert.equal(lpCityFor("/lp/seattle/1", ""), "seattle-wa");
  assert.equal(lpCityFor("/lp/vancouver/4/", ""), "vancouver-bc");
  assert.equal(lpCityFor("/lp/tacoma/5", ""), "tacoma-wa");
});

test("variant-first landing pages take the city from the path or the doorway query", () => {
  assert.equal(lpCityFor("/lp/5/seattle-wa", ""), "seattle-wa");
  assert.equal(lpCityFor("/lp/7/victoria-bc", "?city=seattle-wa"), "victoria-bc");
  assert.equal(lpCityFor("/lp/5", "?city=Nanaimo-BC"), "nanaimo-bc");
  assert.equal(lpCityFor("/lp/5", ""), null);
  assert.equal(lpCityFor("/lp/5", "?city=../x"), null);
  assert.equal(lpCityFor("/lp/5/bad_slug", ""), null);
});

test("unknown shapes name no city", () => {
  assert.equal(lpCityFor("/lp", ""), null);
  assert.equal(lpCityFor("/lp/seattlel", ""), null);
  assert.equal(lpCityFor("/explore", ""), null);
  assert.equal(lpCityFor("/lp/5/seattle-wa/extra", ""), null);
});

test("a Meta click on a landing page hops to the ad-framed map with its query intact", () => {
  const hop = metaExploreHop({
    pathname: "/lp/seattle/5",
    search: "?utm_source=meta&utm_medium=paid_social&fbclid=abc&a=green",
    referrer: "https://l.facebook.com/",
  });
  assert.ok(hop);
  const [path, qs] = hop!.split("?");
  assert.equal(path, "/explore");
  const p = new URLSearchParams(qs);
  assert.equal(p.get("loc"), "seattle-wa");
  assert.equal(p.get("ad"), "day2");
  assert.equal(p.get("fbclid"), "abc");
  assert.equal(p.get("utm_source"), "meta");
  assert.equal(p.get("a"), "green");
});

test("the doorway's ?city becomes ?loc and is not carried twice", () => {
  const hop = metaExploreHop({
    pathname: "/lp/5",
    search: "?city=vancouver-bc&fbclid=x",
    referrer: "",
  });
  const p = new URLSearchParams(hop!.split("?")[1]);
  assert.equal(p.get("loc"), "vancouver-bc");
  assert.equal(p.has("city"), false);
});

test("a stray ?ad or ?loc on the landing URL is replaced, not duplicated", () => {
  const hop = metaExploreHop({
    pathname: "/lp/tacoma/5",
    search: "?ad=today&loc=seattle-wa&fbclid=x",
    referrer: "",
  });
  const p = new URLSearchParams(hop!.split("?")[1]);
  assert.deepEqual(p.getAll("ad"), ["day2"]);
  assert.deepEqual(p.getAll("loc"), ["tacoma-wa"]);
});

test("a landing page with no city still hops, with no loc", () => {
  const hop = metaExploreHop({ pathname: "/lp/5", search: "?fbclid=x", referrer: "" });
  assert.equal(hop, "/explore?fbclid=x&ad=day2");
});

test("Google and organic visits read the landing page", () => {
  assert.equal(
    metaExploreHop({ pathname: "/lp/seattle/5", search: "?gclid=x&utm_source=google", referrer: "https://www.google.com/" }),
    null,
  );
  assert.equal(metaExploreHop({ pathname: "/lp/seattle/5", search: "", referrer: "" }), null);
});

test("Meta traffic anywhere but a landing page is left alone", () => {
  for (const path of ["/", "/explore", "/fishing/us/wa/seattle-wa/jefferson-head-d0d536", "/lpx", "/plans"]) {
    assert.equal(metaExploreHop({ pathname: path, search: "?fbclid=x", referrer: "" }), null, path);
  }
});

test("the control arm reads the city's /5 page: a hop only from another number", () => {
  assert.equal(lpFiveHop("/lp/vancouver/4", "?utm_source=meta&a=green"), "/lp/vancouver/5?utm_source=meta&a=green");
  assert.equal(lpFiveHop("/lp/seattle/1/", ""), "/lp/seattle/5");
  assert.equal(lpFiveHop("/lp/tacoma/5", "?fbclid=x"), null);
  assert.equal(lpFiveHop("/lp/vancouver/5/", ""), null);
  // No city-first family: the page reads as it is.
  assert.equal(lpFiveHop("/lp/5/seattle-wa", ""), null);
  assert.equal(lpFiveHop("/lp/5", "?city=seattle-wa"), null);
  assert.equal(lpFiveHop("/lp/victoria/4", ""), null);
  assert.equal(lpFiveHop("/explore", ""), null);
});

test("the destination follows the arm, and only for a Meta click on a landing page", () => {
  const meta = { pathname: "/lp/vancouver/4", search: "?utm_source=meta&fbclid=z", referrer: "" };
  assert.equal(isMetaLpArrival(meta), true);
  assert.equal(metaLpDestination({ ...meta, arm: "a" }), "/lp/vancouver/5?utm_source=meta&fbclid=z");
  const b = metaLpDestination({ ...meta, arm: "b" });
  assert.ok(b && b.startsWith("/explore?"));
  assert.equal(new URLSearchParams(b!.split("?")[1]).get("loc"), "vancouver-bc");
  assert.equal(new URLSearchParams(b!.split("?")[1]).get("ad"), "day2");

  // Already on /5: the control arm reads the page, the treatment still hops.
  const five = { pathname: "/lp/tacoma/5", search: "?utm_source=meta", referrer: "" };
  assert.equal(metaLpDestination({ ...five, arm: "a" }), null);
  const fiveB = metaLpDestination({ ...five, arm: "b" });
  assert.ok(fiveB?.startsWith("/explore?"));
  assert.equal(new URLSearchParams(fiveB!.split("?")[1]).get("loc"), "tacoma-wa");

  // Google reads the landing page whatever the arm.
  const google = { pathname: "/lp/vancouver/4", search: "?gclid=1&utm_source=google", referrer: "" };
  assert.equal(isMetaLpArrival(google), false);
  assert.equal(metaLpDestination({ ...google, arm: "a" }), null);
  assert.equal(metaLpDestination({ ...google, arm: "b" }), null);

  // Off the landing pages nothing is decided.
  assert.equal(metaLpDestination({ pathname: "/explore", search: "?fbclid=1", referrer: "", arm: "b" }), null);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${name}`);
    console.log(err);
  }
}
if (failed) process.exit(1);
