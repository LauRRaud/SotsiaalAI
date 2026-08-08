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

import { getDashboardInfoContent } from "../../lib/dashboardInfoContent.js";
import { PROVENANCES } from "../../lib/workspaces/provenance.js";

const UI_FILES = [
  "../../components/casework/CaseWorkShell.jsx",
  "../../components/casework/CaseWorkDetail.jsx",
  "../../components/casework/caseWorkClient.js",
  "../../app/juhtumid/page.jsx",
  /* ⓘ juhend on osa pinnast: tema tekstid peavad olema kolmes keeles täpselt
     samamoodi nagu nuppude omad. */
  "../../lib/dashboardInfoContent.js"
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

test("pinnal on ⓘ juhend ja kiirmenüü kirje — pind ei ole kättesaadav ainult URL-i kaudu", async () => {
  /* Kaks eri auku, mõlemad on platvormil varem juhtunud: pind ilma ⓘ-ta (info
     puudub just seal, kus piirid on kõige olulisemad) ja pind ilma kiirmenüü
     kirjeta (Teenuspäeviku ja `/org` muster — pind olemas, aga sinna sai ainult
     URL-i käsitsi kirjutades). */
  const shell = await readCode("../../components/casework/CaseWorkShell.jsx");
  assert.match(shell, /usePanelInfoSlot\(\{ infoId: "casework" \}\)/, "ⓘ juhendit ei registreerita");

  const dock = await readCode("../../components/room/RoomStage.jsx");
  assert.match(dock, /isCaseWorkUiEnabled\(\)/, "kiirmenüü kirje ei ole lipu taga");
  assert.match(dock, /key: "juhtumid".*href: "\/juhtumid"/, "kiirmenüü kirje puudub");
  /* Roll on kirje tingimus: klient ja admin ei tohi näha ust, mille taga API
     neile 403 vastab. */
  assert.match(dock, /key: "juhtumid", zone: "juhtum", roles: SPECIALIST/);
});

test("ⓘ juhend on olemas, tõlgitud ja katab juhtumi piirid", async () => {
  const messages = await readMessages("et");
  /* `t` nagu päris rakenduses: võtme puudumine annaks tagasi võtme enda ja
     just see paistaks ⓘ-s välja „casework.info.…" reana. */
  const t = (key, fallback) => {
    let current = messages;
    for (const part of String(key).split(".")) {
      if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return fallback ?? key;
      current = current[part];
    }
    return typeof current === "string" ? current : (fallback ?? key);
  };

  const info = getDashboardInfoContent(t, "casework");
  assert.ok(info, "juhendit ei ole registris");
  assert.equal(info.title, "Minu juhtumid");
  assert.equal(info.details.length, 7, "juhend peab katma kõik seitse osa");

  /* AINULT LAHENDATUD VÄLJAD. `resolveDetail` jätab `titleKey`/`itemKeys` ka
     vastusesse alles, seega tervest objektist otsimine leiaks võtmed ka siis,
     kui tõlge on täiesti korras — ja test läheks punaseks põhjusel, millel
     kasutajaga pole pistmist. */
  const rendered = [
    info.title,
    ...info.details.flatMap((section) => [section.title, section.body, ...(section.items || [])])
  ]
    .filter(Boolean)
    .join("\n");
  assert.doesNotMatch(rendered, /casework\.info\./, "ⓘ-s on tõlkimata võti");

  /* KOLM PIIRI, mida kasutaja ei tohi ise avastama pidada. Kui keegi juhendit
     lühendab, peavad just need üle jääma. */
  assert.match(rendered, /STAR/);
  assert.match(rendered, /Tagasiteed ei ole/);
  assert.match(rendered, /rangelt isiklik/);
});

test("kliendiviite kustutamine jääb alles ka kirjutuskaitstud juhtumis (L17)", async () => {
  const detail = await read("../../components/casework/CaseWorkDetail.jsx");
  /* Kõik ülejäänud kirjutusnupud on `writeDisabled` taga (= ka retention-seis),
     kustutus AINULT `busy` taga: andmesubjekti õigus ei tohi jääda
     retention-oleku taha kinni. */
  /* Kuju muutus 08.08 (omaniku seitsmes audit): kustutus käib nüüd
     kaheastmelise `ConfirmButton`-i kaudu, sest ta on selle vaate kõige
     pöördumatum tegu. INVARIANT ON SAMA ja seda kontrollitakse edasi: takistus
     on AINULT `busy`, mitte `writeDisabled` — muidu jääks andmesubjekti õigus
     retention-oleku taha kinni. */
  assert.match(detail, /<ConfirmButton[\s\S]{0,400}disabled=\{busy\}[\s\S]{0,120}onConfirm=\{eraseClientReference\}/);
  assert.doesNotMatch(detail, /disabled=\{writeDisabled\}[\s\S]{0,120}onConfirm=\{eraseClientReference\}/);
  assert.match(detail, /const writeDisabled = busy \|\| !isActive;/);
});
