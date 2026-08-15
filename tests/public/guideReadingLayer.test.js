import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { filterGuideSections, stripHtml } from "../../lib/guideSearch.js";
import { decodeHashFragment } from "../../lib/hashNavigation.js";

const ROOT = path.join(process.cwd());
const LOCALES = ["et", "en", "ru"];

test("hash navigation tolerates malformed percent encoding", () => {
  assert.equal(decodeHashFragment("#accessibility"), "accessibility");
  assert.equal(decodeHashFragment("#tere%20maailm"), "tere maailm");
  assert.doesNotThrow(() => decodeHashFragment("#%"));
  assert.equal(decodeHashFragment("#%E0%A4%A"), "%E0%A4%A");
});

function loadMessages(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8")
  );
}

/* App-kausta page-failidest tuletatud avalike marsruutide loend — ankrutestid
   ei sõltu käsitsi hoitavast nimekirjast. */
function collectRoutes(dir, prefix = "") {
  const routes = new Set();
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      if (/^page\.(js|jsx|tsx)$/.test(entry.name)) routes.add(prefix || "/");
      continue;
    }
    if (entry.name === "api" || entry.name.startsWith("_")) continue;
    const segment = entry.name;
    const childPrefix = segment.startsWith("(")
      ? prefix
      : `${prefix}/${segment}`;
    routes.add.length; // no-op
    for (const r of collectRoutes(path.join(dir, segment), childPrefix)) {
      routes.add(r);
    }
  }
  return routes;
}

function routeMatches(routes, href) {
  const clean = href.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return routes.has("/");
  if (routes.has(clean)) return true;
  /* dünaamilised segmendid ([id]) — võrdle mustrit */
  for (const route of routes) {
    if (!route.includes("[")) continue;
    const pattern = new RegExp(
      "^" + route.replace(/\[[^\]]+\]/g, "[^/]+") + "$"
    );
    if (pattern.test(clean)) return true;
  }
  return false;
}

test("filterGuideSections: pealkirja- ja märksõnaotsing, tühi päring, tühi tulemus", () => {
  const sections = [
    { key: "a", title: "Registreerimine", body: "<p>Konto <strong>loomine</strong> ja PIN.</p>" },
    { key: "b", title: "Vestlus", body: "<p>Sõnumid ja dikteerimine.</p>" }
  ];

  assert.equal(filterGuideSections(sections, "").length, 2, "tühi päring = kõik peatükid");
  assert.equal(filterGuideSections(sections, "  ").length, 2);

  const byTitle = filterGuideSections(sections, "vestlus");
  assert.deepEqual(byTitle.map((s) => s.key), ["b"]);

  const byBody = filterGuideSections(sections, "pin");
  assert.deepEqual(byBody.map((s) => s.key), ["a"], "kehatekst leitav HTML-i seest");

  assert.equal(filterGuideSections(sections, "olematu-sõna").length, 0, "tühi tulemus on tühi massiiv");
});

test("stripHtml eemaldab märgendi ega jäta topelttühikuid", () => {
  assert.equal(stripHtml("<p>Tere  <strong>maailm</strong>!</p>"), "Tere maailm !");
  assert.equal(stripHtml(""), "");
  assert.equal(stripHtml(null), "");
});

test("juhendi tekstides ei ole enam katkist /#meist ankrut üheski keeles", () => {
  for (const locale of LOCALES) {
    const raw = fs.readFileSync(path.join(ROOT, "messages", `${locale}.json`), "utf8");
    assert.equal(
      raw.includes("/#meist"),
      false,
      `${locale}.json sisaldab endiselt katkist /#meist viidet`
    );
  }
});

test("juhendi kõik siselingid osutavad olemasolevatele marsruutidele (ET/EN/RU)", () => {
  const routes = collectRoutes(path.join(ROOT, "app"));
  for (const locale of LOCALES) {
    const messages = loadMessages(locale);
    const sections = messages.about.guide.sections_v2;
    for (const [key, section] of Object.entries(sections)) {
      const body = String(section?.body || "");
      const hrefs = [...body.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
      for (const href of hrefs) {
        if (!href.startsWith("/")) continue; // välised, mailto, # (modaalid)
        assert.ok(
          routeMatches(routes, href),
          `${locale} ${key}: siselink ${href} ei vasta ühelegi app/ marsruudile`
        );
      }
    }
  }
});

test("juhendi peatükivõtmed on unikaalsed ja olemas kõigis keeltes", () => {
  const etSections = loadMessages("et").about.guide.sections_v2;
  const keys = Object.keys(etSections);
  assert.equal(new Set(keys).size, keys.length);
  for (const locale of LOCALES) {
    const sections = loadMessages(locale).about.guide.sections_v2;
    for (const key of keys) {
      assert.ok(sections[key]?.title, `${locale}: ${key}.title puudub`);
      assert.ok(sections[key]?.body, `${locale}: ${key}.body puudub`);
    }
  }
});
