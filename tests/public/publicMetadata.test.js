import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildLocalizedMetadata } from "../../lib/metadata.js";

const LOCALES = ["et", "en", "ru"];
/* T10 avalike lehtede meta-võtmed (aluscommit 15ab986f leping: mittetühi ×3). */
const T10_META_KEYS = [
  "home",
  "features",
  "pricing",
  "register",
  "subscription",
  "terms",
  "privacy",
  "guide",
  "author"
];

function loadMessages(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8")
  );
}

test("iga T10 lehe meta-title ja -description on ET/EN/RU-s mittetühjad", () => {
  for (const locale of LOCALES) {
    const meta = loadMessages(locale).meta || {};
    for (const key of T10_META_KEYS) {
      assert.ok(
        String(meta[key]?.title || "").trim().length > 0,
        `${locale}: meta.${key}.title on tühi`
      );
      assert.ok(
        String(meta[key]?.description || "").trim().length > 0,
        `${locale}: meta.${key}.description on tühi`
      );
    }
  }
});

test("buildLocalizedMetadata: jagamispilt on og+twitter väljundis, hreflang-alternatiive ei ole", () => {
  const md = buildLocalizedMetadata({
    locale: "et",
    pathname: "/voimalused",
    title: "Pealkiri",
    description: "Kirjeldus"
  });

  assert.ok(Array.isArray(md.openGraph.images) && md.openGraph.images.length === 1);
  assert.equal(md.openGraph.images[0].url, "/og/sotsiaalai-share.png");
  assert.equal(md.openGraph.images[0].width, 1200);
  assert.equal(md.openGraph.images[0].height, 630);
  assert.deepEqual(md.twitter.images, ["/og/sotsiaalai-share.png"]);
  assert.equal(md.twitter.card, "summary_large_image");

  assert.ok(md.alternates.canonical.endsWith("/voimalused"));
  assert.equal(
    "languages" in md.alternates,
    false,
    "sisutühje identseid hreflang-URL-e ei tohi väljastada (T10 lukustatud valik)"
  );
});

test("staatiline jagamispilt on repos olemas ja mõistliku suurusega", () => {
  const p = path.join(process.cwd(), "public", "og", "sotsiaalai-share.png");
  assert.ok(fs.existsSync(p), "public/og/sotsiaalai-share.png puudub");
  const size = fs.statSync(p).size;
  assert.ok(size > 10_000 && size < 400_000, `kahtlane pildisuurus: ${size}`);
});
