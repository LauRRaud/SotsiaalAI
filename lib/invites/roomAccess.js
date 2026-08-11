import { ARCHIVED_ROOM_ERROR, isArchivedRoom } from "@/lib/rooms/accessGuard";
import { serverT } from "@/lib/i18n/serverMessages";
import { ROOM_ORIGIN_TYPES, buildRoomOrigin } from "@/lib/rooms/origin";
import { inviteAcceptError as inviteError } from "@/lib/invites/acceptInviteCore";

/**
 * KUTSEVOO RUUMIVÄRAV (SOL-INV-02).
 *
 * MIS OLI VALESTI. `requireRoomRole()` kutsus esmalt `ensureRoom()`, mis
 * olemasoleva `roomId` korral tegi ENNE küsija rolli kontrolli
 * `ensureOwnerMembership(room.id, room.ownerId, ownerDisplayName)`. See upsert
 * käis RUUMI OMANIKU rea peale, aga `ownerDisplayName` tuli KÜSIJA payload'ist
 * (`host_display_name`). Kaks tagajärge korraga:
 *
 *   · ruumi ID-d teadev mitteliige või MEMBER sai keelatud POST-iga (vastus 403)
 *     muuta omaniku kuvatavat nime liikmeloendis;
 *   · teadlikult lõpetatud omaniku-liikmesus (`leftAt`) muutus uuesti aktiivseks,
 *     ilma et miski seda selgitaks.
 *
 * Keelatud päring ei olnud kõrvalmõjuta — ja seda kahes koopias, sest sama kood
 * elas nii `app/api/invites/route.js`-is kui `app/api/invites/sponsored/init`-is.
 *
 * MIS SIIN ON. Kolm reeglit:
 *
 *   1. **Lugemine ei kirjuta.** `resolveInviteRoom()` olemasoleva ruumi haru ei
 *      puutu ühtki rida. Mitteliikme GET ja POST lõpevad 403-ga ilma ühegi
 *      kirjutuseta.
 *   2. **Parandus käib AUTORISEERIMISE JÄREL** ja ainult siis, kui küsija ise on
 *      ruumi omanik. Võõra rea „parandamine" ei ole selle voo töö.
 *   3. **Nimi tuleb serverist.** Omaniku liikmerea kuvanimi tuletatakse tema enda
 *      profiilist, mitte payload'ist, ja OLEMASOLEVAT nime ei kirjutata üle —
 *      inimese enda valitud nimi ei ole hooldusraja otsustada. Küsija enda nime
 *      (`host_display_name`) kirjutab marsruut ise, pärast autoriseerimist, oma
 *      reale.
 *
 * Üks koopia, sest kaks lahknevad esimese muudatusega — sama õppetund, mille
 * maksid juba SOL-RAGADMIN-01/02 ja SOL-CALL-01.
 */

/** Omaniku kuvanimi SERVERIST. E-posti siia ei kirjutata: liikmeloend on nähtav teistele. */
export async function resolveOwnerDisplayName(db, ownerId) {
  if (!db?.user?.findUnique || !ownerId) return "";
  const owner = await db.user
    .findUnique({
      where: { id: ownerId },
      select: { profile: { select: { firstName: true, lastName: true } } }
    })
    .catch(() => null);
  return [owner?.profile?.firstName, owner?.profile?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim()
    .slice(0, 80);
}

/**
 * Omaniku liikmerea parandus. Kutsuja VASTUTUS on, et küsija oleks juba
 * autoriseeritud — see funktsioon ise õigusi ei kontrolli.
 *
 * `update` EI puuduta `displayName`-i: parandus taastab rolli ja aktiivsuse,
 * mitte ei kirjuta üle nime, mille inimene ise on valinud.
 */
export async function ensureOwnerMembership(db, { roomId, ownerId }) {
  if (!roomId || !ownerId) return;
  try {
    const displayName = await resolveOwnerDisplayName(db, ownerId);
    await db.roomMember.upsert({
      where: { roomId_userId: { roomId, userId: ownerId } },
      create: {
        roomId,
        userId: ownerId,
        role: "OWNER",
        displayName: displayName || undefined
      },
      update: {
        role: "OWNER",
        leftAt: null
      }
    });
  } catch {
    // Parandus on hooldus, mitte voo tingimus — ta ei tohi kutsumist kukutada.
  }
}

function roomCreateData({ userId, title, displayName }) {
  return {
    ownerId: userId,
    title,
    ...buildRoomOrigin({ originType: ROOM_ORIGIN_TYPES.MANUAL_INVITE }),
    members: {
      create: {
        userId,
        role: "OWNER",
        displayName: displayName || undefined
      }
    }
  };
}

/**
 * Leiab või loob ruumi. Olemasoleva ruumi haru on RANGELT lugev.
 *
 * `ownerDisplayName` kasutatakse ainult siis, kui ruum LUUAKSE — siis on küsija
 * definitsiooni järgi omanik ja nimi on tema enda oma.
 */
export async function resolveInviteRoom({
  db,
  userId,
  roomId,
  roomTitle,
  ownerDisplayName,
  locale
}) {
  if (roomId) {
    const room = await db.room.findUnique({ where: { id: roomId } });
    if (!room) throw inviteError("api.rooms.not_found", 404, "ROOM_NOT_FOUND");
    // SOL-ROOM-01: lõpetatud ruumi ei saa enam uute inimestega täiendada.
    // Kutsevoos oli see kontroll ainult ÜHES kahest koopiast — sponsoreeritud
    // rada käis temast mööda.
    if (isArchivedRoom(room)) {
      throw inviteError(ARCHIVED_ROOM_ERROR.message, ARCHIVED_ROOM_ERROR.status, "ROOM_ARCHIVED");
    }
    return { room, created: false };
  }

  const trimmedTitle = typeof roomTitle === "string" ? roomTitle.trim() : "";
  if (trimmedTitle) {
    const room = await db.room.create({
      data: roomCreateData({ userId, title: trimmedTitle, displayName: ownerDisplayName })
    });
    return { room, created: true };
  }

  const existing = await db.room.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" }
  });
  if (existing) {
    if (isArchivedRoom(existing)) {
      throw inviteError(ARCHIVED_ROOM_ERROR.message, ARCHIVED_ROOM_ERROR.status, "ROOM_ARCHIVED");
    }
    return { room: existing, created: false };
  }

  const fallbackTitle = serverT(locale, "rooms.fallback_title", undefined, "Room");
  const room = await db.room.create({
    data: roomCreateData({ userId, title: fallbackTitle, displayName: ownerDisplayName })
  });
  return { room, created: true };
}

/**
 * Ruum + rolli kontroll. Ainus koht, kus kutsevoo omanikuparandus tohib joosta,
 * ja ta jookseb ALLES pärast seda, kui küsija on tõendatud omanikuna.
 */
export async function requireInviteRoomRole({
  db,
  userId,
  roomId,
  allowedRoles = ["OWNER"],
  roomTitle,
  ownerDisplayName,
  locale
}) {
  const { room, created } = await resolveInviteRoom({
    db,
    userId,
    roomId,
    roomTitle,
    ownerDisplayName,
    locale
  });

  if (room.ownerId === userId) {
    // Autoriseeritud. Alles NÜÜD tohib omaniku rida puutuda; värskelt loodud
    // ruumil on liikmerida juba olemas, seega teda ei pea parandama.
    if (!created) await ensureOwnerMembership(db, { roomId: room.id, ownerId: room.ownerId });
    return { room, membership: { role: "OWNER" }, roomCreated: created };
  }

  const membership = await db.roomMember.findFirst({
    where: { roomId: room.id, userId, leftAt: null }
  });
  if (!membership || !allowedRoles.includes(membership.role)) {
    throw inviteError("api.common.forbidden", 403, "FORBIDDEN");
  }

  return { room, membership, roomCreated: created };
}
