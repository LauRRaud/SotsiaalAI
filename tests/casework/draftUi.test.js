/**
 * JTA-V1 (E5) — mustandi pinna leping.
 *
 * KAKS AUKU, MIDA `i18n:check` EI NÄE: pinnal kasutatud võti, mida sõnastikus ei
 * ole, ja kahe loendi vaikne lahkuminek. Kolmas on E5-le eriline: liides võib
 * pakkuda siiret, mida olekumasin ei luba — ja siis on nupp, mis alati vea annab.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { STAR2_TRANSFER_STATES, STAR2_TRANSFER_TRANSITIONS } from "../../lib/workspaces/provenance.js";
import { DRAFT_TYPES } from "../../lib/casework/caseWorkDraft.js";

const UI = "../../components/casework/DraftSection.jsx";

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

async function readCode(relative) {
  return (await read(relative)).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

async function readMessages(locale) {
  return JSON.parse(await readFile(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
}

function lookup(dictionary, key) {
  let current = dictionary;
  for (const part of key.split(".")) {
    if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return undefined;
    current = current[part];
  }
  return current;
}

test("pinna elemendiloend on BAIT-TÄPSELT teenuskihi oma", async () => {
  const source = await read(UI);
  const block = source.match(/DRAFT_TYPE_ORDER = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(block, "pinnal ei ole `DRAFT_TYPE_ORDER` konstanti");
  const order = [...block[1].matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(order, [...DRAFT_TYPES]);
});

test("liides pakub AINULT neid siirdeid, mida olekumasin lubab — MIINUS ULE_KANTUD", async () => {
  /* KAKS AUKU KORRAGA. Liiga lai loend annaks nupu, mis alati vea annab ja
     õpetab kasutajat arvama, et viga on tema tehtud. Ja kui `ULE_KANTUD` sinna
     satub, läheb mustand lõppseisu ILMA auditireata (L19). */
  const source = await read(UI);
  const block = source.match(/ALLOWED_TRANSITIONS = Object\.freeze\(\{([\s\S]*?)\n\}\)/);
  assert.ok(block, "pinnal ei ole `ALLOWED_TRANSITIONS` kaarti");

  const ui = {};
  for (const row of block[1].matchAll(/([A-Z_]+): Object\.freeze\(\[([^\]]*)\]\)/g)) {
    ui[row[1]] = [...row[2].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
  }

  assert.deepEqual(Object.keys(ui).sort(), [...STAR2_TRANSFER_STATES].sort(), "kaart ei kata kõiki seise");

  for (const state of STAR2_TRANSFER_STATES) {
    const expected = STAR2_TRANSFER_TRANSITIONS[state].filter((value) => value !== "ULE_KANTUD");
    assert.deepEqual(ui[state], expected, `${state}: liidese siirded ei vasta olekumasinale`);
  }

  /* Ja `ULE_KANTUD` ei tohi ühestki loendist läbi lipsata. */
  assert.equal(Object.values(ui).flat().includes("ULE_KANTUD"), false, "liides pakub ULE_KANTUD siiret");
});

test("mustandi tõlkevõtmed on olemas KÕIGIS kolmes keeles", async () => {
  const keys = new Set();
  const source = await read(UI);
  for (const match of source.matchAll(/"(casework\.(?:draft|star2)\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  for (const type of DRAFT_TYPES) keys.add(`casework.draft.type_${type}`);
  for (const state of STAR2_TRANSFER_STATES) keys.add(`casework.star2.${state}`);
  for (const kind of ["KLIENDIGA", "DOKUMENDIGA"]) keys.add(`casework.star2.${kind}`);

  assert.ok(keys.size >= 25, `oodatud vähemalt 25 võtit, leiti ${keys.size}`);

  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of keys) {
      const value = lookup(messages, key);
      assert.equal(typeof value, "string", `${locale}: võti puudub — ${key}`);
      assert.ok(value.trim().length > 0, `${locale}: tühi tekst — ${key}`);
    }
  }
});

test("teenuskihi veavõtmed on tõlgitud", async () => {
  for (const name of ["caseWorkDraft.js", "draftTransition.js"]) {
    const service = await read(`../../lib/casework/${name}`);
    const keys = [...service.matchAll(/"(casework\.errors\.[A-Za-z0-9_]+)"/g)].map((m) => m[1]);
    assert.ok(keys.length >= 2, `${name}: veavõtmeid ei leitud`);
    for (const locale of ["et", "en", "ru"]) {
      const messages = await readMessages(locale);
      for (const key of keys) {
        assert.equal(typeof lookup(messages, key), "string", `${locale}: veavõti puudub — ${key}`);
      }
    }
  }
});

test("mustandi tekst renderdatakse tekstina ja pind ei impordi teenuskihti", async () => {
  const source = await readCode(UI);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML/, "HTML-i sisestus pinnal");
  assert.doesNotMatch(source, /lib\/casework\//, "teenuskiht kliendipaketis");
  assert.doesNotMatch(source, /lib\/prisma/, "Prisma kliendipaketis");
});

test("pind austab seitsmenda auditi reegleid ka siin", async () => {
  /* Uus sektsioon ei tohi tuua tagasi seda, mis just parandati. */
  const source = await readCode(UI);
  assert.match(source, /<DraftEditor\s+key=\{openDraft\.id\}/, "editoril puudub `key`");
  assert.match(source, /requestedDraftId = useRef/, "võistlusvalvur puudub");
  assert.doesNotMatch(source, /useState\(PROVENANCE\.[A-Z_]+\)/, "päritolul on vaikeväärtus");
  assert.match(source, /provenance_required/, "päritolu valikut ei nõuta");
  assert.match(source, /if \(saved\) \{/, "väli tühjendatakse tingimusteta");
  assert.match(source, /draftsCursor/, "cursor'it ei hoita");
  assert.match(source, /<ConfirmButton/, "pöördumatu tegu ei küsi üle");
});

test("mustandi sektsioon on juhtumi detailvaates monteeritud", async () => {
  const detail = await read("../../components/casework/CaseWorkDetail.jsx");
  assert.match(detail, /import DraftSection from "\.\/DraftSection";/, "import puudub");
  assert.match(detail, /<DraftSection caseId=\{caseId\}/, "sektsiooni ei renderdata");
  assert.match(detail, /writeDisabled=\{writeDisabled\}/, "kirjutuskaitse ei jõua sektsioonini");
});
