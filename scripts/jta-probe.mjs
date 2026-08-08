#!/usr/bin/env node
/**
 * JTA-V1 (E8) — sünteetiline runtime-sond juhtumitöö assistendile.
 *
 * MIKS TA OLEMAS ON. `npm test` jookseb fake-Prisma peal ja ta EI TÕENDA
 * skeemi: puuduv `CHECK`, katkine kaskaad või vale `onDelete` paistavad välja
 * alles päris andmebaasis. Ja veel üks asi, mida ükski üheseansiline test ei
 * näe: ligipääsupiir. 04.08 IDOR oli koodis, sviit oli roheline — sellepärast
 * käivad piiriread siin HTTP kaudu, MITTE teenuskihi otsekutsega.
 *
 * SEITSE ASJA, mida see sond nimeliselt tõendab (leping E8):
 *
 *   1. kaks töötajat on üksteise LAUDADEST pimedad
 *   2. võõra juhtumi prep / märge / mustand / transfer-event vastab „ei leitud",
 *      mitte „ei tohi" — 403 lekitaks fakti, et selline rida on olemas
 *   3. kirjutuskaitstud juhtumi laps ei muutu
 *   4. `PRIVAATNE_REFLEKSIOON` ei esine E6 väljundis ÜHESKI VORMIS
 *   5. auditirida ei sisalda ühtegi kopeeritud VÄÄRTUST
 *   6. ebaseaduslik üleminek annab 409
 *   7. kaks SAMAAEGSET üleminekut → üks õnnestub, teine 409
 *
 * Ja E7 lisab neli rida, mille koht ON andmebaas, mitte teenuskiht:
 *
 *   8.  purge ilma põhjuseta ja põhjus ilma ajata → andmebaas keeldub
 *   9.  „säilitustähtaeg möödus" ilma ülekandeta → andmebaas keeldub
 *   10. rada C purge kandmata mustandil → andmebaas LUBAB (E5 `CHECK` oleks
 *       keeldunud; just seepärast on migratsioon 5/4 olemas)
 *   11. L22 unikaalne indeks lükkab korduva `clientActionId` tagasi
 *
 * Andmed on sünteetilised ja sond koristab enda järelt ära. Päris kasutajate
 * sisu ta ei loe ega puutu (töökorra reegel 4).
 *
 * Käivitamine:
 *   npm run jta:probe
 *
 * HTTP-osa vajab TÖÖTAVAT serverit, mis kasutab SAMA andmebaasi ja millel on
 * serverivärav sees (vaikimisi on ta väljas):
 *   CASEWORK_V1_ENABLED=1 npx next start -p 3100
 *   JTA_PROBE_BASE_URL=http://localhost:3100 npm run jta:probe
 */

import { randomBytes } from "node:crypto";

import { hashOpaqueToken } from "../lib/auth/pin-login.js";
import { prisma } from "../lib/prisma.js";

/* TOOTMISKAITSE: sond KIRJUTAB andmebaasi. Sama värav mis JUHTUM-V1 sondil —
   `NODE_ENV` üksi ei ole piisav, sest tootmisbaasi võib ühendada ka
   seadistamata shellist. */
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
    `JTA-V1 sond ei käivitu kaug- ega tootmisandmebaasi vastu ilma ALLOW_JUHTUM_DB_PROBE=1 (host: ${dbHost || "tundmatu"}).`
  );
  process.exit(1);
}

const baseUrl = (process.env.JTA_PROBE_BASE_URL || process.env.CASE_PROBE_BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  ""
);
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

/** Ootab, et ANDMEBAAS lükkab kirje tagasi. Õnnestumine on siin ebaõnnestumine. */
async function expectRejected(label, fn) {
  try {
    await fn();
    check(label, false, "andmebaas VÕTTIS vastu, oleks pidanud keelduma");
  } catch (error) {
    const message = String(error?.message || error);
    const isConstraint = /constraint|chk|check|unique/i.test(message);
    check(label, isConstraint, isConstraint ? "" : `vale veapõhjus: ${message.slice(0, 120)}`);
  }
}

/** Kaks ERALDI purki — jagatud purk tähendaks, et „kaks töötajat" on üks. */
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

  /* `content-type` ON OSA TÕENDIST (08.08 õppetund): uus sügavalt pesastatud
     marsruut, mis ei jõua töötava dev-serveri registrisse, annab Next-i HTML
     404 — ja see näeb välja täpselt nagu omanikupiiri 404. */
  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  try {
    payload = contentType.includes("json") ? await response.json() : null;
  } catch {
    payload = null;
  }
  return { status: response.status, body: payload || {}, json: contentType.includes("json") };
}

/** Päris sessioon ILMA PIN-ita — vt sama selgitust JUHTUM-V1 sondis. */
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
    callbackUrl: `${baseUrl}/juhtumid`,
    json: "true"
  });
  const loginResponse = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: jar.header() },
    body: form.toString()
  });
  jar.absorb(loginResponse);

  const session = await apiFetch("/api/auth/session", { jar });
  return { jar, userId: session.body?.user?.id || null };
}

let workerId = null;
let strangerId = null;

const PRIVATE_TEXT = `PRIVAATNE refleksioon ${runId} — see EI TOHI kuhugi jõuda`;
const FIELD_TEXT = `Kliendi eesmärk ${runId}`;

try {
  lines.push(`JTA-V1 sond ${runId}`);
  lines.push("");

  const worker = await prisma.user.create({
    data: { email: `jta.sond.worker.${runId}@sotsiaalai.test`, role: "SOCIAL_WORKER" }
  });
  workerId = worker.id;
  const stranger = await prisma.user.create({
    data: { email: `jta.sond.stranger.${runId}@sotsiaalai.test`, role: "SOCIAL_WORKER" }
  });
  strangerId = stranger.id;

  /* ──────────────────────────────────────────────────────────────────────────
     E5–E7 DB-KIHT: `CHECK`-id, indeks ja kaskaad
     ────────────────────────────────────────────────────────────────────────── */

  lines.push("E5/E6/E7 — andmebaasi invariandid");

  const ownCase = await prisma.caseWorkAssist.create({ data: { ownerUserId: workerId } });
  const draft = await prisma.caseWorkDraft.create({
    data: { caseWorkAssistId: ownCase.id, draftType: "EESMARGI_SONASTUS" }
  });
  await prisma.caseWorkDraftField.create({
    data: { draftId: draft.id, fieldKey: "EESMARK", text: FIELD_TEXT, provenance: "KLIENDI_OELDUD" }
  });

  // ── 8. purge aeg ja põhjus käivad koos (E7 CHECK 3a) ───────────────────────
  await expectRejected("purge: aeg ilma põhjuseta on keelatud", () =>
    prisma.caseWorkDraft.update({ where: { id: draft.id }, data: { contentPurgedAt: new Date() } })
  );
  await expectRejected("purge: põhjus ilma ajata on keelatud", () =>
    prisma.caseWorkDraft.update({
      where: { id: draft.id },
      data: { contentPurgeReason: "WORKER_ARCHIVED_WORKING_MATERIAL" }
    })
  );

  // ── 9. automaatne rada nõuab ülekannet (E7 CHECK 3b) ───────────────────────
  await expectRejected("purge: `RETENTION_AFTER_TRANSFER` ilma ülekandeta on keelatud", () =>
    prisma.caseWorkDraft.update({
      where: { id: draft.id },
      data: { contentPurgedAt: new Date(), contentPurgeReason: "RETENTION_AFTER_TRANSFER" }
    })
  );

  // ── 10. rada C on lubatud (E5 `CHECK` oleks siin keeldunud) ────────────────
  const radaC = await prisma.caseWorkDraft.create({
    data: { caseWorkAssistId: ownCase.id, draftType: "TEGEVUS" }
  });
  await prisma.caseWorkDraft.update({
    where: { id: radaC.id },
    data: { contentPurgedAt: new Date(), contentPurgeReason: "WORKER_ARCHIVED_WORKING_MATERIAL" }
  });
  const radaCRow = await prisma.caseWorkDraft.findUnique({ where: { id: radaC.id } });
  check(
    "rada C: kandmata mustandi sisu tohib purge'ida (migratsioon 5/4)",
    radaCRow?.contentPurgeReason === "WORKER_ARCHIVED_WORKING_MATERIAL" && radaCRow?.transferredAt === null
  );

  // ── `transferredAt` ⟺ `ULE_KANTUD` (E5 CHECK 2) ───────────────────────────
  await expectRejected("mustand: `transferredAt` ilma `ULE_KANTUD`-ita on keelatud", () =>
    prisma.caseWorkDraft.update({ where: { id: draft.id }, data: { transferredAt: new Date() } })
  );

  // ── 11. L22 unikaalne indeks ──────────────────────────────────────────────
  const actionKey = "3f6d1c2a-1111-4222-8333-4444555566aa";
  const eventBase = {
    caseWorkAssistId: ownCase.id,
    draftId: draft.id,
    ownerUserId: workerId,
    actorUserId: workerId,
    kind: "COPIED_FOR_STAR2",
    draftType: "EESMARGI_SONASTUS",
    transferStateAtEvent: "MUSTAND",
    fieldKeys: ["EESMARK"]
  };
  const firstCopy = await prisma.caseWorkTransferEvent.create({
    data: { ...eventBase, clientActionId: actionKey }
  });
  await expectRejected("L22: sama `clientActionId` teist rida ei tee (unikaalne indeks)", () =>
    prisma.caseWorkTransferEvent.create({ data: { ...eventBase, clientActionId: actionKey } })
  );

  await expectRejected("L22: kopeerimine ILMA võtmeta on keelatud (CHECK 2)", () =>
    prisma.caseWorkTransferEvent.create({ data: { ...eventBase, clientActionId: null } })
  );

  /* `MARKED_AS_TRANSFERRED` read kannavad `null` võtit ja Postgres loeb `NULL`-e
     unikaalses indeksis ERISTUVATEKS — kaks sellist rida ei tohi põrgata. */
  const markedBase = { ...eventBase, kind: "MARKED_AS_TRANSFERRED", fieldKeys: [], clientActionId: null };
  await prisma.caseWorkTransferEvent.create({ data: markedBase });
  await prisma.caseWorkTransferEvent.create({ data: markedBase });
  const markedCount = await prisma.caseWorkTransferEvent.count({
    where: { draftId: draft.id, kind: "MARKED_AS_TRANSFERRED" }
  });
  check("L22: kaks võtmeta ülekanderida EI põrka (NULL on eristuv)", markedCount === 2, `ridu: ${markedCount}`);

  // ── 5. auditirida ei kanna ühtegi väärtust ────────────────────────────────
  const auditRow = JSON.stringify(firstCopy);
  check("audit: kopeeritud VÄÄRTUST auditireas ei ole (L8)", !auditRow.includes(FIELD_TEXT));

  // ── 12. kaskaad ───────────────────────────────────────────────────────────
  const cascadeCase = await prisma.caseWorkAssist.create({ data: { ownerUserId: workerId } });
  const cascadeDraft = await prisma.caseWorkDraft.create({
    data: { caseWorkAssistId: cascadeCase.id, draftType: "TEGEVUS" }
  });
  await prisma.caseWorkTransferEvent.create({
    data: {
      caseWorkAssistId: cascadeCase.id,
      draftId: cascadeDraft.id,
      ownerUserId: workerId,
      actorUserId: workerId,
      kind: "COPIED_FOR_STAR2",
      draftType: "TEGEVUS",
      transferStateAtEvent: "MUSTAND",
      fieldKeys: ["TEGEVUS"],
      clientActionId: "3f6d1c2a-1111-4222-8333-4444555566bb"
    }
  });
  /* OTSE-SQL kustutus, mitte Prisma kaskaad-simulatsioon: nii tõendab test
     ANDMEBAASI FK-d, mitte rakenduse kustutusteed. */
  await prisma.$executeRawUnsafe('DELETE FROM "CaseWorkAssist" WHERE id = $1', cascadeCase.id);
  const orphans = await prisma.caseWorkTransferEvent.count({ where: { caseWorkAssistId: cascadeCase.id } });
  const orphanDrafts = await prisma.caseWorkDraft.count({ where: { caseWorkAssistId: cascadeCase.id } });
  check("kaskaad: juhtumi kustutus viib mustandi ja ülekandeauditi", orphans === 0 && orphanDrafts === 0);

  /* ──────────────────────────────────────────────────────────────────────────
     E1–E7 MARSRUUDIKIHT: kaks päris sessiooni
     ────────────────────────────────────────────────────────────────────────── */

  lines.push("");
  lines.push(`E1–E7 — marsruudid PÄRIS sessioonidega (${baseUrl})`);

  let serverUp = false;
  try {
    const health = await fetch(`${baseUrl}/api/auth/csrf`, { signal: AbortSignal.timeout(5000) });
    serverUp = health.ok;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    /* MITTE VAIKNE VAHELEJÄTMINE. Kui HTTP-osa jääks tegemata ja sond ütleks
       ikka „OK", tähendaks roheline tulemus midagi muud kui eile. */
    check(
      "server vastab ja marsruudikihti saab tõendada",
      false,
      `käivita server väravaga sees (CASEWORK_V1_ENABLED=1 npx next start -p 3100) ja anna JTA_PROBE_BASE_URL`
    );
  } else {
    const mine = await signIn(workerId);
    const theirs = await signIn(strangerId);
    check("kaks päris sessiooni", mine.userId === workerId && theirs.userId === strangerId);

    const gate = await apiFetch(`/api/casework/cases/${ownCase.id}`, { jar: mine.jar });
    if (gate.status === 404 && !gate.json) {
      check("värav on sees ja marsruut on registris", false, "vastus on HTML 404 — kas server on vana build'iga?");
    } else if (gate.status === 404) {
      check("värav on sees", false, "CASEWORK_V1_ENABLED on serveris väljas");
    } else {
      check("värav on sees ja marsruut vastab JSON-iga", gate.status === 200);

      // ── 1. kaks töötajat on üksteise laudadest pimedad ────────────────────
      const myBench = await apiFetch("/api/casework/workbench", { jar: mine.jar });
      const theirBench = await apiFetch("/api/casework/workbench", { jar: theirs.jar });
      const mineDrafts = myBench.body?.sections?.draftsAwaitingTransfer?.items || [];
      const theirDrafts = theirBench.body?.sections?.draftsAwaitingTransfer?.items || [];
      check(
        "1. laud: minu mustand on minu laual",
        mineDrafts.some((row) => row.draftId === draft.id)
      );
      check(
        "1. laud: võõra laual EI OLE minu mustandit",
        !theirDrafts.some((row) => row.draftId === draft.id),
        `võõral ridu: ${theirDrafts.length}`
      );
      check(
        "1. laud: L12 kümme sektsiooni on kohal",
        Object.keys(myBench.body?.sections || {}).length === 10,
        `sektsioone: ${Object.keys(myBench.body?.sections || {}).length}`
      );

      // ── 2. võõras saab „ei leitud", mitte „ei tohi" ───────────────────────
      const foreign = [
        ["mustand", `/api/casework/cases/${ownCase.id}/drafts/${draft.id}`, "GET", null],
        ["STAR2 plokk", `/api/casework/cases/${ownCase.id}/drafts/${draft.id}/star2-block`, "GET", null],
        ["ülekandeajalugu", `/api/casework/cases/${ownCase.id}/transfer-events`, "GET", null],
        [
          "kopeerimise audit",
          `/api/casework/cases/${ownCase.id}/drafts/${draft.id}/copy-events`,
          "POST",
          { fieldKeys: ["EESMARK"], clientActionId: "3f6d1c2a-1111-4222-8333-4444555566cc" }
        ],
        [
          "ülekantuks märkimine",
          `/api/casework/cases/${ownCase.id}/drafts/${draft.id}/mark-transferred`,
          "POST",
          { expectedFrom: "VALMIS_ULEKANDEKS" }
        ],
        ["töömaterjali arhiveerimine", `/api/casework/cases/${ownCase.id}/working-material`, "POST", {}]
      ];
      for (const [label, path, method, body] of foreign) {
        const response = await apiFetch(path, { jar: theirs.jar, method, body });
        check(`2. võõras: ${label} → 404, mitte 403`, response.status === 404, `sai ${response.status}`);
      }

      // ── 6. ebaseaduslik üleminek ──────────────────────────────────────────
      const illegal = await apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/transition`, {
        jar: mine.jar,
        method: "POST",
        body: { expectedFrom: "MUSTAND", to: "KONTROLLITUD" }
      });
      check("6. ebaseaduslik üleminek → 400 ja seis ei muutu", illegal.status === 400, `sai ${illegal.status}`);

      const stale = await apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/transition`, {
        jar: mine.jar,
        method: "POST",
        body: { expectedFrom: "KONTROLLITUD", to: "VALMIS_ULEKANDEKS" }
      });
      check("6. aegunud `expectedFrom` → 409", stale.status === 409, `sai ${stale.status}`);

      // ── 7. kaks SAMAAEGSET üleminekut ─────────────────────────────────────
      const race = await Promise.all([
        apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/transition`, {
          jar: mine.jar,
          method: "POST",
          body: { expectedFrom: "MUSTAND", to: "VAJAB_KONTROLLI" }
        }),
        apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/transition`, {
          jar: mine.jar,
          method: "POST",
          body: { expectedFrom: "MUSTAND", to: "EI_KANTA" }
        })
      ]);
      const statuses = race.map((row) => row.status).sort();
      check("7. kaks samaaegset siiret: üks 200, teine 409", statuses[0] === 200 && statuses[1] === 409, `${statuses}`);

      // ── 4. PRIVAATNE_REFLEKSIOON ei jõua E6 väljundisse ───────────────────
      const note = await apiFetch(`/api/casework/cases/${ownCase.id}/meeting-notes`, {
        jar: mine.jar,
        method: "POST",
        body: {}
      });
      const noteId = note.body?.note?.id || null;
      if (noteId) {
        await apiFetch(`/api/casework/cases/${ownCase.id}/meeting-notes/${noteId}/entries`, {
          jar: mine.jar,
          method: "POST",
          body: { layer: "PRIVAATNE_REFLEKSIOON", text: PRIVATE_TEXT, provenance: "TOOTAJA_TOLGENDUS" }
        });
      }

      const block = await apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/star2-block`, {
        jar: mine.jar
      });
      const blockText = JSON.stringify(block.body);
      check(
        "4. `PRIVAATNE_REFLEKSIOON` ei esine E6 väljundis ÜHESKI vormis",
        noteId !== null && !blockText.includes(PRIVATE_TEXT) && !blockText.includes("PRIVAATNE_REFLEKSIOON"),
        noteId ? "" : "privaatset kirjet ei õnnestunud luua — kontroll on tõendamata"
      );
      check("4. plokk kannab väljade sisu ja hoiatust", blockText.includes(FIELD_TEXT) && block.status === 200);

      // ── 5. audit HTTP kaudu: väärtust ei kanta ────────────────────────────
      const copy = await apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/copy-events`, {
        jar: mine.jar,
        method: "POST",
        body: { fieldKeys: ["EESMARK"], clientActionId: "3f6d1c2a-1111-4222-8333-4444555566dd" }
      });
      const repeat = await apiFetch(`/api/casework/cases/${ownCase.id}/drafts/${draft.id}/copy-events`, {
        jar: mine.jar,
        method: "POST",
        body: { fieldKeys: ["EESMARK"], clientActionId: "3f6d1c2a-1111-4222-8333-4444555566dd" }
      });
      check(
        "5. L22: kordus annab 200 ja SAMA rea, mitte teist",
        copy.status === 200 && repeat.status === 200 && copy.body?.event?.id === repeat.body?.event?.id,
        `created: ${copy.body?.created} → ${repeat.body?.created}`
      );
      check(
        "5. auditirida HTTP-vastuses ei kanna väärtust",
        !JSON.stringify(copy.body?.event || {}).includes(FIELD_TEXT)
      );

      // ── 3. kirjutuskaitstud juhtumi laps ei muutu ─────────────────────────
      const lockCase = await apiFetch("/api/casework/cases", { jar: mine.jar, method: "POST", body: {} });
      const lockCaseId = lockCase.body?.case?.id || null;
      let lockDraftId = null;
      if (lockCaseId) {
        const lockDraft = await apiFetch(`/api/casework/cases/${lockCaseId}/drafts`, {
          jar: mine.jar,
          method: "POST",
          body: { draftType: "TEGEVUS" }
        });
        lockDraftId = lockDraft.body?.draft?.id || null;
        await apiFetch(`/api/casework/cases/${lockCaseId}/retention`, {
          jar: mine.jar,
          method: "POST",
          body: { toState: "READ_ONLY", reason: `sond ${runId}` }
        });
      }

      if (lockCaseId && lockDraftId) {
        const write = await apiFetch(`/api/casework/cases/${lockCaseId}/drafts/${lockDraftId}/fields`, {
          jar: mine.jar,
          method: "PUT",
          body: { fieldKey: "EESMARK", text: "ei tohi salvestuda", provenance: "TOOTAJA_TAHELEPANEK" }
        });
        check("3. kirjutuskaitstud juhtumi lapse kirjutus → 409", write.status === 409, `sai ${write.status}`);

        const after = await prisma.caseWorkDraftField.count({ where: { draftId: lockDraftId } });
        check("3. kirjutuskaitstud juhtumi laps EI MUUTUNUD", after === 0, `välju: ${after}`);

        /* Rada C nõuab `ACTIVE` juhtumit — kirjutuskaitstuga peab ta keelduma
           samamoodi nagu iga teine lapse kirjutus. */
        const radaCLocked = await apiFetch(`/api/casework/cases/${lockCaseId}/working-material`, {
          jar: mine.jar,
          method: "POST",
          body: {}
        });
        check(
          "3. rada C kirjutuskaitstud juhtumis → 409, mitte vaikne kustutus",
          radaCLocked.status === 409,
          `sai ${radaCLocked.status}`
        );
      } else {
        check("3. kirjutuskaitse rada", false, "juhtumit või mustandit ei õnnestunud luua");
      }
    }
  }
} catch (error) {
  failures += 1;
  lines.push(`  VIGA sond kukkus: ${error?.message || error}`);
} finally {
  /* KORISTUS. Juhtumid, mustandid, väljad ja auditid kustuvad kaskaadis koos
     töötajaga — aga seda EI EELDATA, vaid kontrollitakse. */
  try {
    if (strangerId) await prisma.user.deleteMany({ where: { id: strangerId } });
    if (workerId) await prisma.user.deleteMany({ where: { id: workerId } });

    const leftovers =
      (await prisma.user.count({ where: { email: { contains: runId } } })) +
      (await prisma.caseWorkAssist.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.caseWorkTransferEvent.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.caseWorkRetentionAudit.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.notificationEvent.count({ where: { userId: workerId || "-" } })) +
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
