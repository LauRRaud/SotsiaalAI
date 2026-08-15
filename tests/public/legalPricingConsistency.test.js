import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_CLIENT_AMOUNT,
  DEFAULT_SERVICE_PROVIDER_AMOUNT,
  DEFAULT_SOCIAL_WORKER_AMOUNT
} from "../../lib/subscriptionPlans.js";

const LOCALES = ["et", "en", "ru"];
/* Hinna esitusviis tekstides: ET/RU koma, EN punkt. */
const PRICE_STRINGS = {
  et: ["7,99", "14,99", "19,99"],
  en: ["7.99", "14.99", "19.99"],
  ru: ["7,99", "14,99", "19,99"]
};

function loadMessages(locale) {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8")
  );
}

test("serveripoolne hinnaallikas = 7.99/14.99/19.99 (õigusteksti eeldus)", () => {
  assert.deepEqual(
    [DEFAULT_CLIENT_AMOUNT, DEFAULT_SOCIAL_WORKER_AMOUNT, DEFAULT_SERVICE_PROVIDER_AMOUNT],
    [7.99, 14.99, 19.99]
  );
});

test("terms §5 nimetab KÕIK kolm müüdavat paketti kõigis keeltes (L-02 regressioon)", () => {
  for (const locale of LOCALES) {
    const paragraph = loadMessages(locale).terms.section5.paragraph1;
    for (const price of PRICE_STRINGS[locale]) {
      assert.ok(
        paragraph.includes(price),
        `${locale}: terms.section5.paragraph1 ei sisalda hinda ${price}`
      );
    }
    assert.ok(
      paragraph.includes('href="/hinnastus"'),
      `${locale}: terms §5 peab viitama hinnastuse tõeallikale`
    );
  }
});

test("terms §6 ei väida enam päevast süvauuringu piirangut (L-07 regressioon)", () => {
  const forbidden = { et: "päevane kasutuspiirang", en: "a daily usage limit", ru: "дневный лимит" };
  for (const locale of LOCALES) {
    const body = loadMessages(locale).terms.section6.body;
    assert.equal(
      body.includes(forbidden[locale]),
      false,
      `${locale}: terms §6 sisaldab endiselt päevase piirangu väidet`
    );
  }
});

test("privacy ja terms kirjeldavad nõusolekupõhist kõnesalvestust kõigis keeltes", () => {
  const expected = {
    et: ["kõigi nõutud osalejate nõusolekul", "dokumenditeegis"],
    en: ["all required participants have consented", "document library"],
    ru: ["всех необходимых участников", "библиотеке документов"]
  };
  const forbidden = {
    et: ["kõnet ennast ei salvestata", "kõnesid ei salvestata"],
    en: ["the call itself is not recorded", "calls are not recorded.</p>"],
    ru: ["сам звонок не записывается", "звонки не записываются.</p>"]
  };

  for (const locale of LOCALES) {
    const messages = loadMessages(locale);
    const privacy = messages.privacy.section2.paragraph2;
    const terms = messages.terms.section2.body;
    const legalText = `${privacy} ${terms}`.toLocaleLowerCase(locale);

    for (const claim of forbidden[locale]) {
      assert.equal(
        legalText.includes(claim),
        false,
        `${locale}: õigustekst väidab endiselt kategooriliselt, et kõnesid ei salvestata`
      );
    }
    for (const disclosure of expected[locale]) {
      assert.ok(
        legalText.includes(disclosure),
        `${locale}: õigustekstist puudub kõnesalvestuse avalikustamine: ${disclosure}`
      );
    }
  }
});

test("juhendi hinnakohad sisaldavad teenuseosutaja paketti kõigis keeltes", () => {
  for (const locale of LOCALES) {
    const sections = loadMessages(locale).about.guide.sections_v2;
    const providerPrice = PRICE_STRINGS[locale][2];
    for (const key of ["register", "profile", "quickstart"]) {
      const body = String(sections[key]?.body || "");
      if (!body.includes(PRICE_STRINGS[locale][0])) continue; // see jaotis ei nimeta hindu
      assert.ok(
        body.includes(providerPrice),
        `${locale} ${key}: nimetab hindu, aga mitte teenuseosutaja ${providerPrice}`
      );
    }
  }
});
