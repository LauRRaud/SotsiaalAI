/**
 * TEENUSPÄEVIK E5 — AI-mustandi sisend ja märgistus.
 *
 * MUDEL EI NÄE ANDMEBAASI, ta näeb ainult seda teksti, mille see moodul
 * koostab. Seega on siinne tekst KOGU see kontekst, mille põhjal aruanne
 * sünnib — ja iga viga siin on viga aruandes, mille alla kirjutab inimene.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_SEED_NOTES,
  NARRATIVE_DRAFT_PROVENANCE,
  PROVENANCE_LABEL,
  buildNarrativeInstruction,
  buildNarrativeSourceText,
  wrapNarrativeDraft
} from "../../lib/serviceLog/narrativeDraft.js";
import { PROVENANCE, PROVENANCES } from "../../lib/serviceLog/constants.js";

function seed(overrides = {}) {
  return {
    entryCount: 4,
    draftCount: 1,
    hasUnconfirmed: true,
    periodFrom: "2026-08-03",
    periodTo: "2026-08-27",
    totals: [{ unit: "HOUR", total: 9.5, visits: 4 }],
    activities: [{ name: "Söögi valmistamine", count: 3 }],
    notes: [
      {
        date: "2026-08-05",
        note: "Ütles, et ei saa trepist üles",
        provenance: PROVENANCE.KLIENDI_OELDUD,
        isDraft: false
      },
      {
        date: "2026-08-12",
        note: "Näis väsinum kui varem",
        provenance: PROVENANCE.TOOTAJA_TAHELEPANEK,
        isDraft: true
      }
    ],
    goalsText: "Säilitada iseseisev toimetulek kodus",
    referralId: "ref-1",
    ...overrides
  };
}

/* PÄRITOLU ON SISENDI TÄHTSAIM OSA. „Ta ütles, et ei saa hakkama" ja „mulle
   tundus, et ta ei saa hakkama" ei ole sama lause — kui mudel neid ei erista,
   on kogu päritolumärgistus mõttetu töö. */
test("iga märge läheb mudelile koos päritoluga", () => {
  const text = buildNarrativeSourceText(seed(), { month: "2026-08" });
  assert.ok(text.includes("kliendi öeldud"), "kliendi öeldud peab olema märgitud");
  assert.ok(text.includes("töötaja tähelepanek"));
  assert.ok(text.includes("Ütles, et ei saa trepist üles"));
});

test("kinnitamata kirje on sisendis nähtav", () => {
  const text = buildNarrativeSourceText(seed(), { month: "2026-08" });
  assert.ok(text.includes("Kinnitamata kirjeid: 1"));
  assert.ok(text.includes("[kinnitamata kirje]"), "kinnitamata märge on eraldi tähistatud");
});

test("eesmärgid ja mahud jõuavad sisendisse", () => {
  const text = buildNarrativeSourceText(seed(), { month: "2026-08" });
  assert.ok(text.includes("Säilitada iseseisev toimetulek kodus"));
  assert.ok(text.includes("HOUR: 9.5"));
  assert.ok(text.includes("Söögi valmistamine: 3"));
});

/* Vaikne kärpimine annaks tervikliku välimusega poole loo — ja mudel kirjutaks
   selle pealt aruande, mis näeb välja täielik. */
test("mahupiiri ületamine on sisendis VÄLJA ÖELDUD", () => {
  const notes = Array.from({ length: MAX_SEED_NOTES + 5 }, (_, index) => ({
    date: "2026-08-01",
    note: `märge ${index}`,
    provenance: PROVENANCE.TOOTAJA_TAHELEPANEK,
    isDraft: false
  }));
  const text = buildNarrativeSourceText(seed({ notes }), { month: "2026-08" });
  assert.ok(text.includes("jäi mahupiiri tõttu välja"));
  assert.ok(!text.includes(`märge ${MAX_SEED_NOTES + 4}`), "üle piiri märget sisendis ei ole");
});

/* Narratiiv käib ühe kliendi kohta ja kontekst on teada niigi; nime saatmine
   lisaks isikuandmeid ilma, et tekst paremaks läheks. */
test("kliendi nime sisendis ei ole", () => {
  const text = buildNarrativeSourceText(seed({ clientDisplayName: "Mari Mägi" }), {
    month: "2026-08"
  });
  assert.ok(!text.includes("Mari Mägi"));
});

test("juhis keelab leiutamise ja nõuab fakti-tõlgenduse lahusust", () => {
  const instruction = buildNarrativeInstruction();
  assert.ok(/ÄRA leiuta/i.test(instruction));
  assert.ok(/LAHUS/i.test(instruction));
  assert.ok(/ettepanek/i.test(instruction), "mall C lõpeb ettepanekuga");
});

/* Ilma märgiseta oleks masina kirjutatud lõik aruandes eristamatu inimese
   omast — ja just seda ei tohi juhtuda. */
test("mustand kannab AI_MUSTAND märgist ja jääb mustandiks", () => {
  const wrapped = wrapNarrativeDraft("  tekst  ", { month: "2026-08", generatedAt: "x" });
  assert.equal(wrapped.provenance, NARRATIVE_DRAFT_PROVENANCE);
  assert.equal(NARRATIVE_DRAFT_PROVENANCE, PROVENANCE.AI_MUSTAND);
  assert.equal(wrapped.isDraft, true);
  assert.equal(wrapped.content, "tekst");
});

test("tühi koond annab tühja sisendi, mitte poolikut teksti", () => {
  assert.equal(buildNarrativeSourceText(null), "");
});

/* KATE PEAB OLEMA TÄIELIK. Esimene versioon viitas olematule konstandile
   (`KLIENDI_UTLUS`; õige on `KLIENDI_OELDUD`) — võti muutus vaikselt
   `undefined`-iks ja mudelile läks sildi asemel toores väärtus
   „kliendi_utlus". Produktsiooni-jooks näitas seda; ükski test ei vaadanud
   mudelile minevat teksti.

   KONTROLLIME KAARDI KATET, mitte teksti kuju: mõne päritolu silt ongi sama
   sõna väiketähtedega („dokumendist") ja tekstipõhine kontroll annaks seal
   vale alarmi. */
test("igal platvormi päritolul on kaardis silt", () => {
  for (const provenance of PROVENANCES) {
    assert.ok(
      typeof PROVENANCE_LABEL[provenance] === "string" && PROVENANCE_LABEL[provenance].length > 0,
      `${provenance} puudub sildikaardis`
    );
  }
});

/* Ja vastupidi: kaardis ei tohi olla võtit, mida sõnastikus ei ole — just nii
   tekkis `undefined`-võti, mis viga varjas. */
test("sildikaardis ei ole tundmatuid võtmeid", () => {
  for (const key of Object.keys(PROVENANCE_LABEL)) {
    assert.ok(PROVENANCES.includes(key), `${key} ei ole platvormi päritolu`);
  }
});
