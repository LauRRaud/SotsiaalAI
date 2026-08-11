#!/usr/bin/env node
/**
 * SOL-CALL-09 sond — PÄRIS PostgreSQL, mitte fake-Prisma.
 *
 * MIKS SEE FAIL OLEMAS ON. Leiu parandus toetub ühele lubadusele: salvestuse
 * elutsükli otsus ja tema TÕEND commit'ivad koos või mitte kumbki. `npm test`
 * mõõdab seda fake'i peal, kus tagasipööramine on minu enda kirjutatud tõmmise-
 * loogika — see tõendab mudelit, mitte andmebaasi. Atomaarsus on Postgresi
 * omadus ja teda peab mõõtma Postgresi peal.
 *
 * Sond mõõdab kolme asja:
 *   1. PÄRIS teenusekutse jätab maha KAKS rida (otsus + jälg);
 *   2. sama kuju tehing, mis kukub, ei jäta maha KUMBAGI;
 *   3. negatiivkontroll — vana kuju (kirjuta seis, siis neela audititõrge) jätab
 *      maha otsuse ilma jäljeta. See on vana koodi transkriptsioon, sest vana
 *      teostust ei ole enam olemas; silt on ausalt küljes.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { createCallService, createRecordingRequest } from "../lib/calls/service.js";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { users: [], calls: [], auditIds: [] };

async function auditRows(resourceId, action = null) {
  return prisma.dataAuditLog.findMany({
    where: { resourceType: "CallRecordingRequest", resourceId, ...(action ? { action } : {}) }
  });
}

async function main() {
  const suffix = randomUUID().slice(0, 8);

  try {
    for (const label of ["host", "guest"]) {
      created.users.push(await prisma.user.create({
        data: { email: `sol-call-09-${label}-${suffix}@probe.invalid`, role: "CLIENT" }
      }));
    }
    const [host, guest] = created.users;

    const call = await prisma.callSession.create({
      data: {
        contextType: "ROOM",
        contextId: `probe_audit_${suffix}`,
        provider: "MOCK",
        providerRoomName: `probe-audit-${suffix}`,
        mode: "AUDIO",
        status: "ACTIVE",
        startedByUserId: host.id,
        startedAt: new Date(),
        maxParticipants: 8
      }
    });
    created.calls.push(call);
    await prisma.callParticipant.create({
      data: { callSessionId: call.id, userId: host.id, role: "HOST", joinedAt: new Date() }
    });
    await prisma.callParticipant.create({
      data: { callSessionId: call.id, userId: guest.id, role: "PARTICIPANT", joinedAt: new Date() }
    });

    const service = createCallService({ prisma });

    // -----------------------------------------------------------------------
    // 1. TAOTLUS. Rida ja jälg tulevad koos.
    // -----------------------------------------------------------------------
    const request = await createRecordingRequest({
      prisma,
      callSessionId: call.id,
      userId: host.id,
      canModerate: true,
      requesterName: "Sond",
      purpose: "GENERAL_SUMMARY"
    });
    const requestedAudit = await auditRows(request.id, "CALL_RECORDING_REQUESTED");
    check("taotlus: rida on olemas", Boolean(request?.id));
    check("taotlus: jälg on olemas", requestedAudit.length === 1, `jälgi ${requestedAudit.length}`);

    // -----------------------------------------------------------------------
    // 2. NÕUSOLEKUOTSUS. Peatüki õiguslikult raskeim kirje.
    // -----------------------------------------------------------------------
    await service.respondToRecordingConsent({
      callSessionId: call.id,
      recordingRequestId: request.id,
      userId: guest.id,
      decision: "CONSENTED"
    });
    const consent = await prisma.callRecordingConsent.findFirst({
      where: { recordingRequestId: request.id, userId: guest.id }
    });
    const consentedAudit = await auditRows(request.id, "CALL_RECORDING_CONSENTED");
    check("nõusolek: otsus on kirjas", consent?.status === "CONSENTED", `staatus=${consent?.status}`);
    check("nõusolek: jälg on kirjas", consentedAudit.length === 1, `jälgi ${consentedAudit.length}`);

    // -----------------------------------------------------------------------
    // 3. ATOMAARSUS. Sama kuju tehing, mis kukub auditi JÄREL: kumbki pool ei
    //    tohi alles jääda. Just selle peale toetub kogu parandus.
    // -----------------------------------------------------------------------
    const rosterBefore = (await prisma.callSession.findFirst({ where: { id: call.id } }))?.rosterVersion ?? 0;
    let rollbackError = "";
    try {
      await prisma.$transaction(async tx => {
        await tx.callRecordingConsent.update({
          where: { id: consent.id },
          data: { status: "WITHDRAWN", withdrawnAt: new Date() }
        });
        await tx.callSession.updateMany({
          where: { id: call.id },
          data: { rosterVersion: { increment: 1 } }
        });
        await tx.dataAuditLog.create({
          data: {
            actorUserId: guest.id,
            action: "CALL_RECORDING_WITHDRAWN",
            resourceType: "CallRecordingRequest",
            resourceId: request.id,
            meta: { callSessionId: call.id, probe: true }
          }
        });
        throw new Error("audit_transaction_failed");
      });
    } catch (error) {
      rollbackError = error?.message || "";
    }
    const afterRollback = await prisma.callRecordingConsent.findFirst({ where: { id: consent.id } });
    const withdrawnAudit = await auditRows(request.id, "CALL_RECORDING_WITHDRAWN");
    const rosterAfter = (await prisma.callSession.findFirst({ where: { id: call.id } }))?.rosterVersion ?? 0;
    check("atomaarsus: tehing kukkus ootuspäraselt", rollbackError === "audit_transaction_failed", rollbackError);
    check(
      "atomaarsus: otsus EI jõustunud",
      afterRollback?.status === "CONSENTED",
      `staatus=${afterRollback?.status}`
    );
    check("atomaarsus: jälge ei tekkinud", withdrawnAudit.length === 0, `jälgi ${withdrawnAudit.length}`);
    check("atomaarsus: koosseisu loend ei liikunud", rosterAfter === rosterBefore, `${rosterBefore} → ${rosterAfter}`);

    // -----------------------------------------------------------------------
    // 4. NEGATIIVKONTROLL — vana kuju: kirjuta seis, siis neela audititõrge.
    //    Transkriptsioon, mitte vana kood: vana teostust ei ole enam olemas.
    // -----------------------------------------------------------------------
    console.log("[SOL-CALL-09 sond] järgnev prisma:error on TAOTLETUD — negatiivkontroll vajab kukkuvat auditikirjutust.\n");
    await prisma.callRecordingConsent.update({
      where: { id: consent.id },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() }
    });
    const legacyAuditWrite = await prisma.dataAuditLog
      .create({ data: { action: null, resourceType: "CallRecordingRequest", resourceId: request.id } })
      .catch(() => null); // täpselt see `.catch(() => null)`, mis leiu tekitas
    const legacyConsent = await prisma.callRecordingConsent.findFirst({ where: { id: consent.id } });
    const legacyAudit = await auditRows(request.id, "CALL_RECORDING_WITHDRAWN");
    check(
      "negatiivkontroll: vana kuju jätab otsuse ilma jäljeta",
      legacyAuditWrite === null && legacyConsent?.status === "WITHDRAWN" && legacyAudit.length === 0,
      `staatus=${legacyConsent?.status}, jälgi ${legacyAudit.length}`
    );

    // -----------------------------------------------------------------------
    // 5. TÜHISTUS läbi teenuse: rida ja jälg jälle koos.
    // -----------------------------------------------------------------------
    await prisma.callRecordingConsent.update({
      where: { id: consent.id },
      data: { status: "REQUESTED", withdrawnAt: null }
    });
    await prisma.callRecordingRequest.update({ where: { id: request.id }, data: { status: "REQUESTED" } });
    const cancelled = await service.cancelRecordingRequest({
      callSessionId: call.id,
      recordingRequestId: request.id,
      userId: host.id,
      canModerate: true
    });
    const cancelledAudit = await auditRows(request.id, "CALL_RECORDING_CANCELLED");
    check("tühistus: taotlus on STOPPED", cancelled?.status === "STOPPED", `staatus=${cancelled?.status}`);
    check("tühistus: jälg on kirjas", cancelledAudit.length === 1, `jälgi ${cancelledAudit.length}`);

    const allAudits = await auditRows(request.id);
    created.auditIds.push(...allAudits.map(row => row.id));
  } finally {
    if (created.auditIds.length) {
      await prisma.dataAuditLog.deleteMany({ where: { id: { in: created.auditIds } } }).catch(() => null);
    }
    for (const call of created.calls) {
      const requests = await prisma.callRecordingRequest.findMany({ where: { callSessionId: call.id } }).catch(() => []);
      for (const request of requests) {
        await prisma.dataAuditLog.deleteMany({
          where: { resourceType: "CallRecordingRequest", resourceId: request.id }
        }).catch(() => null);
        await prisma.callRecordingConsent.deleteMany({ where: { recordingRequestId: request.id } }).catch(() => null);
        await prisma.callRecordingFile.deleteMany({ where: { recordingRequestId: request.id } }).catch(() => null);
        await prisma.callRecordingRequest.delete({ where: { id: request.id } }).catch(() => null);
      }
      await prisma.callParticipant.deleteMany({ where: { callSessionId: call.id } }).catch(() => null);
      await prisma.callSession.delete({ where: { id: call.id } }).catch(() => null);
    }
    for (const user of created.users) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-CALL-09 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-CALL-09 sond] katkes:", error);
  process.exit(1);
});
