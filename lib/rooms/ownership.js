/**
 * OMANIK JA LIIKMESUS ON ÜKS INVARIANT (SOL-ROOM-04), JA TEMA JÄLG KUULUB SAMASSE TEHINGUSSE
 * (SOL-ROOM-05).
 *
 * MIS OLI VALESTI. Omanikuvahetus kontrollis sihtmärgi aktiivset liikmesust ENNE tehingut ja
 * kirjutas tehingus rolli tingimusteta; lahkumine luges oma rolli, tegi seejärel aeglase
 * kõnekoristuse ja alles siis kirjutas `leftAt`. Jada
 *
 *     lahkuja loeb MEMBER → transfer loeb aktiivse liikme ja teeb temast OWNER
 *                        → lahkuja kirjutab leftAt
 *
 * jättis `Room.ownerId` viitama LAHKUNUD liikmele ja alandas vana omaniku MODERATOR-iks.
 * Ruumil ei olnud enam ühtki aktiivset OWNER-it: vana omanik ei saanud kutsuda, arhiveerida
 * ega üle anda, uus omanik ei olnud aktiivne liige. Taastamine nõudis administraatorit.
 *
 * MIS SIIN ON. Mõlemad toimingud võtavad SAMA ruumipõhise nõuandeluku ja teevad kogu otsuse
 * luku sees värskelt loetud seisu pealt. Kirjutused on tingimuslikud ja nende `count` on
 * KOHTUNIK — „ma lugesin, et ta on aktiivne liige" ei ole tõend, sest lugemise ja kirjutuse
 * vahel on aken.
 *
 * AUDIT KUULUB SAMASSE TEHINGUSSE (SOL-ROOM-05): varem kirjutati ta pärast tehingut, seega
 * audititõrge andis 500 juba TEHTUD omanikuvahetuse kohta ja kasutaja proovis uuesti.
 *
 * NB: `pg_advisory_xact_lock` AINULT `$executeRaw` kaudu.
 */

const ROOM_LOCK_PREFIX = "room:";

export async function lockRoom(tx, roomId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ROOM_LOCK_PREFIX}${roomId}`}))`;
}

/**
 * Omanikuvahetus. Kogu otsus on luku sees.
 *
 * @returns `{ ok: true }` või `{ ok: false, status, message }`.
 */
export async function transferRoomOwnership({
  db,
  roomId,
  actorUserId,
  targetUserId,
  writeAudit = true
}) {
  return db.$transaction(async (tx) => {
    await lockRoom(tx, roomId);

    const room = await tx.room.findUnique({ where: { id: roomId } });
    if (!room) return { ok: false, status: 404, message: "api.rooms.not_found" };
    if (room.ownerId !== actorUserId) return { ok: false, status: 403, message: "api.common.forbidden" };
    if (room.archivedAt) return { ok: false, status: 409, message: "api.rooms.archived_readonly" };

    // Sihtmärgi aktiivsus loetakse LUKU SEES ja kirjutus nõuab teda uuesti: lugemine üksi ei
    // püüa võistlust, sest ta mõõdab hetke, mis on möödas enne, kui ta jõuab otsustada.
    const target = await tx.roomMember.findFirst({
      where: { roomId, userId: targetUserId, leftAt: null },
      select: { userId: true }
    });
    if (!target) return { ok: false, status: 404, message: "api.rooms.transfer_target_not_member" };

    const moved = await tx.room.updateMany({
      where: { id: roomId, ownerId: actorUserId, archivedAt: null },
      data: { ownerId: targetUserId }
    });
    if (moved.count < 1) return { ok: false, status: 409, message: "api.rooms.transfer_conflict" };

    const promoted = await tx.roomMember.updateMany({
      where: { roomId, userId: targetUserId, leftAt: null },
      data: { role: "OWNER" }
    });
    if (promoted.count < 1) {
      // Sihtmärk lahkus lugemise ja kirjutuse vahel. Tehing rullub tagasi — parem tühi
      // tulemus kui ruum, mille omanik on lahkunud liige.
      throw Object.assign(new Error("transfer target left mid-transaction"), {
        roomTransferConflict: true
      });
    }

    await tx.roomMember.updateMany({
      where: { roomId, userId: actorUserId },
      data: { role: "MODERATOR" }
    });

    // SOL-ROOM-05: jälg sünnib koos siirdega, mitte pärast teda.
    if (writeAudit && tx.dataAuditLog?.create) {
      await tx.dataAuditLog.create({
        data: {
          actorUserId,
          targetUserId,
          action: "ROOM_OWNERSHIP_TRANSFERRED",
          resourceType: "Room",
          resourceId: roomId,
          meta: { title: room.title || null }
        }
      });
    }

    return { ok: true, previousOwnerId: actorUserId, ownerId: targetUserId, room };
  });
}

/**
 * Lahkumine. Roll loetakse UUESTI luku sees ja `leftAt` kirjutus on tingimuslik.
 *
 * @returns `{ ok: true }` või `{ ok: false, status, message }`.
 */
export async function leaveRoom({ db, roomId, userId, now = () => new Date() }) {
  return db.$transaction(async (tx) => {
    await lockRoom(tx, roomId);

    const membership = await tx.roomMember.findFirst({
      where: { roomId, userId, leftAt: null },
      select: { role: true }
    });
    if (!membership) return { ok: false, status: 404, message: "api.rooms.not_member" };

    // Värske lugemine luku sees: vahepealne omanikuvahetus võis teha minust OWNER-i.
    if (String(membership.role || "").toUpperCase() === "OWNER") {
      return { ok: false, status: 409, message: "api.rooms.owner_cannot_leave" };
    }

    const left = await tx.roomMember.updateMany({
      where: { roomId, userId, leftAt: null, role: { not: "OWNER" } },
      data: { leftAt: now() }
    });
    if (left.count < 1) {
      return { ok: false, status: 409, message: "api.rooms.owner_cannot_leave" };
    }

    return { ok: true };
  });
}
