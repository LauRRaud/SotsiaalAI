/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — pinna leping.
 *
 * KATE, MITTE PARITEET. `npm run i18n:check` ütleb, et kolmes failis on samad
 * võtmed — ta EI ütle, kas pinnal kasutatud võti üldse kuskil olemas on (T24
 * õppetund: välitöö pind läks liidesesse puuduvate võtmetega ja check oli
 * roheline). Siin loetakse võtmed KOODIST välja ja otsitakse üles kõigist
 * kolmest sõnastikust.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { PROVENANCES } from "../../lib/workspaces/provenance.js";

const UI_FILES = [
  "../../components/casework/CaseWorkShell.jsx",
  "../../components/casework/CaseWorkDetail.jsx",
  "../../components/casework/caseWorkClient.js",
  "../../app/juhtumid/page.jsx"
];

/* Teenuskihi veavõtmed jõuavad kasutajani pinna kaudu (`t(messageKey)`), seega
   nende puudumine sõnastikust on sama viga kui pinnal endal. */
const SERVICE_FILES = [
  "../../lib/casework/errors.js",
  "../../lib/casework/caseWorkAssist.js",
  "../../lib/casework/caseWorkItem.js",
  "../../lib/casework/caseWorkMissingInfo.js",
  "../../lib/casework/routes.js"
];

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

/**
 * Kommentaarideta kuju.
 *
 * MIKS: need failid SELETAVAD, miks nad `dangerouslySetInnerHTML`-i ega
 * teenuskihti ei kasuta — ja toores tekstiotsing loeks selgituse kasutuseks.
 * Test, mis läheb punaseks õige põhjenduse peale, õpetab põhjendusi kustutama.
 */
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

async function collectKeys(files) {
  const keys = new Set();
  for (const file of files) {
    const source = await read(file);
    for (const match of source.matchAll(/"(casework\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }
  return keys;
}

test("pinna ja teenuskihi tõlkevõtmed on olemas KÕIGIS kolmes keeles", async () => {
  const keys = new Set([...(await collectKeys(UI_FILES)), ...(await collectKeys(SERVICE_FILES))]);
  /* Päritolusildid tulevad `provenanceLabelKey()`-st mallina, seega neid ei ole
     üheski failis literaalina — aga just nemad on need, mis puuduva info
     loendis igal real kuvatakse. */
  for (const value of PROVENANCES) keys.add(`casework.provenance.${value}`);

  assert.ok(keys.size > 40, `oodatud vähemalt 40 võtit, leiti ${keys.size}`);

  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of keys) {
      const value = lookup(messages, key);
      assert.equal(typeof value, "string", `${locale}: võti puudub või ei ole tekst — ${key}`);
      assert.ok(value.trim().length > 0, `${locale}: tühi tekst — ${key}`);
    }
  }
});

test("juhtumi tekstiväljad renderdatakse tekstina, mitte märgistusena (testileping 38)", async () => {
  /* `text` ja `clientDisplayName` on plain text ja neid EI puhastata: puhastus
     tekitaks illusiooni, et väljund on ohutu ka siis, kui keegi ta kunagi
     `dangerouslySetInnerHTML`-i paneb. Ainus tõeline kaitse on see, et seda
     kohta ei ole — ja just seda kontrollitakse siin. */
  for (const file of UI_FILES) {
    const source = await readCode(file);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${file}: HTML-i sisestus pinnal`);
  }
});

test("pind ei impordi serveri teenuskihti kliendipaketti", async () => {
  /* `lib/casework/caseWorkAssist.js` toob endaga Prisma kliendi. Kliendipaketti
     imporditud teenuskiht kas lõhuks build'i või — hullem — tõmbaks brauserisse
     mooduli, mis on kirjutatud eeldusel, et ta jookseb serveris. */
  for (const file of ["../../components/casework/CaseWorkShell.jsx", "../../components/casework/CaseWorkDetail.jsx"]) {
    const source = await readCode(file);
    assert.doesNotMatch(source, /lib\/casework\/caseWork/, `${file}: teenuskiht kliendipaketis`);
    assert.doesNotMatch(source, /lib\/prisma/, `${file}: Prisma kliendipaketis`);
  }
});

test("marsruut on värava taga MÕLEMAS kohas — lehel ja metaandmetes (L19)", async () => {
  const source = await read("../../app/juhtumid/page.jsx");
  assert.match(source, /if \(!isCaseWorkEnabled\(\)\) notFound\(\);/, "lehe värav puudub");
  /* `generateMetadata` jookseb lehest SÕLTUMATULT: ilma oma haruta annaks leht
     404-sisu, aga brauseri tiitliks jääks „Minu juhtumid" ja pinna nimi lekiks
     täpselt sellele, kelle eest ta peaks olema nähtamatu. */
  assert.match(source, /if \(!isCaseWorkEnabled\(\)\) \{[\s\S]*title: "404"/, "metaandmete värav puudub");
  /* UI-lipp tohib ainult PEITA navigatsiooni. Kui leht ise sõltuks temast,
     avaneks pind build-aegse väärtuse, mitte serveri tõe järgi. */
  assert.doesNotMatch(source, /isCaseWorkUiEnabled/, "leht ei tohi sõltuda UI-lipust");
});

test("pind ei loo juhtumit automaatselt ega paku kustutust (L8, L16)", async () => {
  const shell = await read("../../components/casework/CaseWorkShell.jsx");
  const detail = await read("../../components/casework/CaseWorkDetail.jsx");
  /* L8: juhtumi loob alati inimene — loomine tohib käia ainult vormi
     saatmisest, mitte laadimise kõrvalmõjuna. */
  assert.match(shell, /onSubmit=\{createCase\}/);
  /* L16: juhtumi kustutamist ei ole ka liideses. Nupp, mis kutsuks
     `DELETE /cases/<id>`, tähendaks marsruuti, mida ei ole. */
  for (const source of [shell, detail]) {
    assert.doesNotMatch(source, /caseWorkRequest\(`\/cases\/\$\{encodeURIComponent\(caseId\)\}`,\s*\{\s*method: "DELETE"/);
  }
});

test("kliendiviite kustutamine jääb alles ka kirjutuskaitstud juhtumis (L17)", async () => {
  const detail = await read("../../components/casework/CaseWorkDetail.jsx");
  /* Kõik ülejäänud kirjutusnupud on `writeDisabled` taga (= ka retention-seis),
     kustutus AINULT `busy` taga: andmesubjekti õigus ei tohi jääda
     retention-oleku taha kinni. */
  assert.match(detail, /disabled=\{busy\} onClick=\{eraseClientReference\}/);
  assert.match(detail, /const writeDisabled = busy \|\| !isActive;/);
});
