/**
 * JTA-V1 (E4) — märkme pinna leping.
 *
 * KAKS AUKU, MIDA `i18n:check` EI NÄE: pinnal kasutatud võti, mida sõnastikus
 * ei ole (check vaatab ainult kolme faili PARITEETI), ja kahe kihiloendi vaikne
 * lahkuminek. Mõlemad on siin.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { NOTE_LAYERS } from "../../lib/casework/caseWorkMeetingNote.js";

const UI_FILES = ["../../components/casework/MeetingNoteSection.jsx"];

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

/** Kommentaarideta kuju — fail SELETAB, miks ta teatud asju ei tee. */
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

test("pinna kihiloend on BAIT-TÄPSELT teenuskihi oma", async () => {
  /* Pind ei tohi importida `caseWorkMeetingNote.js`-i (ta toob Prisma kliendi),
     seega loend on seal oma konstandina. Kaks loendit ilma testita lähevad
     lahku — ja siis kaob pinnalt kiht, mille server saadab. */
  const source = await read("../../components/casework/MeetingNoteSection.jsx");
  const block = source.match(/NOTE_LAYER_ORDER = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(block, "pinnal ei ole `NOTE_LAYER_ORDER` konstanti");

  const order = [...block[1].matchAll(/"([A-Z0-9_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(order, [...NOTE_LAYERS]);
});

test("kaheksa kihti on pinnal KAHEKSA ERALDI PLOKKI, mitte üks loend siltidega", async () => {
  /* Kui kliendi enda sõnad ja töötaja tõlgendus seisavad ühes voos, loeb inimene
     neid ühe tekstina ka siis, kui igal real on silt küljes. Eraldi plokk sunnib
     kirjutamise hetkel valima, KUHU rida käib. */
  const source = await readCode("../../components/casework/MeetingNoteSection.jsx");
  assert.match(source, /NOTE_LAYER_ORDER\.map\(/, "kihte ei renderdata eraldi plokkidena");
  assert.match(source, /entries\.filter\(\(entry\) => entry\.layer === layer\)/, "kirjed ei ole kihi kaupa jaotatud");
});

test("märkme tõlkevõtmed on olemas KÕIGIS kolmes keeles", async () => {
  const keys = new Set();
  for (const file of UI_FILES) {
    const source = await read(file);
    for (const match of source.matchAll(/"(casework\.note\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  /* Mallist ehitatud kihisildid — neid ei ole üheski failis literaalina, aga
     just nemad on kaheksa ploki pealkirjad. */
  for (const layer of NOTE_LAYERS) keys.add(`casework.note.layer_${layer}`);

  assert.ok(keys.size >= 20, `oodatud vähemalt 20 võtit, leiti ${keys.size}`);

  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of keys) {
      const value = lookup(messages, key);
      assert.equal(typeof value, "string", `${locale}: võti puudub või ei ole tekst — ${key}`);
      assert.ok(value.trim().length > 0, `${locale}: tühi tekst — ${key}`);
    }
  }
});

test("teenuskihi veavõtmed jõuavad kasutajani ja on tõlgitud", async () => {
  const service = await read("../../lib/casework/caseWorkMeetingNote.js");
  const keys = [...service.matchAll(/"(casework\.errors\.[A-Za-z0-9_]+)"/g)].map((match) => match[1]);
  assert.ok(keys.length >= 3, "teenuskihist ei leitud veavõtmeid");

  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of keys) {
      assert.equal(typeof lookup(messages, key), "string", `${locale}: veavõti puudub — ${key}`);
    }
  }
});

test("märkme tekst renderdatakse tekstina, mitte märgistusena", async () => {
  for (const file of UI_FILES) {
    const source = await readCode(file);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${file}: HTML-i sisestus pinnal`);
  }
});

test("pind ei impordi serveri teenuskihti kliendipaketti", async () => {
  const source = await readCode("../../components/casework/MeetingNoteSection.jsx");
  assert.doesNotMatch(source, /lib\/casework\/caseWork/, "teenuskiht kliendipaketis");
  assert.doesNotMatch(source, /lib\/prisma/, "Prisma kliendipaketis");
});

test("liides ei paku märkme kustutust ega kihi ümbernimetamist", async () => {
  const source = await readCode("../../components/casework/MeetingNoteSection.jsx");
  /* Server keeldub mõlemast, aga liides ei tohi pakkuda nuppu, mis alati vea
     annab — see õpetab inimest arvama, et viga on tema tehtud. */
  assert.doesNotMatch(source, /method: "DELETE"[\s\S]{0,120}meeting-notes\/\$\{encodeURIComponent\(\w+\)\}`/,
    "liides pakub märkme kustutust");
  assert.doesNotMatch(source, /layer:\s*\w+\s*\}\s*\)[\s\S]{0,40}method: "PATCH"/, "liides pakub kihi vahetust");
});

test("märkme sektsioon on juhtumi detailvaates monteeritud", async () => {
  /* Sama auk mis Teenuspäevikul ja laual: komponent valmis, aga mitte kuskil
     kasutusel — sinna ei saa siis üldse. */
  const detail = await read("../../components/casework/CaseWorkDetail.jsx");
  assert.match(detail, /import MeetingNoteSection from "\.\/MeetingNoteSection";/, "import puudub");
  assert.match(detail, /<MeetingNoteSection caseId=\{caseId\}/, "sektsiooni ei renderdata");
  assert.match(detail, /writeDisabled=\{writeDisabled\}/, "kirjutuskaitse ei jõua sektsioonini");
});
