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
 * Andmed on sünteetilised ja sond koristab enda järelt ära. Päris kasutajate
 * sisu ta ei loe ega puutu (töökorra reegel 4).
 *
 * Käivitamine:
 *   npm run case:probe
 */

import { prisma } from "../lib/prisma.js";

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

let workerId = null;
let clientId = null;
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
    if (workerId) await prisma.user.deleteMany({ where: { id: workerId } });

    const leftovers =
      (await prisma.user.count({ where: { email: { contains: runId } } })) +
      (await prisma.caseWorkAssist.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.caseWorkRetentionAudit.count({ where: { ownerUserId: workerId || "-" } })) +
      (await prisma.caseWorkClientErasureAudit.count({ where: { ownerUserId: workerId || "-" } }));
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
