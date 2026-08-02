/**
 * TEENUSPÄEVIK-V1 E5 — narratiivi lähtekoondi lepingutestid.
 *
 * Koond on aus lähtepunkt: ta EI kirjuta teksti ega leiuta midagi juurde.
 * Iga rida peab olema jälgitav kirjeni ja päritolu ei tohi koondamisel kaduda.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  NARRATIVE_PROPOSALS,
  buildNarrativeSeed,
  isNarrativeProposal
} from "../../lib/serviceLog/narrativeSeed.js";
import { ENTRY_STATUS, PROVENANCE, SERVICE_UNIT } from "../../lib/serviceLog/constants.js";

const entry = (over = {}) => ({
  date: "2026-08-10",
  unit: SERVICE_UNIT.HOUR,
  quantity: 2,
  activities: ["saatmine"],
  note: null,
  noteProvenance: null,
  status: ENTRY_STATUS.FINAL,
  ...over
});

test("koond liidab kestused ja loeb külastused", () => {
  const seed = buildNarrativeSeed([entry(), entry({ quantity: 3 })]);
  assert.equal(seed.totals[0].total, 5);
  assert.equal(seed.totals[0].visits, 2);
  assert.equal(seed.entryCount, 2);
});

test("TÜHISTATUD kirje ei ole koondis — ta ei ole toimunud töö", () => {
  const seed = buildNarrativeSeed([entry(), entry({ quantity: 99, status: ENTRY_STATUS.VOID })]);
  assert.equal(seed.totals[0].total, 2);
  assert.equal(seed.entryCount, 1);
});

test("MUSTANDID tulevad kaasa, aga MÄRGITUNA", () => {
  /* Narratiivi kirjutatakse sageli enne kuu kinnitamist ja kirjutaja peab
     teadma, mis on veel kinnitamata — muidu võib lugu kuu lõpuks mitte enam
     kehtida. */
  const seed = buildNarrativeSeed([entry(), entry({ status: ENTRY_STATUS.DRAFT })]);
  assert.equal(seed.draftCount, 1);
  assert.equal(seed.hasUnconfirmed, true);
});

test("PÄRITOLU EI KAO koondamisel", () => {
  /* „Ta ütles, et ei saa hakkama" ja „mulle tundus, et ta ei saa hakkama" ei
     tohi muutuda samaks lauseks — see vahe ONGI aruande väärtus. */
  const seed = buildNarrativeSeed([
    entry({ note: "ei saa hakkama", noteProvenance: PROVENANCE.KLIENDI_OELDUD }),
    entry({ note: "tundus väsinud", noteProvenance: PROVENANCE.TOOTAJA_TOLGENDUS })
  ]);
  assert.equal(seed.notes.length, 2);
  assert.equal(seed.notes[0].provenance, PROVENANCE.KLIENDI_OELDUD);
  assert.equal(seed.notes[1].provenance, PROVENANCE.TOOTAJA_TOLGENDUS);
});

test("märkimata päritolu ei muutu kliendi öelduks", () => {
  // Vaikeväärtus on TÖÖTAJA TÄHELEPANEK: masin ei tohi panna sõnu kliendi suhu.
  const seed = buildNarrativeSeed([entry({ note: "käisime poes" })]);
  assert.equal(seed.notes[0].provenance, PROVENANCE.TOOTAJA_TAHELEPANEK);
  assert.notEqual(seed.notes[0].provenance, PROVENANCE.KLIENDI_OELDUD);
});

test("tegevused loetakse kokku ja järjestatakse sageduse järgi", () => {
  const seed = buildNarrativeSeed([
    entry({ activities: ["saatmine", "asjaajamine"] }),
    entry({ activities: ["saatmine"] })
  ]);
  assert.equal(seed.activities[0].name, "saatmine");
  assert.equal(seed.activities[0].count, 2);
});

test("eesmärgid tulevad SUUNAMISEST, mitte kirjetest", () => {
  // Ilma eesmärkideta ei ole narratiivil tuge ja „edenemine" muutub arvamuseks.
  const seed = buildNarrativeSeed([entry()], {
    referral: { id: "ref-1", goalsText: "Iseseisev asjaajamine" }
  });
  assert.equal(seed.goalsText, "Iseseisev asjaajamine");
  assert.equal(seed.referralId, "ref-1");
});

test("koond EI OLE AI väljund ja ei väida seda", () => {
  /* Deterministlik koond ei kanna `AI_MUSTAND` märget: ta ei leiuta midagi.
     Kui AI-mustand hiljem lisandub, on ta eraldi väli eraldi märkega. */
  const seed = buildNarrativeSeed([entry({ note: "x" })]);
  assert.equal(seed.generatedBy, "deterministic_summary");
  assert.equal(JSON.stringify(seed).includes(PROVENANCE.AI_MUSTAND), false);
});

test("periood tuletatakse kirjete kuupäevadest", () => {
  const seed = buildNarrativeSeed([entry({ date: "2026-08-20" }), entry({ date: "2026-08-03" })]);
  assert.equal(seed.periodFrom, "2026-08-03");
  assert.equal(seed.periodTo, "2026-08-20");
});

test("ettepanek on kolm väärtust, mitte vabatekst", () => {
  assert.deepEqual([...NARRATIVE_PROPOSALS], ["CONTINUE", "CHANGE_VOLUME", "END"]);
  assert.equal(isNarrativeProposal("CONTINUE"), true);
  assert.equal(isNarrativeProposal("midagi muud"), false);
});

test("tühi sisend ei kuku", () => {
  const seed = buildNarrativeSeed([]);
  assert.equal(seed.entryCount, 0);
  assert.deepEqual(seed.notes, []);
  assert.equal(seed.periodFrom, null);
});
