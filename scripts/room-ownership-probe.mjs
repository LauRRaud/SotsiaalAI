#!/usr/bin/env node
/**
 * SOL-ROOM-04 ja SOL-ROOM-05 — omanikuvahetus päris PostgreSQL-is.
 *
 *   npm run room:owner:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa.
 *
 *   Leid ON kahe kirjutaja põimumine: „lahkuja loeb MEMBER → transfer teeb temast OWNER →
 *   lahkuja kirjutab leftAt" jättis ruumi ilma ühegi aktiivse OWNER-ita. Fake-Prisma
 *   `$transaction` on lihtsalt funktsioonikutse — seal ei ole lukku, mille peale võistlus
 *   üldse tekiks, ja iga selline test oleks roheline ka ilma paranduseta.
 *
 *   Võistlus on DETERMINISTLIK, mitte „mahtus ühte sekundisse": kolmas tehing hoiab ruumi
 *   nõuandelukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad, ja alles
 *   siis lastakse lukk lahti (`scripts/probe-race-harness.mjs`).
 *
 *   Mõõdetav invariant ei ole „kes võitis", vaid: **ruumil on täpselt üks aktiivne OWNER ja
 *   `Room.ownerId` näitab aktiivse liikme peale** — mõlemas järjekorras.
 *
 * NEGATIIVKONTROLL jooksutab VANA raja (loe → koristus → tingimusteta kirjutus) sama
 * andmebaasi vastu ja nõuab, et ta selle invariandi RIKUKS.
 *
 * SOL-ROOM-05 osa: audit kuulub siirdega samasse tehingusse. Sond süstib auditikirjutusse
 * vea ja nõuab, et KOGU siire rulluks tagasi — varem andis audititõrge 500 juba tehtud
 * omanikuvahetuse kohta.
 *
 * Andmed: ainult `@sol-room-owner.invalid` kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { leaveRoom, lockRoom, transferRoomOwnership } from "../lib/rooms/ownership.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const SUFFIX = "@sol-room-owner.invalid";

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));

const tag = () => Math.random().toString(36).slice(2, 10);

async function makeUser(role = "SOCIAL_WORKER") {
  return prisma.user.create({
    data: {
      email: `member-${tag()}${SUFFIX}`,
      role,
      emailVerified: new Date()
    }
  });
}

/** Ruum ühe omaniku ja ühe tavaliikmega — täpselt leiu lähteseis. */
async function makeRoom() {
  const owner = await makeUser();
  const target = await makeUser();
  const room = await prisma.room.create({
    data: {
      ownerId: owner.id,
      title: `Sond ${tag()}`,
      members: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: target.id, role: "MEMBER" }
        ]
      }
    }
  });
  return { room, owner, target };
}

/** „Kas ruumil on aktiivne omanik?" — see ON leiu invariant. */
async function ownershipState(roomId) {
  const room = await prisma.room.findUnique({ where: { id: roomId }, select: { ownerId: true } });
  const members = await prisma.roomMember.findMany({
    where: { roomId },
    select: { userId: true, role: true, leftAt: true }
  });
  const activeOwners = members.filter((m) => m.role === "OWNER" && m.leftAt === null);
  const ownerRow = members.find((m) => m.userId === room?.ownerId);
  return {
    ownerId: room?.ownerId || null,
    activeOwnerCount: activeOwners.length,
    ownerIsActiveMember: Boolean(ownerRow && ownerRow.leftAt === null),
    members
  };
}

const auditCount = (roomId) =>
  prisma.dataAuditLog.count({
    where: { resourceType: "Room", resourceId: roomId, action: "ROOM_OWNERSHIP_TRANSFERRED" }
  });

async function purge() {
  const users = await prisma.user.findMany({
    where: { email: { endsWith: SUFFIX } },
    select: { id: true }
  });
  const ids = users.map((row) => row.id);
  if (!ids.length) return;
  const rooms = await prisma.room.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const roomIds = rooms.map((row) => row.id);
  if (roomIds.length) {
    await prisma.dataAuditLog.deleteMany({ where: { resourceType: "Room", resourceId: { in: roomIds } } });
    await prisma.roomMember.deleteMany({ where: { roomId: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
  }
  await prisma.dataAuditLog.deleteMany({ where: { actorUserId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

async function main() {
  console.log("SOL-ROOM-04/-05 — omanikuvahetuse võistlus päris andmebaasis\n");
  await purge();

  // === 1. BAASJOON ========================================================
  {
    const { room, owner, target } = await makeRoom();
    const before = await ownershipState(room.id);
    expect("baasjoon: ruumil on täpselt üks aktiivne omanik", before.activeOwnerCount === 1 && before.ownerId === owner.id);

    const outcome = await transferRoomOwnership({
      db: prisma,
      roomId: room.id,
      actorUserId: owner.id,
      targetUserId: target.id
    });
    const after = await ownershipState(room.id);
    expect("üleandmine annab omandi aktiivsele liikmele", outcome.ok === true && after.ownerId === target.id);
    expect("pärast üleandmist on ikka täpselt üks aktiivne omanik", after.activeOwnerCount === 1 && after.ownerIsActiveMember);
    expect("audit sündis koos siirdega", (await auditCount(room.id)) === 1);
  }

  // === 2. VÕISTLUS: TRANSFER ENNE LAHKUMIST ===============================
  for (const order of ["transfer-first", "leave-first"]) {
    const { room, owner, target } = await makeRoom();

    const transfer = () =>
      transferRoomOwnership({
        db: prisma,
        roomId: room.id,
        actorUserId: owner.id,
        targetUserId: target.id
      }).catch((error) => (error?.roomTransferConflict ? { ok: false, status: 409 } : Promise.reject(error)));
    const leave = () => leaveRoom({ db: prisma, roomId: room.id, userId: target.id });

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: (tx) => lockRoom(tx, room.id),
      first: order === "transfer-first" ? transfer : leave,
      second: order === "transfer-first" ? leave : transfer,
      label: order,
      expect
    });

    const state = await ownershipState(room.id);
    expect(
      `${order}: ruumil on TÄPSELT ÜKS aktiivne omanik`,
      state.activeOwnerCount === 1,
      JSON.stringify(state)
    );
    expect(
      `${order}: Room.ownerId näitab AKTIIVSE liikme peale`,
      state.ownerIsActiveMember === true,
      JSON.stringify(state)
    );
    expect(
      `${order}: kumbki võistleja ei visanud tundmatut viga`,
      !resultA.error && !resultB.error,
      String(resultA.error || resultB.error || "")
    );
    // Audit tekib täpselt siis, kui siire päriselt toimus.
    const transferred = state.ownerId === target.id;
    expect(
      `${order}: auditijälg vastab tegelikule tulemusele`,
      (await auditCount(room.id)) === (transferred ? 1 : 0)
    );
  }

  // === 3. NEGATIIVKONTROLL: VANA RADA =====================================
  {
    const { room, owner, target } = await makeRoom();

    // Vana lahkumine: loe roll, tee koristus, kirjuta leftAt TINGIMUSTETA.
    const legacyLeave = async () => {
      const membership = await prisma.roomMember.findFirst({
        where: { roomId: room.id, userId: target.id, leftAt: null },
        select: { role: true }
      });
      if (!membership || membership.role === "OWNER") return { ok: false };
      // Vana omanikuvahetus jõuab siia vahele — tema loeb sihtmärgi „aktiivseks".
      await legacyTransfer();
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId: room.id, userId: target.id } },
        data: { leftAt: new Date() }
      });
      return { ok: true };
    };

    // Vana omanikuvahetus: rollikirjutus ilma `leftAt` tingimuseta ja ilma count-kontrollita.
    const legacyTransfer = async () => {
      const targetRow = await prisma.roomMember.findFirst({
        where: { roomId: room.id, userId: target.id, leftAt: null }
      });
      if (!targetRow) return { ok: false };
      await prisma.$transaction(async (tx) => {
        await tx.room.updateMany({ where: { id: room.id, ownerId: owner.id }, data: { ownerId: target.id } });
        await tx.roomMember.updateMany({ where: { roomId: room.id, userId: target.id }, data: { role: "OWNER" } });
        await tx.roomMember.updateMany({ where: { roomId: room.id, userId: owner.id }, data: { role: "MODERATOR" } });
      });
      return { ok: true };
    };

    await legacyLeave();
    const state = await ownershipState(room.id);
    expect(
      "VANA rada: ruum jääb ILMA aktiivse omanikuta",
      state.activeOwnerCount === 0 && state.ownerIsActiveMember === false,
      JSON.stringify(state)
    );
    expect("VANA rada: vana omanik on alandatud MODERATOR-iks", state.members.find((m) => m.userId === owner.id)?.role === "MODERATOR");
  }

  // === 4. SOL-ROOM-05: AUDIT KUULUB SAMASSE TEHINGUSSE =====================
  {
    const { room, owner, target } = await makeRoom();

    // Süstitud viga täpselt auditikirjutusse; kõik muu on päris.
    const brokenAuditDb = {
      $transaction: (fn, options) =>
        prisma.$transaction(
          (tx) =>
            fn(
              new Proxy(tx, {
                get(inner, prop) {
                  if (prop === "dataAuditLog") {
                    return { create: async () => { throw new Error("audit down"); } };
                  }
                  const value = inner[prop];
                  return typeof value === "function" ? value.bind(inner) : value;
                }
              })
            ),
          options
        )
    };

    let threw = false;
    try {
      await transferRoomOwnership({
        db: brokenAuditDb,
        roomId: room.id,
        actorUserId: owner.id,
        targetUserId: target.id
      });
    } catch (error) {
      threw = String(error?.message || "").includes("audit down");
    }

    const state = await ownershipState(room.id);
    expect("audititõrge jõuab kutsujani", threw === true);
    expect("audititõrge ROLLBACK'ib kogu siirde", state.ownerId === owner.id, JSON.stringify(state));
    expect("audititõrke järel ei ole poolikut rolli", state.members.find((m) => m.userId === target.id)?.role === "MEMBER");
    expect("audititõrke järel ei ole auditirida", (await auditCount(room.id)) === 0);
  }

  await purge();

  console.log(`\n  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error("PROBE_FAIL");
    process.exitCode = 1;
  } else {
    console.log(`PROBE_OK ${passed}/${passed}`);
  }
}

main()
  .catch(async (error) => {
    console.error("PROBE_ERROR", error);
    process.exitCode = 1;
    await purge().catch(() => {});
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });
