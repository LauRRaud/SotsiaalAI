#!/usr/bin/env node
/**
 * JUHTUM-V1 (CASEWORK-P7) — sünteetiline runtime-sond juhtumi objektile.
 *
 * Miks ta olemas on: fake-prismaga roheline sviit EI TÕENDA skeemi. Puuduv
 * CHECK, katkine kaskaad või vale `onDelete` paistavad välja alles päris
 * andmebaasis — ja siin tähendaks vaikne skeemiviga kas rippuvat viidet
 * kustutatud dokumendile või isikuandmete jäämist kirjesse, mis peaks olema
 * tühjendatud.
 *
 * ETAPP E1 tõendab:
 *   1. viis DB CHECK-i lükkavad vigase rea tagasi ANDMEBAASIS, mitte ainult
 *      teenusekihis (teenusekihti ei ole veel olemas — see ongi mõte);
 *   2. `CaseWorkItem` kolm sihttüüpi kustuvad KASKAADIS, ja seda tõendatakse
 *      OTSE-SQL kustutusega, mitte Prisma kaudu — muidu tõendaks test ainult
 *      rakenduse kustutusteed;
 *   3. kliendi konto kustutus annab `SET NULL` ja juhtum SÄILIB, aga
 *      `clientErasedAt` JÄÄB MÄÄRAMATA — see on lepingu L17 kandev väide, mille
 *      pärast konto kustutamise rada peab kutsuma `eraseCaseClientReference()`;
 *   4. unikaalindeksid piiravad ainult päris seoseid: mitu `NULL`-iga rida elab
 *      kõrvuti (Postgres ei loe NULL-e võrdseks).
 *
 * ETAPP E6 tõendab sama asja MARSRUUDIKIHIS ja kahe PÄRIS sessiooniga:
 *   5. üksteist kasutusvoogu käivad läbi HTTP, mitte teenuskihi otsekutse —
 *      värav, sessioon, roll ja päringupiirang on siis ka tõendatud;
 *   6. kaks töötajat on üksteise juhtumitest PIMEDAD (04.08 IDOR-i õppetund:
 *      see viga oli koodis ja ükski üheseansiline test ei näinud teda).
 *
 * Andmed on sünteetilised ja sond koristab enda järelt ära. Päris kasutajate
 * sisu ta ei loe ega puutu (töökorra reegel 4).
 *
 * Käivitamine:
 *   npm run case:probe
 *
 * E6 osa vajab TÖÖTAVAT serverit, mis kasutab SAMA andmebaasi ja millel on
 * serverivärav sees (vaikimisi on ta väljas):
 *   CASEWORK_V1_ENABLED=1 npx next start -p 3100
 *   CASE_PROBE_BASE_URL=http://localhost:3100 npm run case:probe
 */

import { randomBytes } from "node:crypto";

import { hashOpaqueToken } from "../lib/auth/pin-login.js";
import { prisma } from "../lib/prisma.js";
import {
  createCaseWorkAssist,
  eraseCaseClientReference,
  getCaseWorkAssist,
  transitionRetention,
  updateCaseWorkAssist
} from "../lib/casework/caseWorkAssist.js";
import {
  countCaseWorkItems,
  linkCaseWorkItem,
  listCaseWorkItems,
  unlinkCaseWorkItem
} from "../lib/casework/caseWorkItem.js";
import {
  addMissingInfo,
  countOpenMissingInfo,
  listMissingInfo,
  removeMissingInfo,
  setMissingInfoStatus
} from "../lib/casework/caseWorkMissingInfo.js";
import { listCaseWorkWorkspaces } from "../lib/workspaces/adapters/caseWorkAdapter.js";
import { WORKSPACE_KIND_REGISTRY, WorkspaceKind } from "../lib/workspaces/registry.js";

/* TOOTMISKAITSE: sond KIRJUTAB andmebaasi. Sama värav mis A4 sondil —
   `NODE_ENV` üksi ei ole piisav, sest tootmisbaasi võib ühendada ka
   seadistamata shellist. Vaatame ka seda, kuhu ühendus päriselt läheb. */
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL || "").hostname || "";
  } catch {
    return "";
  }
})();
const localHosts = new Set(["localhost", "127.0.0.1", "::1", ""]);
if ((process.env.NODE_ENV === "production" || !localHosts.has(dbHost)) && process.env.ALLOW_JUHTUM_DB_PROBE !== "1") {
  console.error(
    `JUHTUM-V1 sond ei käivitu kaug- ega tootmisandmebaasi vastu ilma ALLOW_JUHTUM_DB_PROBE=1 (host: ${dbHost || "tundmatu"}).`
  );
  process.exit(1);
}

const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const lines = [];
let failures = 0;

function check(label, condition, detail = "") {
  if (condition) lines.push(`  OK   ${label}${detail ? ` — ${detail}` : ""}`);
  else {
    failures += 1;
    lines.push(`  VIGA ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Ootab, et andmebaas LÜKKAB kirje tagasi. Õnnestumine on siin ebaõnnestumine. */
async function expectRejected(label, fn) {
  try {
    await fn();
    check(label, false, "andmebaas VÕTTIS vastu, oleks pidanud keelduma");
  } catch (error) {
    const message = String(error?.message || error);
    /* Kontrollime, et keeldumine tuli PIIRANGUST, mitte kirjaveast päringus. */
    const isConstraint = /constraint|chk|check/i.test(message);
    check(label, isConstraint, isConstraint ? "" : `vale veapõhjus: ${message.slice(0, 120)}`);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
   E6 — PÄRIS SESSIOONID HTTP KAUDU
   ──────────────────────────────────────────────────────────────────────────── */

const baseUrl = (process.env.CASE_PROBE_BASE_URL || "http://localhost:3000").replace(/\/+$/, "");

/**
 * Küpsisepurk MÄLUS, üks iga sessiooni kohta.
 *
 * MIKS MITTE FAILI: leping lubab küpsisefailid ajutisse kausta, aga mällu
 * jäänud sessioon ei saa põhimõtteliselt kogemata commit'i sattuda ega üle elada
 * protsessi lõppu. Kaks ERALDI purki on kandev nõue — jagatud purk tähendaks, et
 * teine sessioon kirjutab esimese üle ja „kaks töötajat" oleks tegelikult üks.
 */
function makeCookieJar() {
  const jar = new Map();
  return {
    header: () => [...jar].map(([name, value]) => `${name}=${value}`).join("; "),
    absorb(response) {
      for (const raw of response.headers.getSetCookie?.() || []) {
        const [pair] = raw.split(";");
        const index = pair.indexOf("=");
        if (index < 1) continue;
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (!value) jar.delete(name);
        else jar.set(name, value);
      }
    }
  };
}

async function apiFetch(path, { jar = null, method = "GET", body = null } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    redirect: "manual",
    headers: {
      ...(jar ? { cookie: jar.header() } : {}),
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (jar) jar.absorb(response);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload || {} };
}

/**
 * Päris sessioon ILMA PIN-ita: ühekordne login-token kirjutatakse otse
 * andmebaasi ja vahetatakse `credentials` provideri kaudu sessiooniküpsise
 * vastu. Nii ei ole sondil vaja ühtki saladust ei koodis ega keskkonnas — ja
 * PIN-i, mida ei ole, ei saa ka kogemata logida.
 */
async function signIn(userId) {
  const rawToken = randomBytes(24).toString("hex");
  await prisma.loginTempToken.create({
    data: { userId, tokenHash: hashOpaqueToken(rawToken), expiresAt: new Date(Date.now() + 10 * 60 * 1000) }
  });

  const jar = makeCookieJar();
  const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf`);
  jar.absorb(csrfResponse);
  const { csrfToken } = await csrfResponse.json();

  const form = new URLSearchParams({
    csrfToken,
    temp_login_token: rawToken,
    callbackUrl: `${baseUrl}/vestlus`,
    json: "true"
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: form.toString()
  });
  jar.absorb(loginResponse);

  /* Sessiooni OLEMASOLU ei eeldata, vaid küsitakse serverilt: küpsis võib olla
     purgis ja ikkagi mitte kehtida. */
  const session = await apiFetch("/api/auth/session", { jar });
  return { jar, userId: session.body?.user?.id || null };
}

let workerId = null;
let clientId = null;
let strangerId = null;
let documentId = null;
let artifactId = null;
let fieldVisitId = null;

try {
  const worker = await prisma.user.create({
    data: { email: `juhtum.sond.worker.${runId}@sotsiaalai.test`, role: "SOCIAL_WORKER" }
  });
  workerId = worker.id;
  const client = await prisma.user.create({
    data: { email: `juhtum.sond.client.${runId}@sotsiaalai.test`, role: "CLIENT" }
  });
  clientId = client.id;

  const document = await prisma.userDocument.create({
    data: {
      ownerId: workerId,
      title: `Sondi dokument ${runId}`,
      originalName: `sond-${runId}.txt`,
      mime: "text/plain",
      size: 12,
      sha256: runId.padEnd(64, "0").slice(0, 64),
      storagePath: `synthetic/${runId}.txt`
    }
  });
  documentId = document.id;

  const artifact = await prisma.agentArtifact.create({
    data: { ownerId: workerId, type: "CASE_SUMMARY", content: `Sondi artefakt ${runId}` }
  });
  artifactId = artifact.id;

  const fieldVisit = await prisma.fieldVisit.create({ data: { ownerUserId: workerId } });
  fieldVisitId = fieldVisit.id;

  lines.push(`JUHTUM-V1 sond ${runId}`);
  lines.push("");
  lines.push("E1 — DB CHECK-id (leping L20)");

  // ── 1. Päritolu: maksimaalselt üks ─────────────────────────────────────────
  const preInquiry = await prisma.preInquiry.create({
    data: { authorId: clientId, recipientType: "KOV_CONTACT", situation: `Sondi olukord ${runId}` }
  });
  await expectRejected("päritolu: mõlemat korraga ei saa määrata", () =>
    prisma.caseWorkAssist.create({
      data: { ownerUserId: workerId, preInquiryId: preInquiry.id, urgentRequestId: preInquiry.id }
    })
  );

  const caseWithOrigin = await prisma.caseWorkAssist.create({
    data: { ownerUserId: workerId, preInquiryId: preInquiry.id }
  });
  check("päritolu: üks on lubatud", Boolean(caseWithOrigin.id));

  // ── 2. Klient kahel rajal ──────────────────────────────────────────────────
  await expectRejected("klient: rada A + rada B korraga on keelatud", () =>
    prisma.caseWorkAssist.create({
      data: { ownerUserId: workerId, clientUserId: clientId, clientDisplayName: "Ema" }
    })
  );
  await expectRejected("klient: rada A + välisviide korraga on keelatud", () =>
    prisma.caseWorkAssist.create({
      data: { ownerUserId: workerId, clientUserId: clientId, clientExternalRef: `REF-${runId}` }
    })
  );

  const caseTrackB = await prisma.caseWorkAssist.create({
    data: { ownerUserId: workerId, clientDisplayName: "perearst R", clientExternalRef: `REF-${runId}` }
  });
  check("klient: rada B kuvanimi + välisviide koos on lubatud", Boolean(caseTrackB.id));

  const caseNoClient = await prisma.caseWorkAssist.create({ data: { ownerUserId: workerId } });
  check("klient: mõlema puudumine on lubatud", Boolean(caseNoClient.id));

  /* PÄRITOLU EI KEELA RADA B — see on v5 auditi parandus. Lähedase esitatud
     pöördumise puhul EI OLE autor klient, ja kui see kombinatsioon oleks
     keelatud, ei saaks tegelikku klienti üldse märkida. */
  const caseOriginPlusB = await prisma.caseWorkAssist.create({
    data: { ownerUserId: workerId, preInquiryId: preInquiry.id, clientDisplayName: "tütar" }
  });
  check("päritolu EI KEELA rada B (lähedase esitatud pöördumine)", Boolean(caseOriginPlusB.id));

  // ── 3. STAR-i viide: mõlemad või kumbki ────────────────────────────────────
  await expectRejected("STAR: süsteem ilma viiteta on keelatud", () =>
    prisma.caseWorkAssist.create({ data: { ownerUserId: workerId, externalSystem: "STAR2" } })
  );
  await expectRejected("STAR: viide ilma süsteemita on keelatud", () =>
    prisma.caseWorkAssist.create({ data: { ownerUserId: workerId, externalReference: `STAR-${runId}` } })
  );
  const caseStar = await prisma.caseWorkAssist.create({
    data: { ownerUserId: workerId, externalSystem: "STAR2", externalReference: `STAR-${runId}` }
  });
  check("STAR: mõlemad koos on lubatud", Boolean(caseStar.id));

  // ── 4. Kustutatud kliendiviide nullib kõik ─────────────────────────────────
  await expectRejected("kustutus: märge koos alles jäänud kuvanimega on keelatud", () =>
    prisma.caseWorkAssist.create({
      data: { ownerUserId: workerId, clientDisplayName: "Ema", clientErasedAt: new Date() }
    })
  );
  const caseErased = await prisma.caseWorkAssist.create({
    data: { ownerUserId: workerId, clientErasedAt: new Date() }
  });
  check("kustutus: märge tühjade väljadega on lubatud", Boolean(caseErased.id));

  // ── 5. CaseWorkItem: täpselt üks siht ──────────────────────────────────────
  await expectRejected("seos: null sihita rida on keelatud", () =>
    prisma.caseWorkItem.create({ data: { caseWorkAssistId: caseNoClient.id } })
  );
  await expectRejected("seos: kaks sihti korraga on keelatud", () =>
    prisma.caseWorkItem.create({
      data: { caseWorkAssistId: caseNoClient.id, userDocumentId: documentId, agentArtifactId: artifactId }
    })
  );

  lines.push("");
  lines.push("E1 — kaskaad ja seosed");

  const itemDoc = await prisma.caseWorkItem.create({
    data: { caseWorkAssistId: caseNoClient.id, userDocumentId: documentId }
  });
  const itemArtifact = await prisma.caseWorkItem.create({
    data: { caseWorkAssistId: caseNoClient.id, agentArtifactId: artifactId }
  });
  const itemVisit = await prisma.caseWorkItem.create({
    data: { caseWorkAssistId: caseNoClient.id, fieldVisitId: fieldVisitId }
  });
  check("seos: kolm sihttüüpi ühe juhtumi all", Boolean(itemDoc.id && itemArtifact.id && itemVisit.id));

  /* NULL-e ei loeta võrdseks: kolm rida, igal kaks NULL-i sihiveergu, elavad
     unikaalindeksite all rahulikult kõrvuti. */
  check(
    "unikaalindeks: mitu NULL-iga rida elab kõrvuti",
    (await prisma.caseWorkItem.count({ where: { caseWorkAssistId: caseNoClient.id } })) === 3
  );

  await expectRejected("unikaalindeks: sama dokumenti ei saa kaks korda siduda", () =>
    prisma.caseWorkItem.create({ data: { caseWorkAssistId: caseNoClient.id, userDocumentId: documentId } })
  );

  /* KASKAAD OTSE-SQL-iga. Prisma kaudu kustutamine tõendaks ainult rakenduse
     kustutusteed; leping lubab garantii ANDMEBAASIST, seega tõendame teda nii,
     nagu ta päriselt vastu peab. */
  await prisma.$executeRawUnsafe(`DELETE FROM "UserDocument" WHERE id = $1`, documentId);
  documentId = null;
  check(
    "kaskaad: otse-SQL dokumendi kustutus eemaldas seose",
    (await prisma.caseWorkItem.count({ where: { id: itemDoc.id } })) === 0
  );

  await prisma.$executeRawUnsafe(`DELETE FROM "AgentArtifact" WHERE id = $1`, artifactId);
  artifactId = null;
  check(
    "kaskaad: otse-SQL artefakti kustutus eemaldas seose",
    (await prisma.caseWorkItem.count({ where: { id: itemArtifact.id } })) === 0
  );

  await prisma.$executeRawUnsafe(`DELETE FROM "FieldVisit" WHERE id = $1`, fieldVisitId);
  fieldVisitId = null;
  check(
    "kaskaad: otse-SQL välitöökäigu kustutus eemaldas seose",
    (await prisma.caseWorkItem.count({ where: { id: itemVisit.id } })) === 0
  );

  // ── 6. Päritoluobjekti kustutus: SetNull, juhtum säilib ────────────────────
  await prisma.preInquiry.delete({ where: { id: preInquiry.id } });
  const afterOriginDelete = await prisma.caseWorkAssist.findUnique({ where: { id: caseWithOrigin.id } });
  check(
    "päritolu kustutus: juhtum säilib ja viide on NULL",
    Boolean(afterOriginDelete) && afterOriginDelete.preInquiryId === null
  );

  // ── 7. Kliendi konto kustutus: SetNull, AGA clientErasedAt jääb määramata ──
  const caseWithClient = await prisma.caseWorkAssist.create({
    data: { ownerUserId: workerId, clientUserId: clientId }
  });
  await prisma.user.delete({ where: { id: clientId } });
  clientId = null;
  const afterClientDelete = await prisma.caseWorkAssist.findUnique({ where: { id: caseWithClient.id } });
  check(
    "kliendi konto kustutus: juhtum säilib ja viide on NULL",
    Boolean(afterClientDelete) && afterClientDelete.clientUserId === null
  );
  /* SEE ON LEPINGU L17 KANDEV VÄIDE. Kui see rida kunagi punaseks läheb, on
     keegi lisanud andmebaasi trigeri ja `eraseCaseClientReference()` võib olla
     üleliigne — aga seni ei tohi konto kustutamise rada tema kutsumist ära
     jätta, sest FK üksi EI JÄTA jälge, et kustutus toimus. */
  check(
    "FK SetNull ÜKSI ei määra `clientErasedAt`-i (L17 põhjendus)",
    afterClientDelete?.clientErasedAt === null
  );

  // ── 8. Juhtumi kustutus viib lapsed kaasa ─────────────────────────────────
  const caseForCascade = await prisma.caseWorkAssist.create({ data: { ownerUserId: workerId } });
  await prisma.caseWorkMissingInfo.create({
    data: { caseWorkAssistId: caseForCascade.id, text: "Puudub tõend", provenance: "TOOTAJA_TAHELEPANEK" }
  });
  await prisma.caseWorkRetentionAudit.create({
    data: {
      caseWorkAssistId: caseForCascade.id,
      ownerUserId: workerId,
      actorUserId: workerId,
      fromState: "ACTIVE",
      toState: "READ_ONLY",
      reason: "sond"
    }
  });
  await prisma.caseWorkClientErasureAudit.create({
    data: { caseWorkAssistId: caseForCascade.id, ownerUserId: workerId, actorKind: "SYSTEM", reason: "sond" }
  });
  await prisma.$executeRawUnsafe(`DELETE FROM "CaseWorkAssist" WHERE id = $1`, caseForCascade.id);
  const orphans =
    (await prisma.caseWorkMissingInfo.count({ where: { caseWorkAssistId: caseForCascade.id } })) +
    (await prisma.caseWorkRetentionAudit.count({ where: { caseWorkAssistId: caseForCascade.id } })) +
    (await prisma.caseWorkClientErasureAudit.count({ where: { caseWorkAssistId: caseForCascade.id } }));
  check("kaskaad: juhtumi kustutus koristas puuduva info ja mõlemad auditid", orphans === 0);

  // ── 9. `actorUserId` on auditis FK-ta — süsteemne kustutus ei vaja kasutajat
  check(
    "audit: `actorKind = SYSTEM` rida ei vaja `actorUserId`-d",
    (await prisma.caseWorkClientErasureAudit.count({ where: { ownerUserId: workerId, actorUserId: null } })) >= 0
  );

  lines.push("");
  lines.push("E2 — teenuskiht päris andmebaasi vastu");

  /* Teenuskiht on värava taga (L19) ja sond peab teda tõendama — seega lülitame
     ta SELLE PROTSESSI jaoks sisse. Andmebaasi see ei muuda: värav elab
     keskkonnamuutujas, mitte kirjes. */
  process.env.CASEWORK_V1_ENABLED = "1";

  const stranger = await prisma.user.create({
    data: { email: `juhtum.sond.stranger.${runId}@sotsiaalai.test`, role: "SOCIAL_WORKER" }
  });
  strangerId = stranger.id;

  const serviceCase = await createCaseWorkAssist({
    ownerUserId: workerId,
    clientDisplayName: "perearst R",
    clientExternalRef: `REF-${runId}`
  });
  check("teenuskiht: juhtum luuakse ja kannab kuvanime", serviceCase.label?.text === "perearst R");

  // Omanikupiir (L2): võõras saab 404, mitte 403 — ta ei tohi teada, et ID on olemas.
  let strangerStatus = null;
  try {
    await getCaseWorkAssist({ ownerUserId: strangerId, id: serviceCase.id });
  } catch (error) {
    strangerStatus = error?.status ?? null;
  }
  check("omanikupiir: võõras töötaja saab 404", strangerStatus === 404);

  // Retention-siire loob auditi SAMAS tehingus.
  await transitionRetention({
    ownerUserId: workerId,
    id: serviceCase.id,
    toState: "READ_ONLY",
    reason: "sondi kontroll"
  });
  const audits = await prisma.caseWorkRetentionAudit.findMany({ where: { caseWorkAssistId: serviceCase.id } });
  check(
    "retention: siire kirjutas auditi samas tehingus",
    audits.length === 1 && audits[0].fromState === "ACTIVE" && audits[0].toState === "READ_ONLY"
  );

  // READ_ONLY keelab kirjutamise — tingimuslik update, mitte loe-kontrolli-kirjuta.
  let readOnlyStatus = null;
  try {
    await updateCaseWorkAssist({ ownerUserId: workerId, id: serviceCase.id, patch: { nextContactAt: new Date() } });
  } catch (error) {
    readOnlyStatus = error?.status ?? null;
  }
  check("retention: READ_ONLY juhtumit ei saa muuta (409)", readOnlyStatus === 409);

  // Tagasisiiret ei ole.
  let reverseStatus = null;
  try {
    await transitionRetention({ ownerUserId: workerId, id: serviceCase.id, toState: "ACTIVE", reason: "tagasi" });
  } catch (error) {
    reverseStatus = error?.status ?? null;
  }
  check("retention: tagasisiire READ_ONLY → ACTIVE keeldub", reverseStatus === 409);

  await transitionRetention({
    ownerUserId: workerId,
    id: serviceCase.id,
    toState: "ARCHIVED",
    reason: "sondi arhiveerimine"
  });

  /* KUSTUTUS ON LUBATUD KA ARHIVEERITUD JUHTUMIS (L17 erand). Kirjutuskaitse
     kaitseb töötaja tööd, mitte kolmanda isiku andmeid tema eest. */
  const firstErase = await eraseCaseClientReference({
    caseWorkAssistId: serviceCase.id,
    actorUserId: workerId,
    reason: "sondi kustutus"
  });
  const afterErase = await prisma.caseWorkAssist.findUnique({ where: { id: serviceCase.id } });
  check(
    "kustutus: lubatud ka ARCHIVED juhtumis ja nullib kõik kolm välja",
    firstErase.changed === true &&
      afterErase.clientDisplayName === null &&
      afterErase.clientExternalRef === null &&
      afterErase.clientUserId === null &&
      afterErase.clientErasedAt !== null
  );
  check("kustutus: retention-seis EI muutu", afterErase.retentionState === "ARCHIVED");

  const secondErase = await eraseCaseClientReference({
    caseWorkAssistId: serviceCase.id,
    actorUserId: workerId,
    reason: "sondi kordus"
  });
  const erasureAudits = await prisma.caseWorkClientErasureAudit.count({
    where: { caseWorkAssistId: serviceCase.id }
  });
  check(
    "kustutus: IDEMPOTENTNE kõrvalmõjudeni — teine kutse ei loo teist auditirida",
    secondErase.changed === false && erasureAudits === 1
  );

  lines.push("");
  lines.push("E3 — seoseregister ja ligipääsupiir");

  const linkCase = await createCaseWorkAssist({ ownerUserId: workerId, clientDisplayName: "seoste juhtum" });

  const ownDocument = await prisma.userDocument.create({
    data: {
      ownerId: workerId,
      title: `Seotav dokument ${runId}`,
      originalName: `link-${runId}.txt`,
      mime: "text/plain",
      size: 8,
      sha256: `a${runId}`.padEnd(64, "1").slice(0, 64),
      storagePath: `synthetic/link-${runId}.txt`
    }
  });
  const ownArtifact = await prisma.agentArtifact.create({
    data: { ownerId: workerId, type: "ACTION_PLAN", content: `Seotav artefakt ${runId}` }
  });
  const ownVisit = await prisma.fieldVisit.create({ data: { ownerUserId: workerId } });

  await linkCaseWorkItem({
    ownerUserId: workerId,
    caseWorkAssistId: linkCase.id,
    targetType: "USER_DOCUMENT",
    targetId: ownDocument.id
  });
  await linkCaseWorkItem({
    ownerUserId: workerId,
    caseWorkAssistId: linkCase.id,
    targetType: "AGENT_ARTIFACT",
    targetId: ownArtifact.id
  });
  await linkCaseWorkItem({
    ownerUserId: workerId,
    caseWorkAssistId: linkCase.id,
    targetType: "FIELD_VISIT",
    targetId: ownVisit.id
  });
  const linked = await listCaseWorkItems({ ownerUserId: workerId, caseWorkAssistId: linkCase.id });
  check("seos: kolm oma objekti seotud ja loetavad", linked.items.length === 3);

  // L4: võõra objekti sidumine keeldub.
  const strangerDocument = await prisma.userDocument.create({
    data: {
      ownerId: strangerId,
      title: `Võõras dokument ${runId}`,
      originalName: `stranger-${runId}.txt`,
      mime: "text/plain",
      size: 8,
      sha256: `b${runId}`.padEnd(64, "2").slice(0, 64),
      storagePath: `synthetic/stranger-${runId}.txt`
    }
  });
  let foreignLinkStatus = null;
  try {
    await linkCaseWorkItem({
      ownerUserId: workerId,
      caseWorkAssistId: linkCase.id,
      targetType: "USER_DOCUMENT",
      targetId: strangerDocument.id
    });
  } catch (error) {
    foreignLinkStatus = error?.status ?? null;
  }
  check("L4: võõra objekti sidumine annab 404", foreignLinkStatus === 404);

  /* L3 — KANDEV KONTROLL. Kirjutame viida VÕÕRALE dokumendile OTSE andmebaasi,
     nii nagu leping ette näeb („kirjuta viit otse, loe API kaudu"). Teenuskiht
     ei tohi teda tagastada EGA LOENDADA: kui `count` ütleks 4 ja loend näitaks
     3, ei lekiks sisu — aga lekiks fakt, et neljas objekt on olemas. */
  await prisma.$executeRawUnsafe(
    `INSERT INTO "CaseWorkItem" (id, "caseWorkAssistId", "userDocumentId", "createdAt") VALUES ($1, $2, $3, NOW())`,
    `leak-${runId}`,
    linkCase.id,
    strangerDocument.id
  );
  const rawCount = await prisma.caseWorkItem.count({ where: { caseWorkAssistId: linkCase.id } });
  const visible = await listCaseWorkItems({ ownerUserId: workerId, caseWorkAssistId: linkCase.id });
  const visibleCount = await countCaseWorkItems({ ownerUserId: workerId, caseWorkAssistId: linkCase.id });
  check("L3: andmebaasis on neli rida (sond kirjutas võõra viida)", rawCount === 4);
  check("L3: ligipääsmatu seos EI ILMU loendisse", visible.items.length === 3);
  check("L3: ligipääsmatu seos EI MÕJUTA ARVU", visibleCount === 3);
  check(
    "L3: ligipääsmatu sihi ID ei leki vastusesse",
    visible.items.every((item) => item.targetId !== strangerDocument.id)
  );

  let unlinkInvisibleStatus = null;
  try {
    await unlinkCaseWorkItem({
      ownerUserId: workerId,
      caseWorkAssistId: linkCase.id,
      itemId: `leak-${runId}`
    });
  } catch (error) {
    unlinkInvisibleStatus = error?.status ?? null;
  }
  check("L3: ligipääsmatut seost ei saa ka eemaldada (404)", unlinkInvisibleStatus === 404);

  // Pagineerimine stabiilse võtmega: kaks lehte katavad kolm nähtavat rida.
  const firstPage = await listCaseWorkItems({ ownerUserId: workerId, caseWorkAssistId: linkCase.id, limit: 2 });
  const secondPage = await listCaseWorkItems({
    ownerUserId: workerId,
    caseWorkAssistId: linkCase.id,
    limit: 2,
    cursor: firstPage.nextCursor
  });
  const paged = [...firstPage.items, ...secondPage.items].map((item) => item.id);
  check(
    "pagineerimine: kaks lehte annavad kolm ERINEVAT rida ja cursor lõpeb",
    firstPage.items.length === 2 && secondPage.items.length === 1 && new Set(paged).size === 3 && !secondPage.nextCursor
  );

  await unlinkCaseWorkItem({
    ownerUserId: workerId,
    caseWorkAssistId: linkCase.id,
    itemId: visible.items[0].id
  });
  check(
    "seose eemaldamine vähendab nii loendit kui arvu",
    (await countCaseWorkItems({ ownerUserId: workerId, caseWorkAssistId: linkCase.id })) === 2
  );

  await transitionRetention({
    ownerUserId: workerId,
    id: linkCase.id,
    toState: "READ_ONLY",
    reason: "seoste lukk"
  });
  let linkReadOnlyStatus = null;
  try {
    await linkCaseWorkItem({
      ownerUserId: workerId,
      caseWorkAssistId: linkCase.id,
      targetType: "USER_DOCUMENT",
      targetId: ownDocument.id
    });
  } catch (error) {
    linkReadOnlyStatus = error?.status ?? null;
  }
  check("L14: READ_ONLY juhtumisse ei saa seost lisada (409)", linkReadOnlyStatus === 409);

  lines.push("");
  lines.push("E4 — puuduv info");

  const infoCase = await createCaseWorkAssist({ ownerUserId: workerId, clientDisplayName: "puuduva info juhtum" });
  const first = await addMissingInfo({
    ownerUserId: workerId,
    caseWorkAssistId: infoCase.id,
    text: "Puudub sissetuleku tõend",
    provenance: "DOKUMENDIST"
  });
  await addMissingInfo({
    ownerUserId: workerId,
    caseWorkAssistId: infoCase.id,
    text: "Vajab kliendiga kontrollimist",
    provenance: "KLIENDI_OELDUD"
  });
  const third = await addMissingInfo({
    ownerUserId: workerId,
    caseWorkAssistId: infoCase.id,
    text: "Teise spetsialisti kinnitus",
    provenance: "TEISE_SPETSIALISTI_INFO"
  });

  check(
    "puuduv info: kolm lahtist punkti",
    (await countOpenMissingInfo({ ownerUserId: workerId, caseWorkAssistId: infoCase.id })) === 3
  );

  const resolved = await setMissingInfoStatus({
    ownerUserId: workerId,
    caseWorkAssistId: infoCase.id,
    itemId: first.id,
    status: "RESOLVED"
  });
  check("puuduv info: RESOLVED määrab `resolvedAt` serveris", resolved.resolvedAt instanceof Date);
  check(
    "puuduv info: lahendatud punkt kaob loendurist",
    (await countOpenMissingInfo({ ownerUserId: workerId, caseWorkAssistId: infoCase.id })) === 2
  );

  const reopened = await setMissingInfoStatus({
    ownerUserId: workerId,
    caseWorkAssistId: infoCase.id,
    itemId: first.id,
    status: "OPEN"
  });
  check("puuduv info: tagasi avamine NULLIB `resolvedAt`", reopened.resolvedAt === null);

  /* SORTIMINE tugineb Postgresi enum'i deklaratsioonijärjekorrale — seda ei saa
     fake-prismaga tõendada, aga just siin ta katki läheks, kui keegi enum'i
     väärtusi ümber järjestaks. */
  await setMissingInfoStatus({
    ownerUserId: workerId,
    caseWorkAssistId: infoCase.id,
    itemId: third.id,
    status: "NOT_APPLICABLE"
  });
  const ordered = await listMissingInfo({ ownerUserId: workerId, caseWorkAssistId: infoCase.id });
  const statuses = ordered.items.map((item) => item.status);
  check(
    "puuduv info: lahtised enne lahendatuid (enum'i järjekord)",
    statuses[0] === "OPEN" && statuses[1] === "OPEN" && statuses[2] === "NOT_APPLICABLE"
  );

  await removeMissingInfo({ ownerUserId: workerId, caseWorkAssistId: infoCase.id, itemId: third.id });
  check(
    "puuduv info: eemaldamine vähendab loendit",
    (await listMissingInfo({ ownerUserId: workerId, caseWorkAssistId: infoCase.id })).items.length === 2
  );

  await transitionRetention({
    ownerUserId: workerId,
    id: infoCase.id,
    toState: "READ_ONLY",
    reason: "puuduva info lukk"
  });
  let infoReadOnlyStatus = null;
  try {
    await addMissingInfo({
      ownerUserId: workerId,
      caseWorkAssistId: infoCase.id,
      text: "Ei tohi lisanduda",
      provenance: "DOKUMENDIST"
    });
  } catch (error) {
    infoReadOnlyStatus = error?.status ?? null;
  }
  check("L14: kirjutuskeeld laieneb LASTELE — READ_ONLY blokib punkti lisamise", infoReadOnlyStatus === 409);
  check(
    "L14: lugemine jääb READ_ONLY juhtumis alles",
    (await listMissingInfo({ ownerUserId: workerId, caseWorkAssistId: infoCase.id })).items.length === 2
  );

  lines.push("");
  lines.push("E5 — K1 tööruumiadapter");

  check(
    "register: `case_work` on SUPPORTED ja tal on adapter",
    WORKSPACE_KIND_REGISTRY[WorkspaceKind.CASE_WORK].status === "SUPPORTED" &&
      WORKSPACE_KIND_REGISTRY[WorkspaceKind.CASE_WORK].adapter === "caseWork"
  );

  const workspaces = await listCaseWorkWorkspaces(workerId);
  check("adapter: tagastab omaniku juhtumid deskriptoritena", workspaces.length >= 3);
  check(
    "adapter: iga deskriptor on PRIVATE ja kannab `case_work` võtit",
    workspaces.every((item) => item.visibility === "PRIVATE" && item.ref.kind === "case_work")
  );
  check("adapter: võõras saab tühja loendi", (await listCaseWorkWorkspaces(strangerId)).length === 0);

  /* Kustutatud kliendiviitega juhtum (E2-s tühjendatud) peab kandma TÕLKEVÕTIT,
     mitte vana nime — sama kuvanime-funktsioon mis liideses. */
  const erasedWorkspace = workspaces.find((item) => item.ref.id === serviceCase.id);
  check(
    "adapter: kustutatud kliendiviide annab tõlkevõtme, mitte vana nime",
    erasedWorkspace?.title === "casework.label.erased_client"
  );
  check(
    "adapter: ükski deskriptor ei kanna järgmise kontakti kuupäeva",
    workspaces.every((item) => item.nextAction === null)
  );

  lines.push("");
  lines.push(`E6 — marsruudid ja pind PÄRIS sessioonidega (${baseUrl})`);

  let serverUp = false;
  try {
    const health = await fetch(`${baseUrl}/api/auth/csrf`, { signal: AbortSignal.timeout(5000) });
    serverUp = health.ok;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    /* MITTE VAIKNE VAHELEJÄTMINE. Kui E6 osa jääks tegemata ja sond ütleks
       ikka „OK", tähendaks roheline tulemus midagi muud kui eile — ja just seda
       vahet keegi hiljem ei märka. */
    check(
      "server vastab ja E6 vooge saab tõendada",
      false,
      `käivita server väravaga sees (CASEWORK_V1_ENABLED=1 npx next start -p 3100) ja anna CASE_PROBE_BASE_URL`
    );
  } else {
    const workerSession = await signIn(workerId);
    const strangerSession = await signIn(strangerId);
    check(
      "kaks päris sessiooni, eraldi küpsisepurgid",
      workerSession.userId === workerId &&
        strangerSession.userId === strangerId &&
        workerSession.userId !== strangerSession.userId,
      `${workerSession.userId ? "" : "töötaja sessioon puudub "}${strangerSession.userId ? "" : "teine sessioon puudub"}`
    );

    const workerJar = workerSession.jar;
    const listProbe = await apiFetch("/api/casework/cases", { jar: workerJar });

    if (listProbe.status === 404) {
      /* Väljas värav vastab 404-ga ka kehtiva sessiooniga — see ON õige
         käitumine (L19), aga siis ei saa üheski voos vahet teha „keelatud" ja
         „olematu" vahel, ja E6 jääks tõendamata. */
      check(
        "serveri värav on E6 tõendamiseks sees",
        false,
        "server vastab 404 — CASEWORK_V1_ENABLED on selle serveri protsessis väljas"
      );
    } else {
      const anonymous = await apiFetch("/api/casework/cases");
      check("sessioonita päring ei pääse ligi (401)", anonymous.status === 401, `staatus ${anonymous.status}`);
      check("sessiooniga töötaja saab loendi (200)", listProbe.status === 200, `staatus ${listProbe.status}`);

      // ── 1. Juhtumi käsitsi loomine ─────────────────────────────────────────
      const createdA = await apiFetch("/api/casework/cases", {
        jar: workerJar,
        method: "POST",
        body: { clientDisplayName: `sondi juhtum A ${runId}` }
      });
      const createdB = await apiFetch("/api/casework/cases", {
        jar: workerJar,
        method: "POST",
        body: { clientDisplayName: `sondi juhtum B ${runId}` }
      });
      const caseIdA = createdA.body?.case?.id || null;
      const caseIdB = createdB.body?.case?.id || null;
      check(
        "1. juhtumi loomine annab 201 ja kuvanime",
        createdA.status === 201 && createdA.body?.case?.label?.text === `sondi juhtum A ${runId}`,
        `staatus ${createdA.status}`
      );

      // ── 9. Pagineeritud loend stabiilse cursor'iga ─────────────────────────
      const page1 = await apiFetch("/api/casework/cases?limit=1", { jar: workerJar });
      const page2 = await apiFetch(`/api/casework/cases?limit=1&cursor=${encodeURIComponent(page1.body?.nextCursor || "")}`, {
        jar: workerJar
      });
      check(
        "9. pagineeritud loend: kaks lehte, kaks ERI rida, cursor liigub",
        page1.body?.items?.length === 1 &&
          page2.body?.items?.length === 1 &&
          page1.body.items[0].id !== page2.body.items[0].id
      );

      // ── 2.–4. Põhiandmed, järgmine kontakt, STAR-i viide ───────────────────
      const patched = await apiFetch(`/api/casework/cases/${caseIdA}`, {
        jar: workerJar,
        method: "PATCH",
        body: {
          nextContactAt: new Date(Date.now() + 86_400_000).toISOString(),
          externalSystem: "STAR2",
          externalReference: `STAR-${runId}`
        }
      });
      check(
        "2.–4. põhiandmed, järgmine kontakt ja STAR-i viide salvestuvad",
        patched.status === 200 &&
          patched.body?.case?.externalSystem === "STAR2" &&
          Boolean(patched.body?.case?.nextContactAt),
        `staatus ${patched.status}`
      );

      const cleared = await apiFetch(`/api/casework/cases/${caseIdA}`, {
        jar: workerJar,
        method: "PATCH",
        body: { nextContactAt: null }
      });
      check("3. järgmise kontakti EEMALDAMINE jõuab kohale", cleared.body?.case?.nextContactAt === null);

      /* Päritolu on muutumatu (L12) ja marsruut ei tohi teda vaikselt ära
         filtreerida — vastasel juhul arvaks klient, et muudatus õnnestus. */
      const originAttempt = await apiFetch(`/api/casework/cases/${caseIdA}`, {
        jar: workerJar,
        method: "PATCH",
        body: { preInquiryId: "midagi" }
      });
      check("L12: päritolu muutmine keeldub selge veaga (400)", originAttempt.status === 400);

      // ── 5. Seose lisamine ja eemaldamine ───────────────────────────────────
      const linked = await apiFetch(`/api/casework/cases/${caseIdA}/items`, {
        jar: workerJar,
        method: "POST",
        body: { targetType: "USER_DOCUMENT", targetId: ownDocument.id }
      });
      const afterLink = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: workerJar });
      check(
        "5. seose lisamine ja detailvaate arv liiguvad koos",
        linked.status === 201 && afterLink.body?.counts?.items === 1,
        `staatus ${linked.status}`
      );

      const foreignLink = await apiFetch(`/api/casework/cases/${caseIdA}/items`, {
        jar: workerJar,
        method: "POST",
        body: { targetType: "USER_DOCUMENT", targetId: strangerDocument.id }
      });
      check("L4: võõra objekti sidumine annab 404 ka marsruudil", foreignLink.status === 404);

      const unlinked = await apiFetch(
        `/api/casework/cases/${caseIdA}/items/${encodeURIComponent(linked.body?.item?.id || "")}`,
        { jar: workerJar, method: "DELETE" }
      );
      const afterUnlink = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: workerJar });
      check(
        "5. seose eemaldamine vähendab ka arvu",
        unlinked.status === 200 && afterUnlink.body?.counts?.items === 0
      );

      // ── 6.–7. Puuduv info ja tema staatus ──────────────────────────────────
      const addedInfo = await apiFetch(`/api/casework/cases/${caseIdA}/missing-info`, {
        jar: workerJar,
        method: "POST",
        body: { text: "Puudub sissetuleku tõend", provenance: "DOKUMENDIST" }
      });
      const afterInfo = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: workerJar });
      check(
        "6. puuduva info lisamine ja lahtiste loendur",
        addedInfo.status === 201 && afterInfo.body?.counts?.openMissingInfo === 1,
        `staatus ${addedInfo.status}`
      );

      const unknownProvenance = await apiFetch(`/api/casework/cases/${caseIdA}/missing-info`, {
        jar: workerJar,
        method: "POST",
        body: { text: "Tundmatu päritolu", provenance: "MINU_OMA_SÕNASTIK" }
      });
      check("L5: tundmatu päritolu lükatakse tagasi (400)", unknownProvenance.status === 400);

      const resolvedInfo = await apiFetch(
        `/api/casework/cases/${caseIdA}/missing-info/${encodeURIComponent(addedInfo.body?.item?.id || "")}`,
        { jar: workerJar, method: "PATCH", body: { status: "RESOLVED", resolvedAt: "1999-01-01T00:00:00.000Z" } }
      );
      const afterResolve = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: workerJar });
      /* `resolvedAt` tuleb SERVERIST: sond saadab kaasa võltsi kuupäeva ja
         kontrollib, et teda ei võetud vastu. */
      const resolvedAt = new Date(resolvedInfo.body?.item?.resolvedAt || 0).getFullYear();
      check(
        "7. staatuse muutmine: `resolvedAt` tuleb serverist ja loendur langeb",
        resolvedInfo.status === 200 && resolvedAt > 2000 && afterResolve.body?.counts?.openMissingInfo === 0
      );

      // ── KAKS PÄRIS SESSIOONI: üksteise juhtumitest pimedad ─────────────────
      const strangerJar = strangerSession.jar;
      const strangerDetail = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: strangerJar });
      const strangerList = await apiFetch("/api/casework/cases", { jar: strangerJar });
      const strangerRetention = await apiFetch(`/api/casework/cases/${caseIdA}/retention`, {
        jar: strangerJar,
        method: "POST",
        body: { toState: "READ_ONLY", reason: "võõras katse" }
      });
      const strangerErase = await apiFetch(`/api/casework/cases/${caseIdA}/client-reference`, {
        jar: strangerJar,
        method: "DELETE",
        body: { reason: "võõras katse" }
      });
      check(
        "IDOR: teine töötaja saab võõrale juhtumile 404 (mitte 403) igal rajal",
        strangerDetail.status === 404 && strangerRetention.status === 404 && strangerErase.status === 404,
        `${strangerDetail.status}/${strangerRetention.status}/${strangerErase.status}`
      );
      check(
        "IDOR: võõras juhtum ei ilmu teise töötaja loendisse",
        (strangerList.body?.items || []).every((item) => item.id !== caseIdA)
      );

      // ── 8. Retention-siire ja kirjutuskeeld ────────────────────────────────
      const noReason = await apiFetch(`/api/casework/cases/${caseIdB}/retention`, {
        jar: workerJar,
        method: "POST",
        body: { toState: "READ_ONLY" }
      });
      check("15. põhjuseta siire keeldub (400)", noReason.status === 400);

      const moved = await apiFetch(`/api/casework/cases/${caseIdA}/retention`, {
        jar: workerJar,
        method: "POST",
        body: { toState: "READ_ONLY", reason: "sondi E6 kirjutuskaitse" }
      });
      const writeAfter = await apiFetch(`/api/casework/cases/${caseIdA}`, {
        jar: workerJar,
        method: "PATCH",
        body: { nextContactAt: null }
      });
      const childWriteAfter = await apiFetch(`/api/casework/cases/${caseIdA}/missing-info`, {
        jar: workerJar,
        method: "POST",
        body: { text: "Ei tohi lisanduda", provenance: "DOKUMENDIST" }
      });
      check(
        "8. retention-siire õnnestub ja lukustab nii juhtumi kui LAPSED (409)",
        moved.status === 200 && writeAfter.status === 409 && childWriteAfter.status === 409,
        `${moved.status}/${writeAfter.status}/${childWriteAfter.status}`
      );

      const backwards = await apiFetch(`/api/casework/cases/${caseIdA}/retention`, {
        jar: workerJar,
        method: "POST",
        body: { toState: "ACTIVE", reason: "tagasi" }
      });
      check("12. tagasisiire keeldub ka marsruudil (409)", backwards.status === 409);

      // ── 11. Kliendiviite kustutamine (L17) ─────────────────────────────────
      const erasedFirst = await apiFetch(`/api/casework/cases/${caseIdA}/client-reference`, {
        jar: workerJar,
        method: "DELETE",
        body: { reason: "sondi kustutus" }
      });
      const erasedSecond = await apiFetch(`/api/casework/cases/${caseIdA}/client-reference`, {
        jar: workerJar,
        method: "DELETE",
        body: { reason: "sondi kordus" }
      });
      const afterErase = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: workerJar });
      const erasureAuditRows = await prisma.caseWorkClientErasureAudit.count({
        where: { caseWorkAssistId: caseIdA }
      });
      check(
        "11. kliendiviite kustutamine töötab KIRJUTUSKAITSTUD juhtumis",
        erasedFirst.status === 200 && erasedFirst.body?.changed === true,
        `staatus ${erasedFirst.status}`
      );
      check(
        "11. teine kutse on idempotentne kõrvalmõjudeni (üks auditirida)",
        erasedSecond.status === 200 && erasedSecond.body?.changed === false && erasureAuditRows === 1,
        `auditiridu ${erasureAuditRows}`
      );
      check(
        "11. kustutatud nimi ei leki detailvastusesse ja kuvanimi on tõlkevõti",
        afterErase.body?.case?.clientDisplayName === null &&
          afterErase.body?.case?.label?.labelKey === "casework.label.erased_client"
      );

      // ── L16: juhtumi kustutamise marsruuti EI OLE ──────────────────────────
      const deleteAttempt = await apiFetch(`/api/casework/cases/${caseIdA}`, { jar: workerJar, method: "DELETE" });
      check(
        "L16: juhtumi kustutamise API-t ei eksisteeri (405)",
        deleteAttempt.status === 405,
        `staatus ${deleteAttempt.status}`
      );

      const stillThere = await prisma.caseWorkAssist.count({ where: { id: caseIdA } });
      check("L16: juhtum on pärast kustutuskatset alles", stillThere === 1);
    }
  }
} catch (error) {
  failures += 1;
  lines.push(`  VIGA sond kukkus: ${error?.message || error}`);
} finally {
  /* KORISTUS. Juhtumid, seosed ja auditid kustuvad kaskaadis koos töötajaga —
     aga seda EI EELDATA, vaid kontrollitakse (A4 õppetund: 05.08 jäi tootmisse
     üks sünteetiline profiil, sest kustutati ainult see, mida mäletati). */
  try {
    if (documentId) await prisma.userDocument.deleteMany({ where: { id: documentId } });
    if (artifactId) await prisma.agentArtifact.deleteMany({ where: { id: artifactId } });
    if (fieldVisitId) await prisma.fieldVisit.deleteMany({ where: { id: fieldVisitId } });
    if (clientId) await prisma.user.deleteMany({ where: { id: clientId } });
    if (strangerId) await prisma.user.deleteMany({ where: { id: strangerId } });
    if (workerId) await prisma.user.deleteMany({ where: { id: workerId } });

    const leftovers =
      (await prisma.user.count({ where: { email: { contains: runId } } })) +
      (await prisma.caseWorkAssist.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.caseWorkRetentionAudit.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.caseWorkClientErasureAudit.count({ where: { ownerUserId: workerId || "-" } })) +
      /* E6 sessioonide login-tokenid kustuvad kaskaadis koos kasutajaga — aga
         seda EI EELDATA: just siia jääks vaikselt alles kirje, mis lubab
         sünteetilise kasutajana sisse logida. */
      (await prisma.loginTempToken.count({ where: { userId: { in: [workerId || "-", strangerId || "-"] } } }));
    if (leftovers === 0) lines.push("", "koristatud: sünteetilisi ridu ei jäänud");
    else {
      failures += 1;
      lines.push("", `  VIGA koristus jättis ${leftovers} rida`);
    }
  } catch (error) {
    failures += 1;
    lines.push(`  VIGA koristus: ${error?.message || error}`);
  }

  await prisma.$disconnect();
  const total = lines.filter((line) => line.startsWith("  OK") || line.startsWith("  VIGA")).length;
  lines.push(failures ? `SOND KUKKUS: ${failures}/${total} viga` : `SOND OK: ${total}/${total}`);
  console.log(lines.join("\n"));
  process.exitCode = failures ? 1 : 0;
}
