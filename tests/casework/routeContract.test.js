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
  "workbench/route.js"
];

async function readRoute(name) {
  return readFile(new URL(`../../app/api/casework/${name}`, import.meta.url), "utf8");
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
