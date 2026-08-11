#!/usr/bin/env node
/**
 * SOL-INV-01 sond — PÄRIS PostgreSQL, mitte fake-tx.
 *
 * KRITEERIUM SÕNA-SÕNALT: „Päris PostgreSQLi test peab saatma vähemalt kaks eri
 * kutset paralleelselt seisus 49/50 ning tõendama täpselt ühe liikmesuse ja ühe
 * sponsoreeritud tellimuse aktiveerimise."
 *
 * MIKS FAKE EI PIISA. Piir „50 sponsoreeritud kohta" ei ole ühegi rea omadus:
 * teda ei saa jõustada unikaalindeksi ega tingimusliku kirjutusega, ainult
 * serialiseerimisega. Fake-tx on üks lõim ja tema „lukk" on minu enda kirjutatud
 * loendur — ta tõendab, et `lockRoom` KUTSUTAKSE, mitte et Postgres kedagi ootama
 * paneb.
 *
 * Võistlus on DETERMINISTLIK (`scripts/probe-race-harness.mjs`): kolmas tehing
 * hoiab sama ruumi nõuandelukku, mõlemad vastuvõtjad käivitatakse ja MÕÕDETAKSE,
 * et nad ootavad, alles siis lastakse lukk lahti.
 *
 * NEGATIIVKONTROLL on vana kuju TRANSKRIPTSIOON (loe arv → kirjuta ilma lukuta),
 * sest vana teostust ei ole enam olemas. Silt on ausalt küljes.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { SPONSORED_MEMBER_LIMIT, acceptInviteWithinTx } from "../lib/invites/acceptInviteCore.js";
import { lockRoom } from "../lib/rooms/ownership.js";
import { raceOnLockedRow } from "./probe-race-harness.mjs";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], roomIds: [] };

async function makeUser(email) {
  const user = await prisma.user.create({ data: { email, role: "CLIENT" } });
  created.userIds.push(user.id);
  return user;
}

async function makeRoom(ownerId, title) {
  const room = await prisma.room.create({
    data: { ownerId, title, originType: "MANUAL_INVITE", originLabel: "sond" }
  });
  created.roomIds.push(room.id);
  return room;
}

/** Täidab ruumi nii, et vaba on TÄPSELT üks sponsorkoht. */
async function fillToLastSeat(roomId, fillerIds) {
  await prisma.roomMember.createMany({
    data: fillerIds.map(userId => ({
      roomId,
      userId,
      role: "MEMBER",
      billingSource: "SPONSORED_BY_HOST",
      joinedAt: new Date()
    }))
  });
  return prisma.roomMember.count({
    where: { roomId, billingSource: "SPONSORED_BY_HOST", leftAt: null }
  });
}

async function makeInvite(roomId, inviterId, email) {
  return prisma.invite.create({
    data: {
      roomId,
      inviterId,
      inviteeEmail: email,
      tokenHash: randomUUID(),
      status: "SENT",
      paymentMode: "SPONSORED_BY_HOST",
      sponsoredByUserId: inviterId,
      sponsoredPaidAt: new Date(),
      expiresAt: new Date(Date.now() + 3_600_000),
      maxUses: 1,
      useCount: 0
    }
  });
}

/** Täpselt see, mida marsruut teeb: kutse rida FOR UPDATE + jagatud tuum. */
function acceptAsRoute(inviteId, user) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM "Invite" WHERE "id" = ${inviteId} FOR UPDATE`;
    const invite = await tx.invite.findUnique({ where: { id: inviteId }, include: { room: true } });
    return acceptInviteWithinTx({
      tx,
      invite,
      auth: { userId: user.id, role: "CLIENT", isAdmin: false, email: user.email },
      userEmail: user.email,
      displayName: null,
      now: new Date()
    });
  }, { timeout: 30000 });
}

async function sponsoredCount(roomId) {
  return prisma.roomMember.count({
    where: { roomId, billingSource: "SPONSORED_BY_HOST", leftAt: null }
  });
}

async function main() {
  const suffix = randomUUID().slice(0, 8);

  try {
    const owner = await makeUser(`sol-inv-01-owner-${suffix}@probe.invalid`);

    // Täitematerjal: SPONSORED_MEMBER_LIMIT - 1 inimest, keda saab mõlemas ruumis
    // uuesti kasutada (üks inimene tohib olla mitme ruumi liige).
    const fillers = [];
    for (let index = 0; index < SPONSORED_MEMBER_LIMIT - 1; index += 1) {
      fillers.push(await makeUser(`sol-inv-01-fill-${index}-${suffix}@probe.invalid`));
    }
    const fillerIds = fillers.map(user => user.id);

    // -------------------------------------------------------------------
    // 1. VÕISTLUS VIIMASE SPONSORKOHA PÄRAST — kaks ERI kutset, üks ruum.
    // -------------------------------------------------------------------
    const room = await makeRoom(owner.id, `sond ${suffix}`);
    const seated = await fillToLastSeat(room.id, fillerIds);
    check(
      "algseis on 49/50",
      seated === SPONSORED_MEMBER_LIMIT - 1,
      `${seated}/${SPONSORED_MEMBER_LIMIT}`
    );

    const racerA = await makeUser(`sol-inv-01-a-${suffix}@probe.invalid`);
    const racerB = await makeUser(`sol-inv-01-b-${suffix}@probe.invalid`);
    const inviteA = await makeInvite(room.id, owner.id, racerA.email);
    const inviteB = await makeInvite(room.id, owner.id, racerB.email);

    const { resultA, resultB } = await raceOnLockedRow({
      prisma,
      lockRow: tx => lockRoom(tx, room.id),
      first: () => acceptAsRoute(inviteA.id, racerA),
      second: () => acceptAsRoute(inviteB.id, racerB),
      label: "viimane sponsorkoht",
      expect: (name, condition, detail) => check(name, condition, detail)
    });

    const winners = [resultA, resultB].filter(result => !result.error);
    const losers = [resultA, resultB].filter(result => result.error);
    check("võistlus: täpselt üks vastuvõtt õnnestub", winners.length === 1, `võitjaid ${winners.length}`);
    check(
      "võistlus: kaotaja saab SPONSOR_CAPACITY_FULL",
      losers.length === 1 && losers[0].error?.code === "SPONSOR_CAPACITY_FULL",
      losers.length ? String(losers[0].error?.code || losers[0].error?.message) : "kaotajat ei olnud"
    );

    const finalSeats = await sponsoredCount(room.id);
    check(
      "võistlus: sponsoreeritud liikmeid on täpselt 50",
      finalSeats === SPONSORED_MEMBER_LIMIT,
      `${finalSeats}/${SPONSORED_MEMBER_LIMIT}`
    );

    const activatedSubs = await prisma.subscription.count({
      where: { userId: { in: [racerA.id, racerB.id] }, billingSource: "SPONSORED_BY_HOST" }
    });
    check("võistlus: sponsoreeritud tellimusi aktiveeriti täpselt üks", activatedSubs === 1, `tellimusi ${activatedSubs}`);

    const acceptedInvites = await prisma.invite.count({
      where: { id: { in: [inviteA.id, inviteB.id] }, useCount: { gt: 0 } }
    });
    check("võistlus: ainult võitja kutse loeti kasutatuks", acceptedInvites === 1, `kutseid ${acceptedInvites}`);

    // -------------------------------------------------------------------
    // 2. NEGATIIVKONTROLL — vana kuju: mõlemad loevad, siis mõlemad kirjutavad.
    //    Aken on siin nähtav ja deterministlik; täpselt see jada elas vanas
    //    `acceptInviteWithinTx`-is, kus ainus lukk oli Invite rea peal.
    // -------------------------------------------------------------------
    const legacyRoom = await makeRoom(owner.id, `sond-legacy ${suffix}`);
    await fillToLastSeat(legacyRoom.id, fillerIds);
    const legacyA = await makeUser(`sol-inv-01-legacy-a-${suffix}@probe.invalid`);
    const legacyB = await makeUser(`sol-inv-01-legacy-b-${suffix}@probe.invalid`);

    const seenA = await sponsoredCount(legacyRoom.id);
    const seenB = await sponsoredCount(legacyRoom.id);
    const legacyAccept = async (user, seen) => {
      if (seen >= SPONSORED_MEMBER_LIMIT) return false;
      await prisma.roomMember.create({
        data: {
          roomId: legacyRoom.id,
          userId: user.id,
          role: "MEMBER",
          billingSource: "SPONSORED_BY_HOST",
          joinedAt: new Date()
        }
      });
      return true;
    };
    const admitted = [
      await legacyAccept(legacyA, seenA),
      await legacyAccept(legacyB, seenB)
    ].filter(Boolean).length;
    const legacySeats = await sponsoredCount(legacyRoom.id);
    check(
      "negatiivkontroll: vana jada laseb MÕLEMAD sisse ja ületab piiri",
      admitted === 2 && legacySeats === SPONSORED_MEMBER_LIMIT + 1,
      `sisse ${admitted}, kohti ${legacySeats}/${SPONSORED_MEMBER_LIMIT}`
    );

    // -------------------------------------------------------------------
    // 3. LAHKUNU VABASTAB KOHA. Piir loeb aktiivseid liikmeid, mitte ajalugu.
    // -------------------------------------------------------------------
    const leaver = await prisma.roomMember.findFirst({
      where: { roomId: room.id, billingSource: "SPONSORED_BY_HOST", leftAt: null }
    });
    await prisma.roomMember.update({ where: { id: leaver.id }, data: { leftAt: new Date() } });
    const afterLeave = await sponsoredCount(room.id);
    const rejoiner = await makeUser(`sol-inv-01-rejoin-${suffix}@probe.invalid`);
    const rejoinInvite = await makeInvite(room.id, owner.id, rejoiner.email);
    const rejoined = await acceptAsRoute(rejoinInvite.id, rejoiner).catch(error => error);
    check("lahkumine vabastab koha (49 pärast lahkumist)", afterLeave === SPONSORED_MEMBER_LIMIT - 1, `${afterLeave}`);
    check(
      "vabanenud koht antakse järgmisele välja",
      rejoined?.billing_source === "SPONSORED_BY_HOST",
      rejoined instanceof Error ? String(rejoined.message) : `allikas=${rejoined?.billing_source}`
    );
  } finally {
    for (const roomId of created.roomIds) {
      await prisma.invite.deleteMany({ where: { roomId } }).catch(() => null);
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => null);
      await prisma.room.delete({ where: { id: roomId } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.subscription.deleteMany({ where: { userId: { in: created.userIds } } }).catch(() => null);
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-INV-01 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-INV-01 sond] katkes:", error);
  process.exit(1);
});
