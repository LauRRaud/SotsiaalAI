#!/usr/bin/env node
/**
 * SOL-CALL-05 sond — PÄRIS PostgreSQL, mitte fake-Prisma.
 *
 * MIKS SEE FAIL OLEMAS ON. `npm test` jookseb fake-Prisma peal, mis ei jõusta ühtegi
 * piirangut: seal on „üks rida osaleja kohta" testi enda lubadus, mitte andmebaasi oma.
 * Sama klass tabas 09.08 SOL-SCHEMA-01-t (mudel ei kandnud NOT NULL veergu ja KÕIK
 * kolm väravat olid rohelised). Ainus koht, kus liitunikaalsust saab tõendada, on
 * päris andmebaas.
 *
 * Sond kirjutab ja koristab enda järelt: kaks kasutajat, kõne, taotlus, nõusolekud.
 * Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const created = { users: [], call: null, request: null };

  try {
    for (const role of ["host", "guest"]) {
      const user = await prisma.user.create({
        data: {
          email: `sol-call-05-${role}-${suffix}@probe.invalid`,
          role: "CLIENT"
        }
      });
      created.users.push(user);
    }
    const [host, guest] = created.users;

    created.call = await prisma.callSession.create({
      data: {
        contextType: "ROOM",
        contextId: `probe_${suffix}`,
        provider: "MOCK",
        providerRoomName: `probe-${suffix}`,
        mode: "AUDIO",
        status: "ACTIVE",
        startedByUserId: host.id,
        startedAt: new Date(),
        maxParticipants: 8
      }
    });

    created.request = await prisma.callRecordingRequest.create({
      data: {
        callSessionId: created.call.id,
        requestedByUserId: host.id,
        purpose: "GENERAL_SUMMARY",
        status: "REQUESTED",
        consentTextVersion: "probe",
        consentTextSnapshot: "probe",
        requestedAt: new Date()
      }
    });

    const consentData = userId => ({
      recordingRequestId: created.request.id,
      callSessionId: created.call.id,
      userId,
      status: "REQUESTED",
      consentTextVersion: "probe",
      consentTextSnapshot: "probe"
    });

    const first = await prisma.callRecordingConsent.create({ data: consentData(guest.id) });
    check("esimene nõusolekurida luuakse", Boolean(first?.id));

    // 1) KANDEV KONTROLL: duplikaat peab põrkama andmebaasi vastu.
    let duplicateCode = "";
    try {
      await prisma.callRecordingConsent.create({ data: consentData(guest.id) });
    } catch (error) {
      duplicateCode = error?.code || error?.meta?.code || "";
    }
    check(
      "duplikaat (sama taotlus + sama inimene) põrkab unikaalindeksi vastu",
      duplicateCode === "P2002",
      `kood=${duplicateCode || "(viga puudus)"}`
    );

    // 2) NEGATIIVKONTROLL: piirang ei tohi olla liiga lai — teine inimene peab mahtuma.
    const other = await prisma.callRecordingConsent.create({ data: consentData(host.id) });
    check("teine inimene sama taotluse all mahub", Boolean(other?.id));

    // 3) Upsert on idempotentne ja EI keera antud otsust tagasi.
    await prisma.callRecordingConsent.update({
      where: { id: first.id },
      data: { status: "CONSENTED", respondedAt: new Date() }
    });
    const upserted = await prisma.callRecordingConsent.upsert({
      where: {
        recordingRequestId_userId: {
          recordingRequestId: created.request.id,
          userId: guest.id
        }
      },
      create: consentData(guest.id),
      update: {}
    });
    check("upsert tabab olemasoleva rea", upserted.id === first.id);
    check("upsert ei keera antud nõusolekut REQUESTED-iks", upserted.status === "CONSENTED", `staatus=${upserted.status}`);

    const rows = await prisma.callRecordingConsent.count({
      where: { recordingRequestId: created.request.id }
    });
    check("kokku kaks rida, mitte kolm", rows === 2, `ridu=${rows}`);

    /* 4) PARALLEELTEST — kriteeriumi kandev osa. Kaks samaaegset upsert'i sama
       inimese kohta: nii käitub päris süsteem, kus liitumine ja nõusolekuvastus
       jõuavad korraga. Mõõdame kaht asja: mitu rida tekkis JA kas mõni kutse
       lendas erindiga välja (viimane tähendaks, et kutsuja peab P2002 ise püüdma). */
    const third = await prisma.user.create({
      data: { email: `sol-call-05-race-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.users.push(third);
    const raceUpsert = () => prisma.callRecordingConsent.upsert({
      where: {
        recordingRequestId_userId: {
          recordingRequestId: created.request.id,
          userId: third.id
        }
      },
      create: consentData(third.id),
      update: {}
    });
    const raced = await Promise.allSettled([raceUpsert(), raceUpsert(), raceUpsert()]);
    const rejected = raced.filter(entry => entry.status === "rejected");
    const raceRows = await prisma.callRecordingConsent.count({
      where: { recordingRequestId: created.request.id, userId: third.id }
    });
    check("kolm paralleelset upsert'i annavad ÜHE rea", raceRows === 1, `ridu=${raceRows}`);
    check(
      "ükski paralleelne upsert ei lenda erindiga välja",
      rejected.length === 0,
      rejected.length ? `tõrkeid=${rejected.length}, esimene=${rejected[0].reason?.code || rejected[0].reason?.message}` : ""
    );
  } finally {
    if (created.request) {
      await prisma.callRecordingConsent.deleteMany({ where: { recordingRequestId: created.request.id } }).catch(() => null);
      await prisma.callRecordingRequest.delete({ where: { id: created.request.id } }).catch(() => null);
    }
    if (created.call) await prisma.callSession.delete({ where: { id: created.call.id } }).catch(() => null);
    for (const user of created.users) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-CALL-05 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-CALL-05 sond] katkes:", error);
  process.exit(1);
});
