/**
 * JTA-V1 (E2) — laua pinna leping.
 *
 * KATE, MITTE PARITEET. `npm run i18n:check` ütleb, et kolmes failis on samad
 * võtmed — ta EI ütle, kas pinnal kasutatud võti üldse kuskil olemas on. Laual
 * on lisaks kaks võtmeperet, mis EI ESINE koodis literaalina (`section_*` ja
 * `seed_status_*` ehitatakse mallist), seega neid ei leia ka tekstiotsing —
 * nemad on siin nimeliselt loetletud.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getDashboardInfoContent } from "../../lib/dashboardInfoContent.js";
import { WORKBENCH_SECTIONS } from "../../lib/casework/workbench.js";
import { createWorkspaceDashboardRows } from "../../lib/workspaceDashboardCards.js";

const UI_FILES = [
  "../../components/casework/CaseWorkbenchShell.jsx",
  "../../app/toolaud/juhtumitoo/page.jsx",
  "../../lib/dashboardInfoContent.js"
];

/** `TopicSeedStatus` viis väärtust — sõnastik sünnib E2-s (mujal teda ei ole). */
const SEED_STATUSES = ["DRAFT", "WAITING", "IN_COVISION", "FOLLOW_UP", "CLOSED"];

const FLAG = "NEXT_PUBLIC_CASEWORK_V1_ENABLED";

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

/**
 * Kommentaarideta kuju — need failid SELETAVAD, miks nad
 * `dangerouslySetInnerHTML`-i ega teenuskihti ei kasuta, ja toores tekstiotsing
 * loeks selgituse kasutuseks. Test, mis läheb punaseks õige põhjenduse peale,
 * õpetab põhjendusi kustutama.
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

async function withFlag(value, run) {
  const previous = process.env[FLAG];
  if (value === undefined) delete process.env[FLAG];
  else process.env[FLAG] = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

test("pinna sektsioonide järjekord on BAIT-TÄPSELT koondlugeja oma (L12)", async () => {
  /* Pind ei tohi importida `lib/casework/workbench.js`-i (ta toob Prisma
     kliendi), seega järjekord on seal oma konstandina. Kaks loendit ilma
     testita lähevad lahku — ja siis kaob laualt sektsioon, mille server
     saadab, ilma et keegi seda märkaks.

     LOETAKSE TEKSTIST, mitte impordist: testijooksja ei teisenda JSX-i, seega
     komponenti ei saa siin importida. */
  const source = await read("../../components/casework/CaseWorkbenchShell.jsx");
  const block = source.match(/WORKBENCH_SECTION_ORDER = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert.ok(block, "pinnal ei ole `WORKBENCH_SECTION_ORDER` konstanti");

  const order = [...block[1].matchAll(/"([A-Za-z0-9_]+)"/g)].map((match) => match[1]);
  assert.deepEqual(order, [...WORKBENCH_SECTIONS]);
});

test("laua tõlkevõtmed on olemas KÕIGIS kolmes keeles", async () => {
  const keys = new Set();
  for (const file of UI_FILES) {
    const source = await read(file);
    for (const match of source.matchAll(/"(casework\.workbench\.[A-Za-z0-9_.]+)"/g)) keys.add(match[1]);
  }

  /* Mallist ehitatud võtmed: neid ei ole üheski failis literaalina, aga just
     nemad on need, mis igal real ja iga sektsiooni pealkirjas kuvatakse. */
  for (const section of WORKBENCH_SECTIONS) keys.add(`casework.workbench.section_${section}`);
  for (const status of SEED_STATUSES) keys.add(`casework.workbench.seed_status_${status}`);

  /* Koondlugeja `notice`-võtmed tulevad SERVERIST ja pind ainult tõlgib nad.
     E1 saatis neid välja juba enne, kui sõnastikus rida oli — pind oli siis
     ainus koht, kus see paistnuks, ja pinda ei olnud. */
  keys.add("casework.workbench.preparations_not_yet");
  keys.add("casework.workbench.network_worker_only");

  keys.add("casework.workbench.card_meta");
  keys.add("casework.workbench.meta.title");
  keys.add("casework.workbench.meta.description");

  assert.ok(keys.size > 35, `oodatud vähemalt 35 võtit, leiti ${keys.size}`);

  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of keys) {
      const value = lookup(messages, key);
      assert.equal(typeof value, "string", `${locale}: võti puudub või ei ole tekst — ${key}`);
      assert.ok(value.trim().length > 0, `${locale}: tühi tekst — ${key}`);
    }
  }
});

test("koondlugeja `notice`-võtmed on kõik sõnastikus (E2 testileping)", async () => {
  /* Loetakse KOONDLUGEJA KOODIST, mitte nimekirjast: kui E3 lisab uue
     `notice`-i, peab see test punaseks minema ilma, et keegi teda uuendaks. */
  const reader = await read("../../lib/casework/workbench.js");
  const notices = [...reader.matchAll(/"(casework\.workbench\.[A-Za-z0-9_]+)"/g)].map((match) => match[1]);
  assert.ok(notices.length >= 2, "koondlugejast ei leitud ühtegi notice-võtit");

  for (const locale of ["et", "en", "ru"]) {
    const messages = await readMessages(locale);
    for (const key of notices) {
      assert.equal(typeof lookup(messages, key), "string", `${locale}: notice-võti puudub — ${key}`);
    }
  }
});

test("laua tekstiväljad renderdatakse tekstina, mitte märgistusena", async () => {
  /* Puuduva info punkti `text` ja teemaseemne `title` on kasutaja enda sisu ja
     nad jõuavad lauale toorelt. Ainus tõeline kaitse on see, et HTML-i
     sisestuse kohta ei ole — puhastus tekitaks illusiooni, et väljund on ohutu
     ka siis, kui keegi ta kunagi `dangerouslySetInnerHTML`-i paneb. */
  for (const file of UI_FILES) {
    const source = await readCode(file);
    assert.doesNotMatch(source, /dangerouslySetInnerHTML/, `${file}: HTML-i sisestus pinnal`);
  }
});

test("pind ei impordi serveri teenuskihti kliendipaketti", async () => {
  const source = await readCode("../../components/casework/CaseWorkbenchShell.jsx");
  assert.doesNotMatch(source, /lib\/casework\/workbench/, "koondlugeja kliendipaketis");
  assert.doesNotMatch(source, /lib\/casework\/caseWork/, "teenuskiht kliendipaketis");
  assert.doesNotMatch(source, /lib\/prisma/, "Prisma kliendipaketis");
});

test("K1 tööruumi pealkiri tõlgitakse, mitte ei kuvata võtmena", async () => {
  /* BRAUSERI LÄBISÕIDU LEID 08.08. Sisuta tööruumi adapter (eelpöördumine,
     meetodipeegel) paneb `title`-ks TÕLKEVÕTME, sest pealkiri ei tohi kanda
     kliendi sisu — nimega tööruum paneb sinna teksti. Pind kuvas võtme toorelt
     ja laual seisis „workspace.kind.pre_inquiry". Ükski roheline test ei
     näinud seda: kuju oli õige, tähendus mitte. */
  const source = await readCode("../../components/casework/CaseWorkbenchShell.jsx");
  assert.match(source, /t\(row\.title, row\.title\)/, "K1 pealkirja ei tõlgita");
});

test("K1 rida viib PÄRIS marsruudile, mitte liigist tuletatud aadressile", async () => {
  /* Sama läbisõidu teine leid: `/vestlus?workspace=${ref.kind}` andis katkise
     lingi, sest tööruumi liik (`pre_inquiry`) ja töölaua võti (`pre_inquiries`)
     ei ole sama string. Tuletatud aadress on alati üks ümbernimetamine eemal
     katkiminekust — seepärast on kaart nimeline ja tema sihid kontrollitakse. */
  /* KOMMENTAARIDETA KUJU: fail SELETAB, miks tuletamine vale oli, ja toores
     tekstiotsing loeks selgituse kasutuseks. */
  const source = await readCode("../../components/casework/CaseWorkbenchShell.jsx");
  assert.doesNotMatch(source, /workspace=\$\{/, "aadress tuletatakse tööruumi liigist");

  assert.match(source, /WORKSPACE_ROUTES = Object\.freeze/, "tööruumi marsruudikaart puudub");

  /* KÕIK pinna sihid, mitte ainult kaardi omad: laual on lisaks `/juhtumid`,
     `/eelpoordumised` ja `/teemaseemned`, ja neist igaüks on samamoodi üks
     ümbernimetamine katkiminekust eemal.

     Otsitakse `href`-i ja marsruudikaardi järgi, MITTE iga kaldkriipsuga
     stringi järgi: API tee (`"/workbench"`) ei ole leht ja tema otsimine
     `app/`-st annaks vale punase. */
  const targets = new Set([
    ...[...source.matchAll(/href=(?:"|\{`)(\/[a-z0-9-]+(?:\/[a-z0-9-]+)*)/g)].map((match) => match[1]),
    ...[...(source.match(/WORKSPACE_ROUTES = Object\.freeze\(\{[\s\S]*?\}\)/) || [""])[0].matchAll(/"(\/[a-z0-9/-]+)"/g)].map(
      (match) => match[1]
    )
  ]);
  assert.ok(targets.size >= 4, `oodatud vähemalt 4 sihti, leiti ${targets.size}`);

  for (const route of targets) {
    /* Siht peab olema päris leht. Katkine link on halvem kui puuduv: ta lubab
       teed, mida ei ole. */
    const page = new URL(`../../app${route}/page.jsx`, import.meta.url);
    await assert.doesNotReject(readFile(page, "utf8"), `marsruuti ei ole olemas: ${route}`);
  }
});

test("laud EI kirjuta — pinnal ei ole ühtegi mutatsiooni (L1)", async () => {
  const source = await readCode("../../components/casework/CaseWorkbenchShell.jsx");
  /* Laud on lugeja. Esimene koht, kust kirjutus märkamatult tekiks, on
     „märgi tehtuks" nupp otse laual — ja siis oleks laual oma tõde. */
  assert.doesNotMatch(source, /method:\s*"(POST|PATCH|PUT|DELETE)"/, "laual on kirjutav päring");
});

test("laud ei loenda töötajat (L3)", async () => {
  const source = await readCode("../../components/casework/CaseWorkbenchShell.jsx");
  /* Koormuse mõõdik tekiks siin kogemata, sest laud juba loeb kõik allikad
     kokku. Sektsioonide ülene summa on selle esimene samm. */
  assert.doesNotMatch(source, /\.reduce\(/, "laual on koondarvutus");
  assert.doesNotMatch(source, /overdue|backlog|mahajää/i, "laual on mahajäämuse mõiste");
});

test("marsruut on värava taga MÕLEMAS kohas — lehel ja metaandmetes (L11)", async () => {
  const source = await read("../../app/toolaud/juhtumitoo/page.jsx");
  assert.match(source, /if \(!isCaseWorkEnabled\(\)\) notFound\(\);/, "lehe värav puudub");
  /* `generateMetadata` jookseb lehest SÕLTUMATULT: ilma oma haruta annaks leht
     404-sisu, aga brauseri tiitliks jääks „Juhtumitöö laud" ja pinna nimi lekiks
     täpselt sellele, kelle eest ta peaks olema nähtamatu. */
  assert.match(source, /if \(!isCaseWorkEnabled\(\)\) \{[\s\S]*title: "404"/, "metaandmete värav puudub");
  /* UI-lipp tohib ainult PEITA navigatsiooni. Kui leht ise sõltuks temast,
     avaneks pind build-aegse väärtuse, mitte serveri tõe järgi. */
  assert.doesNotMatch(source, /isCaseWorkUiEnabled/, "leht ei tohi sõltuda UI-lipust");
});

test("lauale ON tee: töölaua kaart ja kiirmenüü kirje, mõlemad lipu ja rolli taga", async () => {
  /* Sama auk, mis Teenuspäevikul ja `/org`-il: pind olemas, aga sinna sai
     ainult URL-i käsitsi kirjutades. */
  await withFlag("1", () => {
    for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER"]) {
      const rows = createWorkspaceDashboardRows({ activeRole: role, hasPaidAccess: true });
      const card = rows.flat().find((entry) => entry?.key === "casework_workbench");
      assert.ok(card, `${role}: laua kaart puudub`);
      assert.equal(card.route, "/toolaud/juhtumitoo");
    }

    /* Roll on kaardi tingimus: klient ja admin ei tohi näha ust, mille taga API
       neile 403 vastab. */
    for (const role of ["CLIENT", "ADMIN"]) {
      const rows = createWorkspaceDashboardRows({ activeRole: role, hasPaidAccess: true });
      assert.equal(rows.flat().find((entry) => entry?.key === "casework_workbench"), undefined, `${role}: laua kaart lekib`);
    }
  });

  const dock = await readCode("../../components/room/RoomStage.jsx");
  assert.match(dock, /key: "juhtumitoo", zone: "juhtum", roles: SPECIALIST/, "kiirmenüü kirje puudub või on vale rolliga");
  assert.match(dock, /href: "\/toolaud\/juhtumitoo"/, "kiirmenüü kirje ei vii lauale");
});

test("liputa ei ole laua kaarti üheski vaates", async () => {
  for (const value of [undefined, "0"]) {
    await withFlag(value, () => {
      for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER", "CLIENT", "ADMIN"]) {
        const rows = createWorkspaceDashboardRows({ activeRole: role, hasPaidAccess: true });
        assert.equal(rows.flat().find((entry) => entry?.key === "casework_workbench"), undefined, `${role}: kaart ilma liputa`);
      }
    });
  }
});

test("ⓘ juhend on olemas, tõlgitud ja ütleb laua piirid välja", async () => {
  const messages = await readMessages("et");
  const t = (key, fallback) => {
    let current = messages;
    for (const part of String(key).split(".")) {
      if (!current || !Object.prototype.hasOwnProperty.call(current, part)) return fallback ?? key;
      current = current[part];
    }
    return typeof current === "string" ? current : (fallback ?? key);
  };

  const info = getDashboardInfoContent(t, "casework_workbench");
  assert.ok(info, "juhendit ei ole registris");
  assert.equal(info.title, "Juhtumitöö laud");
  assert.equal(info.details.length, 4, "juhend peab katma kõik neli osa");

  /* AINULT LAHENDATUD VÄLJAD — `resolveDetail` jätab `titleKey`/`itemKeys` ka
     vastusesse alles, seega tervest objektist otsimine leiaks võtmed ka siis,
     kui tõlge on täiesti korras. */
  const rendered = [
    info.title,
    ...info.details.flatMap((section) => [section.title, section.body, ...(section.items || [])])
  ]
    .filter(Boolean)
    .join("\n");
  assert.doesNotMatch(rendered, /casework\.workbench\./, "ⓘ-s on tõlkimata võti");

  /* NELI PIIRI, mida kasutaja ei tohi ise avastama pidada. Kui keegi juhendit
     lühendab, peavad just need üle jääma — ja „ei ole koormuse mõõdik" on
     nendest tähtsaim, sest laud on täpselt see koht, kus mõõdik kogemata
     tekiks. */
  assert.match(rendered, /rangelt isiklik/);
  assert.match(rendered, /EI ole koormuse mõõdik/);
  assert.match(rendered, /keegi teine ei näe sinu oma/);
  assert.match(rendered, /AI siin midagi ei otsusta/);

  /* Juhend on kolmes keeles, mitte ainult eesti: ⓘ ei tohi olla see koht, kus
     tõlge lõpeb. */
  for (const locale of ["en", "ru"]) {
    const dictionary = await readMessages(locale);
    for (const detail of info.details) {
      assert.equal(typeof lookup(dictionary, detail.titleKey), "string", `${locale}: ${detail.titleKey}`);
    }
  }
});
