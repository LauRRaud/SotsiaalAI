import { prisma } from "@/lib/prisma";
import { hasRoomBillingAccess } from "@/lib/rooms/access";

/**
 * RUUMI LIGIPÄÄS ON ÜKS OTSUS, JA TA TEAB, KAS RUUM ON LÕPETATUD (SOL-ROOM-01).
 *
 * MIS OLI VALESTI. Sama „leia ruum → leia aktiivne liikmesus → kontrolli arveldust" otsus
 * elas vähemalt neljas koopias (sõnumid, SSE-voog, lugemismärge, liikmed) ja kõik neli
 * valisid ruumist ainult `id` ja `helpMatch` — `archivedAt` ei jõudnud kordagi otsuseni.
 * Liides näitas lõpetatud ruumi kirjutuskaitstuna ja eemaldas nupud, aga server lubas iga
 * aktiivsel liikmel otse API kaudu sõnumeid lisada ja kustutada, inimesi kutsuda, kõnet ja
 * salvestust alustada. Arhiiv ei olnud elutsükli piir, vaid UI seisund — kokkuvõtete
 * üleandmise JÄREL sai ühine ajalugu veel muutuda.
 *
 * MIS SIIN ON. Üks värav, mis eristab KOLME eri küsimust:
 *
 *   - `ROOM_READ`      — kas ma tohin seda ruumi näha? Arhiveeritud ruumi ajalugu TOHIB
 *                        lugeda; see on lubadus, mitte lünk, ja ta on siin nimeliselt kirjas.
 *   - `ROOM_WIND_DOWN` — kas ma tohin LÕPETADA seda, mis on juba lahti (kõnest lahkuda,
 *                        salvestus peatada, nõusolek tagasi võtta, salvestis kustutada)?
 *                        Alati. Vastasel juhul lukustaks arhiveerimine käimasoleva kõne
 *                        osalejad sisse — piir, mis pidi kaitsma, teeks kahju.
 *   - `ROOM_WRITE`     — kas ma tohin ühist ajalugu või koosseisu MUUTA või midagi UUT
 *                        alustada? Arhiveeritud ruumis mitte, ka omanikuna mitte:
 *                        `409 api.rooms.archived_readonly`, sama vastus, mille
 *                        omanikuvahetuse marsruut juba andis.
 *
 * VAIKEVÄÄRTUS ON `ROOM_WRITE` ja see on tahtlik: uus marsruut, mis lepingut ei nimeta, on
 * arhiveeritud ruumis KINNI, mitte lahti. Erandid on nimelised ja iga erandi juures on
 * põhjus kirjas.
 *
 * LUGEMISMÄRGE ON TEADLIKULT `READ`. Ta ei muuda ühist ajalugu ega koosseisu, vaid ainult
 * seda, mida MINA olen näinud. Kui ta oleks kirjutus, jääks lõpetatud ruum igaveseks
 * „lugemata" ja teavituslugeja näitaks ruumi, mida ei saa maha märkida.
 */

export const ROOM_READ = "read";
export const ROOM_WIND_DOWN = "wind_down";
export const ROOM_WRITE = "write";

async function defaultHasActiveSubscription(db, userId) {
  if (!userId) return false;
  const sub = await db.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }]
    },
    select: { id: true }
  });
  return Boolean(sub);
}

/**
 * @returns `{ ok: true, room, member, billingSource, readOnly }` või
 *          `{ ok: false, status, message }`, kus `message` on tõlkevõti.
 *
 * `readOnly` on lugemisrajal tõene arhiveeritud ruumi puhul — kutsuja saab teda vastuses
 * edasi anda, ilma et peaks `archivedAt`-i uuesti küsima.
 */
export async function resolveRoomAccess({
  userId,
  userRole,
  roomId,
  intent = ROOM_WRITE,
  db = prisma,
  hasActiveSubscription = null
}) {
  const room = await db.room.findUnique({
    where: { id: roomId },
    select: {
      id: true,
      archivedAt: true,
      ownerId: true,
      helpMatch: { select: { id: true } }
    }
  });
  if (!room) {
    return { ok: false, status: 404, message: "api.rooms.not_found" };
  }

  const member = await db.roomMember.findFirst({
    where: { userId, roomId, leftAt: null }
  });
  if (!member) {
    return { ok: false, status: 403, message: "api.rooms.access_denied" };
  }

  const active = hasActiveSubscription
    ? await hasActiveSubscription(userId)
    : await defaultHasActiveSubscription(db, userId);

  const billingAccess = hasRoomBillingAccess({
    userRole,
    membership: member,
    hasActiveSubscription: active,
    room
  });
  if (!billingAccess.ok) {
    return { ok: false, status: 403, message: "api.rooms.join_unavailable" };
  }

  // Värav on siin, mitte kutsujas: iga uus marsruut, mis seda funktsiooni kasutab, saab
  // elutsükli piiri kaasa ilma seda ise meeles pidamata.
  if (room.archivedAt && intent === ROOM_WRITE) {
    return { ok: false, status: 409, message: "api.rooms.archived_readonly" };
  }

  return {
    ok: true,
    room,
    member,
    billingSource: billingAccess.billingSource,
    readOnly: Boolean(room.archivedAt)
  };
}

/**
 * Rajad, kus liikmesus on juba muul viisil kontrollitud (kutse loomine ja vastuvõtt): ainus
 * küsimus on „kas ruum on lõpetatud". Vastus on sama võti ja sama staatus, et kliendil oleks
 * üks käitumisreegel, mitte kolm.
 */
export const ARCHIVED_ROOM_ERROR = Object.freeze({
  status: 409,
  message: "api.rooms.archived_readonly"
});

export function isArchivedRoom(room) {
  return Boolean(room?.archivedAt);
}
