#!/usr/bin/env node
/**
 * SOL-CALL-08 sond — PÄRIS PostgreSQL, mitte fake-Prisma.
 *
 * MIKS SEE FAIL OLEMAS ON. Leiu kaks poolt on mõlemad sellised, mida `npm test`
 * oma olemuselt ei tõenda:
 *
 *   1. OSALEJAPIIR on nõuandelukk, mitte tingimuslik kirjutus. Fake-Prismal ei ole
 *      `pg_advisory_xact_lock`-i; testis on ta mudel (võtmepõhine mutex), mille
 *      kirjutasin ise. Ise kirjutatud lukk tõendab iseennast, mitte Postgrest.
 *   2. TEHINGU TAGASIPÖÖRAMINE on andmebaasi omadus. Fake pöörab tagasi tõmmise
 *      järgi — see on mudel, mitte tõend.
 *
 * Võistlus on DETERMINISTLIK (`scripts/probe-race-harness.mjs`): kolmas tehing
 * hoiab sama nõuandelukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad
 * ootavad, alles siis lastakse lukk lahti. `Promise.all` üksi tõendaks ainult
 * seda, et kaks asja mahtusid ühte sekundisse.
 *
 * NEGATIIVKONTROLL on vana koodi TRANSKRIPTSIOON (loe arv → loo rida ilma lukuta),
 * sest vana teostust ei ole enam olemas. Silt on ausalt küljes.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { createCallService, lockCall } from "../lib/calls/service.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { users: [], calls: [] };

async function makeUser(label, suffix) {
  const user = await prisma.user.create({
    data: { email: `sol-call-08-${label}-${suffix}@probe.invalid`, role: "CLIENT" }
  });
  created.users.push(user);
  return user;
}

async function makeCall({ suffix, label, hostId, maxParticipants }) {
  const call = await prisma.callSession.create({
    data: {
      contextType: "ROOM",
      contextId: `probe_${label}_${suffix}`,
      provider: "MOCK",
      providerRoomName: `probe-${label}-${suffix}`,
      mode: "AUDIO",
      status: "ACTIVE",
      startedByUserId: hostId,
      startedAt: new Date(),
      maxParticipants
    }
  });
  created.calls.push(call);
  await prisma.callParticipant.create({
    data: { callSessionId: call.id, userId: hostId, role: "HOST", joinedAt: new Date() }
  });
  return call;
}

async function activeCount(callSessionId) {
  return prisma.callParticipant.count({ where: { callSessionId, leftAt: null } });
}

async function main() {
  const suffix = randomUUID().slice(0, 8);

  try {
    const host = await makeUser("host", suffix);
    const first = await makeUser("first", suffix);
    const second = await makeUser("second", suffix);

    // ---------------------------------------------------------------------
    // 1. VIIMANE KOHT. Piir on 2, host on sees → vaba on täpselt üks koht.
    // ---------------------------------------------------------------------
    const service = createCallService({ prisma });
    const contested = await makeCall({ suffix, label: "seat", hostId: host.id, maxParticipants: 2 });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: tx => lockCall(tx, contested.id),
      first: () => service.joinCall({ callSessionId: contested.id, userId: first.id }),
      second: () => service.joinCall({ callSessionId: contested.id, userId: second.id }),
      label: "viimane koht",
      expect: (name, condition, detail) => check(name, condition, detail)
    });

    const winners = [resultA, resultB].filter(result => !result.error);
    const losers = [resultA, resultB].filter(result => result.error);
    check("viimane koht: täpselt üks liituja mahub", winners.length === 1, `võitjaid ${winners.length}`);
    check(
      "viimane koht: kaotaja saab call.participants_full",
      losers.length === 1 && /call\.participants_full/.test(String(losers[0]?.error?.message)),
      losers.length ? String(losers[0]?.error?.message) : "kaotajat ei olnud"
    );
    const seatedAfterRace = await activeCount(contested.id);
    check("viimane koht: aktiivseid osalejaid on täpselt 2", seatedAfterRace === 2, `osalejaid ${seatedAfterRace}`);

    // Kordusliitumine ei tohi teist kohta võtta (idempotentsus). Võitja loetakse
    // andmebaasist, mitte oletatakse — lukujärjekord otsustab, kumb sisse sai.
    const seated = await prisma.callParticipant.findFirst({
      where: { callSessionId: contested.id, leftAt: null, userId: { not: host.id } }
    });
    await service.joinCall({ callSessionId: contested.id, userId: seated.userId }).catch(() => null);
    const seatedAfterRejoin = await activeCount(contested.id);
    check("kordusliitumine ei kasvata osalejate arvu", seatedAfterRejoin === 2, `osalejaid ${seatedAfterRejoin}`);

    // ---------------------------------------------------------------------
    // 2. NEGATIIVKONTROLL — vana koodi transkriptsioon: loe arv, siis loo rida.
    //    Aken on siin nähtav ja deterministlik: MÕLEMAD loevad enne, kui kumbki
    //    kirjutab. Täpselt see jada elas vanas `joinCall`-is.
    // ---------------------------------------------------------------------
    const legacyHost = await makeUser("legacy-host", suffix);
    const legacyA = await makeUser("legacy-a", suffix);
    const legacyB = await makeUser("legacy-b", suffix);
    const legacyCall = await makeCall({ suffix, label: "legacy", hostId: legacyHost.id, maxParticipants: 2 });

    const legacyCountA = await activeCount(legacyCall.id);
    const legacyCountB = await activeCount(legacyCall.id);
    const legacyJoin = async (userId, seen) => {
      if (seen >= legacyCall.maxParticipants) return false;
      await prisma.callParticipant.create({
        data: { callSessionId: legacyCall.id, userId, role: "PARTICIPANT", joinedAt: new Date() }
      });
      return true;
    };
    const legacyAdmitted = [
      await legacyJoin(legacyA.id, legacyCountA),
      await legacyJoin(legacyB.id, legacyCountB)
    ].filter(Boolean).length;
    const legacySeated = await activeCount(legacyCall.id);
    check(
      "negatiivkontroll: vana jada laseb MÕLEMAD sisse ja ületab piiri",
      legacyAdmitted === 2 && legacySeated === 3,
      `sisse ${legacyAdmitted}, osalejaid ${legacySeated}, piir 2`
    );

    // ---------------------------------------------------------------------
    // 3. KÕNE SÜNNIB TERVIKUNA. Providerinimi ja HOST tulevad ühe commit'iga.
    // ---------------------------------------------------------------------
    const startContextId = `probe_start_${suffix}`;
    const startedCall = await service.startContextCall({
      contextType: "COVISION",
      contextId: startContextId,
      userId: host.id
    });
    created.calls.push(startedCall);
    check(
      "start: providerinimi on kohe olemas ja kannab kõne id-d",
      startedCall.providerRoomName.includes(startedCall.id),
      `nimi=${startedCall.providerRoomName}`
    );
    const startedHost = await prisma.callParticipant.findFirst({
      where: { callSessionId: startedCall.id, userId: host.id, leftAt: null }
    });
    check("start: alustaja on HOST juba esimesel lugemisel", startedHost?.role === "HOST", `roll=${startedHost?.role}`);

    // ---------------------------------------------------------------------
    // 4. TAGASIPÖÖRAMINE ON ANDMEBAASI OMA. Sama tehingukuju, tõrge HOST-sammul.
    //    Vana kolmesammuline loomine jättis siia ACTIVE kõne ilma hostita.
    // ---------------------------------------------------------------------
    const rollbackContextId = `probe_rollback_${suffix}`;
    const rollbackId = randomUUID();
    let rollbackError = "";
    try {
      await prisma.$transaction(async tx => {
        await tx.callSession.create({
          data: {
            id: rollbackId,
            contextType: "COVISION",
            contextId: rollbackContextId,
            provider: "MOCK",
            providerRoomName: `probe-rollback-${suffix}`,
            mode: "AUDIO",
            status: "ACTIVE",
            startedByUserId: host.id,
            startedAt: new Date(),
            maxParticipants: 8
          }
        });
        throw new Error("host_step_failed");
      });
    } catch (error) {
      rollbackError = error?.message || "";
    }
    const orphan = await prisma.callSession.findFirst({ where: { id: rollbackId } });
    check("rollback: tõrge HOST-sammul ei jäta maha ühtki kõnerida", rollbackError === "host_step_failed" && !orphan);

    // ---------------------------------------------------------------------
    // 5. VANA TÜHJA PROVIDERINIMEGA RIDA paraneb esimesel puutumisel.
    // ---------------------------------------------------------------------
    const legacyNameContextId = `probe_name_${suffix}`;
    const legacyNameCall = await prisma.callSession.create({
      data: {
        contextType: "COVISION",
        contextId: legacyNameContextId,
        provider: "MOCK",
        providerRoomName: "",
        mode: "AUDIO",
        status: "ACTIVE",
        startedByUserId: host.id,
        startedAt: new Date(),
        maxParticipants: 8
      }
    });
    created.calls.push(legacyNameCall);
    const repaired = await service.startContextCall({
      contextType: "COVISION",
      contextId: legacyNameContextId,
      userId: host.id
    });
    const repairedRow = await prisma.callSession.findFirst({ where: { id: legacyNameCall.id } });
    check("parandus: tagastatud kõne on sama rida", repaired.id === legacyNameCall.id);
    check(
      "parandus: tühi providerinimi täidetakse andmebaasis",
      Boolean(repairedRow?.providerRoomName) && repairedRow.providerRoomName.includes(legacyNameCall.id),
      `nimi=${repairedRow?.providerRoomName || "(tühi)"}`
    );
  } finally {
    for (const call of created.calls) {
      await prisma.callParticipant.deleteMany({ where: { callSessionId: call.id } }).catch(() => null);
      await prisma.callSpeakRequest.deleteMany({ where: { callSessionId: call.id } }).catch(() => null);
      await prisma.callSession.delete({ where: { id: call.id } }).catch(() => null);
    }
    for (const user of created.users) {
      await prisma.user.delete({ where: { id: user.id } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-CALL-08 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-CALL-08 sond] katkes:", error);
  process.exit(1);
});
