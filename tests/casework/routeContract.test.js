/**
 * JUHTUM-V1 (CASEWORK-P7) E6 — marsruudikihi leping.
 *
 * MIKS TEKSTI, MITTE KÄIVITAMISE PEAL: marsruut impordib `next-auth`-i ja
 * Prisma kliendi, mille laadimine node:test'is tähendaks kas päris andmebaasi
 * või mock'i, mis tõendaks ainult mock'i. Marsruudi vastutus on siin niikuinii
 * struktuurne — kas värav on ees, kas skoop tuleb sessioonist ja kas mõni
 * operatsioon on kogemata olemas. Käitumise tõendab teenuskihi sviit ja päris
 * andmebaasi vastu jooksev sond (`npm run case:probe`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const ROUTES = [
  "cases/route.js",
  "cases/[caseId]/route.js",
  "cases/[caseId]/items/route.js",
  "cases/[caseId]/items/[itemId]/route.js",
  "cases/[caseId]/missing-info/route.js",
  "cases/[caseId]/missing-info/[itemId]/route.js",
  "cases/[caseId]/retention/route.js",
  "cases/[caseId]/client-reference/route.js",
  /* JTA-V1 E2 — laud käib täpselt samast väravast läbi. Ta on siin nimeliselt
     selleks, et ülalolevad ühised reeglid (värav ees, skoop sessioonist, lipu
     lugemine ainult ühes moodulis) kehtiksid ka tema kohta — uus marsruut, mis
     nimekirja ei jõua, on täpselt see, mis muutmisel maha jääb. */
  "workbench/route.js",
  /* JTA-V1 E3 — kohtumise ettevalmistus, seitse marsruuti. */
  "cases/[caseId]/meeting-preps/route.js",
  "cases/[caseId]/meeting-preps/[prepId]/route.js",
  "cases/[caseId]/meeting-preps/[prepId]/fields/route.js",
  "cases/[caseId]/meeting-preps/[prepId]/fields/[fieldKey]/confirm-provenance/route.js",
  "cases/[caseId]/meeting-preps/[prepId]/questions/route.js",
  "cases/[caseId]/meeting-preps/[prepId]/questions/[questionId]/route.js",
  "cases/[caseId]/meeting-preps/[prepId]/questions/[questionId]/confirm-provenance/route.js",
  /* JTA-V1 E4 — kohtumise märge, neli marsruuti. */
  "cases/[caseId]/meeting-notes/route.js",
  "cases/[caseId]/meeting-notes/[noteId]/route.js",
  "cases/[caseId]/meeting-notes/[noteId]/entries/route.js",
  "cases/[caseId]/meeting-notes/[noteId]/entries/[entryId]/route.js",
  /* JTA-V1 E5 — STAR2 mustandi ahel, neli marsruuti. */
  "cases/[caseId]/drafts/route.js",
  "cases/[caseId]/drafts/[draftId]/route.js",
  "cases/[caseId]/drafts/[draftId]/fields/route.js",
  "cases/[caseId]/drafts/[draftId]/transition/route.js",
  /* JTA-V1 E6 — ülekanne, neli marsruuti. `mark-transferred` on OMA marsruut,
     mitte `transition`-i parameeter (L19). */
  "cases/[caseId]/drafts/[draftId]/star2-block/route.js",
  "cases/[caseId]/drafts/[draftId]/copy-events/route.js",
  "cases/[caseId]/drafts/[draftId]/mark-transferred/route.js",
  "cases/[caseId]/transfer-events/route.js"
];

async function readRoute(name) {
  return readFile(new URL(`../../app/api/casework/${name}`, import.meta.url), "utf8");
}

/**
 * Kommentaarideta kuju. Marsruudifailid SELETAVAD, miks nad teatud asju ei tee
 * (nt „`transferState` EI TULE kehast") — toores tekstiotsing loeks selgituse
 * kasutuseks ja test läheks punaseks õige põhjenduse peale.
 */
async function readRouteCode(name) {
  const source = await readRoute(name);
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

async function readLib(name) {
  return readFile(new URL(`../../lib/casework/${name}`, import.meta.url), "utf8");
}

test("iga marsruut käib ühest väravast läbi ja väljub enne mistahes tööd", async () => {
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.match(source, /guardCaseWorkRequest\(request/, `${name}: värav puudub`);
    assert.match(source, /if \(guard\.response\) return guard\.response;/, `${name}: varajane väljumine puudub`);
    /* Iga operatsioon kannab oma piirangunime. Ühine nimi tähendaks, et loendi
       lugemine sööks ära sama kvoodi mis kirjutamine. */
    assert.match(source, /scope: "casework:/, `${name}: päringupiirangu skoop puudub`);
  }
});

test("ükski marsruut ei võta omanikku ega tegijat päringu kehast", async () => {
  /* Kui `ownerUserId` tuleks kehast, saaks igaüks lugeda ja kirjutada kellegi
     teise juhtumeid — omanikupiir (L2) oleks siis ainult soovitus. */
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.doesNotMatch(source, /ownerUserId:\s*body/, `${name}: omanik tuleb kehast`);
    assert.doesNotMatch(source, /actorUserId:\s*body/, `${name}: tegija tuleb kehast`);
    assert.match(source, /guard\.userId/, `${name}: skoop ei tule sessioonist`);
  }
});

test("juhtumi kustutamise API-t EI OLE (L16)", async () => {
  /* Leping ei anna V1-s kustutust ei API-s ega liideses, kuni O-JU-1 on
     otsustatud. Kõige lihtsam koht, kust ta märkamatult tekiks, on juhtumi enda
     marsruut — sinna kirjutatakse `DELETE` „sümmeetria pärast". */
  const detail = await readRoute("cases/[caseId]/route.js");
  assert.doesNotMatch(detail, /export async function DELETE/);

  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.doesNotMatch(source, /caseWorkAssist\.delete/, `${name}: juhtumi kustutus marsruudis`);
  }
  const service = await readLib("caseWorkAssist.js");
  assert.doesNotMatch(service, /caseWorkAssist\.delete/, "teenuskiht: juhtumi kustutus");
});

test("retention-siire elab AINULT oma marsruudil", async () => {
  /* `PATCH /cases/[id]` ei tohi kunagi kirjutuskaitset seada: privilegeeritud
     operatsioon satuks siis sinna, kus muudetakse järgmise kontakti kuupäeva. */
  const detail = await readRoute("cases/[caseId]/route.js");
  assert.doesNotMatch(detail, /retentionState/);
  assert.doesNotMatch(detail, /transitionRetention/);

  const retention = await readRoute("cases/[caseId]/retention/route.js");
  assert.match(retention, /transitionRetention/);
  assert.match(retention, /toState: body\?\.toState/);
  assert.match(retention, /reason: body\?\.reason/);
});

test("puuduva info staatuse marsruut ei võta `resolvedAt`-i kliendilt", async () => {
  /* `resolvedAt` tuleb serverist (E1 invariant). Kliendilt võetuna saaks
     kirjeni kirjutada lahendusaja, mida ei olnud. */
  const source = await readRoute("cases/[caseId]/missing-info/[itemId]/route.js");
  assert.doesNotMatch(source, /resolvedAt:\s*body/);
  assert.match(source, /status: body\?\.status/);
});

test("kliendiviite kustutamine kontrollib omandit ja ei tee `juba kustutatud`-st viga", async () => {
  const source = await readRoute("cases/[caseId]/client-reference/route.js");
  /* Teenusoperatsioon ise on tahtlikult omanikuvaba (teda kutsub ka konto
     kustutamise orkestreerija ilma sessioonita) — seega piiri kontrollib
     marsruut, ja just siin, mitte kuskil hiljem. */
  assert.match(source, /getCaseWorkAssist\(\{ ownerUserId: guard\.userId/);
  assert.match(source, /actorKind: "USER"/);
  assert.match(source, /changed: result\.changed/);
});

test("värav on ENNE autentimist ja annab 404, mitte 403 (L19, testileping 37)", async () => {
  const guard = await readLib("routes.js");
  /* Otsime KUTSEID, mitte nimesid: `getServerSession` esineb ka impordireal ja
     tema järgi mõõtes oleks järjekord alati „vale". */
  const gateIndex = guard.indexOf("if (!isCaseWorkEnabled())");
  const sessionIndex = guard.indexOf("getServerSession(authConfig)");
  assert.ok(gateIndex > 0, "väravakontroll puudub");
  assert.ok(sessionIndex > 0, "sessioonikontroll puudub");
  /* Kui värav oleks pärast autentimist, annaks suletud pind anonüümsele 401 ja
     valele rollile 403 — mõlemad ütlevad „see asi on olemas, ainult sina ei
     pääse ligi". Väljas värav peab olema eristamatu olematust marsruudist. */
  assert.ok(gateIndex < sessionIndex, "värav peab olema enne sessiooni lugemist");
  assert.match(guard, /errorJson\("casework\.errors\.not_found", 404/);
});

test("väravaloogika käib ühest moodulist läbi", async () => {
  /* L19: `CASEWORK_V1_ENABLED` lugemine laiali marsruutides tähendaks, et üks
     neist jääb muutmisel maha — ja just see üks oleks siis lahti. */
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.doesNotMatch(source, /CASEWORK_V1_ENABLED/, `${name}: loeb lippu ise`);
  }
  const guard = await readLib("routes.js");
  assert.match(guard, /import \{ isCaseWorkEnabled \} from "\.\/flags\.js"/);
});

test("marsruudid ei vahemälusta ega jookse serva peal", async () => {
  /* Juhtumi sisu on isikuandmed: `force-dynamic` + `revalidate = 0` hoiavad ta
     vahemälust väljas ja `nodejs` runtime on Prisma eeldus. */
  for (const name of ROUTES) {
    const source = await readRoute(name);
    assert.match(source, /export const runtime = "nodejs";/, `${name}: vale runtime`);
    assert.match(source, /export const dynamic = "force-dynamic";/, `${name}: vahemälustatav`);
    assert.match(source, /export const revalidate = 0;/, `${name}: revalidate puudub`);
  }
});

test("loendid on pagineeritud ja cursor tuleb päringust", async () => {
  /* Pagineerimine on JUHTUM-V1 oma loenditel kohustuslik (E6). Ilma cursor'ita
     annaks marsruut esimese lehe ja ülejäänud read oleksid kättesaamatud. */
  for (const name of ["cases/route.js", "cases/[caseId]/items/route.js", "cases/[caseId]/missing-info/route.js"]) {
    const source = await readRoute(name);
    assert.match(source, /cursor: (params|search)\.get\("cursor"\)/, `${name}: cursor ei tule päringust`);
    assert.match(source, /limit: (params|search)\.get\("limit"\)/, `${name}: limiit ei tule päringust`);
  }
});

test("E3 päritolu kinnitamine elab OMA marsruudil, mitte PATCH-i sees (L4)", async () => {
  /* KANDEV GARANTII: AI mustandi märgist ei saa maha võtta teksti parandamise
     kõrvalmõjuna. Kaks kohta, kust see auk tekiks — ja mõlemad on vaiksed. */
  const PREP = "cases/[caseId]/meeting-preps/[prepId]";

  /* 1. Väljade marsruut võtab `provenance` vastu (uue rea jaoks), aga ei tohi
        omada eraldi märgise-muutmise rada. */
  const fields = await readRoute(`${PREP}/fields/route.js`);
  assert.doesNotMatch(fields, /export async function PATCH/, "väljadel on eraldi märgise-uuendus");

  /* 2. Küsimuse `PATCH` ei tohi `provenance`-i teenuskihile edasi anda. */
  const question = await readRoute(`${PREP}/questions/[questionId]/route.js`);
  assert.doesNotMatch(question, /provenance:\s*body/, "küsimuse PATCH edastab päritolu");

  /* Kinnitamisel on oma marsruut ja ta nõuab `from`-i — ilma selleta ei ole
     tingimuslikku update'i ja kaks samaaegset kinnitust kirjutaksid teineteist üle. */
  for (const name of [
    `${PREP}/fields/[fieldKey]/confirm-provenance/route.js`,
    `${PREP}/questions/[questionId]/confirm-provenance/route.js`
  ]) {
    const source = await readRoute(name);
    assert.match(source, /export async function POST/, `${name}: POST puudub`);
    assert.match(source, /from: body\?\.from/, `${name}: from ei tule kehast`);
    assert.match(source, /to: body\?\.to/, `${name}: to ei tule kehast`);
  }
});

test("E3 marsruudid kannavad BOTH juhtumi ja prep-i ID-d (ristkontroll)", async () => {
  /* Ilma `caseWorkAssistId`-ta jõuaks teenuskihti ainult prep-i ID ja
     omanikupiir kehtiks juhtumile, mille ID kutsuja ise valis — sama muster,
     mis 04.08 IDOR-i tekitas, ainult ühe tasandi võrra sügavamal. */
  const NESTED = ROUTES.filter((name) => name.includes("meeting-preps/[prepId]"));
  assert.ok(NESTED.length >= 5, "pesastatud marsruute ei leitud");

  for (const name of NESTED) {
    const source = await readRoute(name);
    assert.match(source, /caseWorkAssistId: caseId/, `${name}: juhtumi ID ei jõua teenuskihti`);
    assert.match(source, /meetingPrepId: prepId/, `${name}: prep-i ID ei jõua teenuskihti`);
  }
});

test("E4 märkmel EI OLE kustutus- ega uuendusrada (märge on kohtumise jälg)", async () => {
  /* Ettevalmistus on tulevikuplaan ja teda tohib kustutada; märge kirjeldab
     seda, mis juba juhtus. Kõige lihtsam koht, kust kustutus märkamatult
     tekiks, on märkme enda marsruut — sinna kirjutatakse `DELETE` „sümmeetria
     pärast", sest kõrvalolev prep-marsruut kannab teda. */
  const note = await readRoute("cases/[caseId]/meeting-notes/[noteId]/route.js");
  assert.doesNotMatch(note, /export async function DELETE/, "märkmel on kustutusrada");
  assert.doesNotMatch(note, /export async function PATCH/, "märkme konteineril on uuendusrada");

  const service = await readLib("caseWorkMeetingNote.js");
  assert.doesNotMatch(service, /caseWorkMeetingNote\.delete/, "teenuskiht: märkme kustutus");
});

test("E4 kirje PATCH ei edasta päritolu ja kannab mõlemat ID-d", async () => {
  const entry = await readRoute("cases/[caseId]/meeting-notes/[noteId]/entries/[entryId]/route.js");
  /* L4: märgis ei tohi kaduda teksti parandamise kõrvalmõjuna. */
  assert.doesNotMatch(entry, /provenance:\s*body/, "kirje PATCH edastab päritolu");

  const NESTED = ROUTES.filter((name) => name.includes("meeting-notes/[noteId]"));
  assert.ok(NESTED.length >= 3, "pesastatud märkme-marsruute ei leitud");
  for (const name of NESTED) {
    const source = await readRoute(name);
    assert.match(source, /caseWorkAssistId: caseId/, `${name}: juhtumi ID ei jõua teenuskihti`);
    assert.match(source, /meetingNoteId: noteId/, `${name}: märkme ID ei jõua teenuskihti`);
  }
});

test("E4 kirje lisamine nõuab NII kihti kui päritolu", async () => {
  /* Vaikeväärtus tähendaks, et märgistamata rida saab vaikselt tähendada
     „faktiline asjaolu, töötaja kirjutatud" — ja just see vahe on kogu kihilise
     märkme mõte. */
  const entries = await readRoute("cases/[caseId]/meeting-notes/[noteId]/entries/route.js");
  assert.match(entries, /layer: body\?\.layer \?\? null/, "kiht ei tule kehast või tal on vaikeväärtus");
  assert.match(entries, /provenance: body\?\.provenance \?\? null/, "päritolu ei tule kehast");
});

test("E5 mustandil EI OLE kustutus- ega seisu-uuendusrada väljaspool `transition`-i", async () => {
  /* Mustand on ülekandeahela lüli ja tema jälg on tõend; lõpetamise tee on
     `EI_KANTA` — teadlik lõpp, mitte „jäi seisma". Kustutus laseks otsuse
     ajaloost vaikselt kaduda. */
  const detail = await readRoute("cases/[caseId]/drafts/[draftId]/route.js");
  assert.doesNotMatch(detail, /export async function DELETE/, "mustandil on kustutusrada");
  assert.doesNotMatch(detail, /export async function PATCH/, "mustandi konteineril on uuendusrada");

  /* Seisu muudab AINULT `transition` marsruut. `transferState` mujal tähendaks
     teed, mis läheb olekumasinast mööda. */
  for (const name of ["cases/[caseId]/drafts/route.js", "cases/[caseId]/drafts/[draftId]/fields/route.js"]) {
    const source = await readRouteCode(name);
    assert.doesNotMatch(source, /transferState/, `${name}: seis tuleb väljaspool transition-marsruuti`);
  }
});

test("E5 siirdemarsruut nõuab `expectedFrom`-i ja ei võta seisu mujalt", async () => {
  /* Ilma `expectedFrom`-ita ei ole tingimuslikku update'it (L6) ja kaks
     samaaegset siiret kirjutaksid teineteist üle. */
  const source = await readRoute("cases/[caseId]/drafts/[draftId]/transition/route.js");
  assert.match(source, /expectedFrom: body\?\.expectedFrom/, "expectedFrom ei tule kehast");
  assert.match(source, /to: body\?\.to/, "siht ei tule kehast");
  assert.match(source, /caseWorkAssistId: caseId/, "juhtumi ID ei jõua teenuskihti");
});

test("E5 väljamarsruut ei edasta päritolu uuendusse", async () => {
  const source = await readRoute("cases/[caseId]/drafts/[draftId]/fields/route.js");
  /* `provenance` võetakse vastu ainult UUE rea jaoks; teenuskiht eirab teda
     olemasoleval real (L4). Marsruut ei tohi tal olla teist teed. */
  assert.match(source, /provenance: body\?\.provenance/);
  assert.doesNotMatch(source, /export async function PATCH/, "väljal on eraldi märgise-uuendus");
});

test("E6 ülekandeauditil EI OLE muutmis- ega kustutusrada (L8: append-only)", async () => {
  /* Tõend, mida saab tagantjärele parandada, ei ole tõend. Kaks kõige
     tõenäolisemat kohta, kust rada märkamatult tekiks, on ajaloo marsruut
     („paranda vale rida") ja kopeerimise oma („eemalda duplikaat") — L22 järgi
     ei ole duplikaati, mida eemaldada. */
  for (const name of [
    "cases/[caseId]/transfer-events/route.js",
    "cases/[caseId]/drafts/[draftId]/copy-events/route.js"
  ]) {
    const source = await readRoute(name);
    assert.doesNotMatch(source, /export async function DELETE/, `${name}: auditil on kustutusrada`);
    assert.doesNotMatch(source, /export async function PATCH/, `${name}: auditil on uuendusrada`);
    assert.doesNotMatch(source, /export async function PUT/, `${name}: auditil on ülekirjutusrada`);
  }

  const service = await readLib("caseWorkTransfer.js");
  assert.doesNotMatch(service, /caseWorkTransferEvent\.delete/, "teenuskiht: auditirea kustutus");
  assert.doesNotMatch(service, /caseWorkTransferEvent\.update/, "teenuskiht: auditirea uuendus");
});

test("E6 kopeerimine nõuab kliendi võtit ja välju, MITTE seisu", async () => {
  /* L22: võti sünnib kliendis ENNE lõikelauda. Serveris genereeritud võti oleks
     iga kutse peale uus ja ei kaitseks korduse eest millegi vastu. */
  const source = await readRouteCode("cases/[caseId]/drafts/[draftId]/copy-events/route.js");
  assert.match(source, /clientActionId: body\?\.clientActionId/, "võti ei tule kehast");
  assert.match(source, /fieldKeys: body\?\.fieldKeys/, "väljade loend ei tule kehast");
  /* Kopeerimine EI liiguta olekumasinat (L9) — seis ei tohi selle marsruudi
     kaudu üldse liikuda. */
  assert.doesNotMatch(source, /transferState/, "kopeerimine puudutab seisu");
});

test("E6 `ULE_KANTUD`-ini viib TÄPSELT ÜKS marsruut (L19)", async () => {
  const mark = await readRouteCode("cases/[caseId]/drafts/[draftId]/mark-transferred/route.js");
  assert.match(mark, /markTransferred/, "märkimismarsruut ei kutsu teenust");
  assert.match(mark, /expectedFrom: body\?\.expectedFrom/, "expectedFrom ei tule kehast");

  /* Ükski TEINE marsruut ei tohi `markTransferred`-i kutsuda ega `ULE_KANTUD`-i
     nimetada: teine kutsuja on teine uks olekumasinasse. */
  for (const name of ROUTES.filter((route) => !route.endsWith("mark-transferred/route.js"))) {
    const source = await readRouteCode(name);
    assert.doesNotMatch(source, /markTransferred/, `${name}: teine tee ULE_KANTUD-ini`);
    assert.doesNotMatch(source, /ULE_KANTUD/, `${name}: seis kirjutatakse mujal`);
  }
});
