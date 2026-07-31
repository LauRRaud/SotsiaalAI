import assert from "node:assert/strict";
import test from "node:test";

import { langStrings } from "@/lib/chat/promptBuilder";

// B0: otsingu ebaõnnestumine ei tohi kasutajale paista kui "allikaid ei leitud".

const LANGS = ["et", "en", "ru"];
const ROLES = ["CLIENT", "SOCIAL_WORKER"];

test("retrievalFailed on olemas kõigis keeltes ja mõlemas rollis", () => {
  for (const lang of LANGS) {
    for (const role of ROLES) {
      const L = langStrings(lang, role);
      assert.equal(typeof L.retrievalFailed, "string", `${lang}/${role}`);
      assert.ok(L.retrievalFailed.length > 40, `${lang}/${role} liiga lühike`);
    }
  }
});

test("retrievalFailed erineb noContext sõnumist", () => {
  for (const lang of LANGS) {
    for (const role of ROLES) {
      const L = langStrings(lang, role);
      assert.notEqual(L.retrievalFailed, L.noContext, `${lang}/${role}`);
    }
  }
});

test("retrievalFailed ei anna käsku küsimust täpsustada", () => {
  // Täpsustamine ei aita, kui otsing ei jõudnud lõpule — see oli algse vea tuum.
  // Kontrollime käskivat vormi, mitte sõnatüve: sõnum TOHIB öelda, et
  // täpsustamine ei aita.
  const imperatives = {
    et: ["palun täpsusta", "täpsusta palun", "kirjelda palun"],
    en: ["please specify", "please describe"],
    ru: ["уточните", "опишите"]
  };
  for (const lang of LANGS) {
    for (const role of ROLES) {
      const text = langStrings(lang, role).retrievalFailed.toLowerCase();
      for (const phrase of imperatives[lang]) {
        assert.ok(!text.includes(phrase), `${lang}/${role} sisaldab käsku: ${phrase}`);
      }
    }
  }
});

test("retrievalFailed juhendab sama küsimust uuesti saatma", () => {
  const retry = { et: "uuesti", en: "again", ru: "ещё раз" };
  for (const lang of LANGS) {
    for (const role of ROLES) {
      const text = langStrings(lang, role).retrievalFailed.toLowerCase();
      assert.ok(text.includes(retry[lang]), `${lang}/${role} ei paku kordamist`);
    }
  }
});

test("retrievalFailed ütleb, et otsing ei õnnestunud", () => {
  const expected = { et: "otsing", en: "search", ru: "поиск" };
  for (const lang of LANGS) {
    for (const role of ROLES) {
      const text = langStrings(lang, role).retrievalFailed.toLowerCase();
      assert.ok(text.includes(expected[lang]), `${lang}/${role} ei maini otsingut`);
    }
  }
});

test("sotsiaaltöötaja ja kliendi sõnastus on eristatud", () => {
  for (const lang of LANGS) {
    const worker = langStrings(lang, "SOCIAL_WORKER").retrievalFailed;
    const client = langStrings(lang, "CLIENT").retrievalFailed;
    assert.notEqual(worker, client, lang);
  }
});

test("kriisisõnum jääb eraldi ega segune otsinguveaga", () => {
  for (const lang of LANGS) {
    const L = langStrings(lang, "CLIENT");
    assert.notEqual(L.crisisNoCtx, L.retrievalFailed, lang);
    assert.ok(L.crisisNoCtx.includes("112"), lang);
  }
});
