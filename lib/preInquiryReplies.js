/**
 * Saaja vastused pöörduja enda eelpöördumistele: mitu sõnumit ühises ruumis ja millal viimane.
 *
 * MIKS. Teekond ütleb pöördujale „saaja on vastanud" (`lib/journey/service.js`), aga
 * eelpöördumiste leht näitas sama pöördumise kohta kõige rohkem „vastu võetud": loendi vastus
 * ei kandnud vastuste arvu. Seisu reegel ise on üks (`lib/journey/linkedPreInquiryState.js`)
 * ja ootab välja `replyCount`; see moodul annab selle ka eelpöördumiste loendile.
 *
 * MIS ON VASTUS. Iga inimese kirjutatud sõnum pöördumise ühises ruumis, mis ei ole pöörduja
 * enda oma: saaja ise või asutuse vastuvõtulaua töötaja. Kustutatud sõnumeid ja abilise
 * sõnumeid ei loeta. Sama reegel on Teekonna lugejal (`readReplies` failis
 * lib/journey/service.js); test tests/pre-inquiry-replies.test.mjs jooksutab mõlemad samade
 * andmete peal ja kukub, kui need lahku lähevad.
 *
 * Siit tuleb ainult ARV ja AEG. Sõnumi sisu jääb ruumi.
 */
import { prisma } from "@/lib/prisma";
import { PRE_INQUIRY_ROOM_ORIGIN_TYPES } from "@/lib/rooms/preInquiryRoom";

/** `Map(pöördumise id → { replyCount, lastReplyAt })`; pöördumist, millel vastuseid ei ole, kaardil ei ole. */
export async function readPreInquiryReplies(userId, inquiryIds, { db = prisma } = {}) {
  const replies = new Map();
  const authorId = String(userId || "").trim();
  const ids = [...new Set((Array.isArray(inquiryIds) ? inquiryIds : []).map((id) => String(id || "").trim()).filter(Boolean))];
  /* Tühi väärtus ei tohi päringusse jõuda: Prisma jätaks tingimuse vahele. */
  if (!authorId || !ids.length) return replies;
  const rooms = await db.room.findMany({
    where: { originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES }, originId: { in: ids } },
    select: { id: true, originId: true }
  });
  if (!rooms.length) return replies;
  const groups = await db.roomMessage.groupBy({
    by: ["roomId"],
    where: { roomId: { in: rooms.map((room) => room.id) }, deletedAt: null, senderType: "USER", authorId: { not: authorId } },
    _count: { _all: true },
    _max: { createdAt: true }
  });
  const byRoom = new Map(groups.map((group) => [group.roomId, group]));
  for (const room of rooms) {
    const group = byRoom.get(room.id);
    if (!group) continue;
    const known = replies.get(room.originId) || { replyCount: 0, lastReplyAt: null };
    const last = group._max?.createdAt || null;
    replies.set(room.originId, {
      replyCount: known.replyCount + (group._count?._all || 0),
      lastReplyAt: !known.lastReplyAt || (last && last > known.lastReplyAt) ? last : known.lastReplyAt
    });
  }
  return replies;
}

/**
 * Lisab pöörduja ENDA saadetud ridadele `replyCount` ja `lastReplyAt`.
 *
 * `items` on juba `serializePreInquiry` kujul read. Saaja vaatesse (rida, mille autor on keegi
 * teine) ja saatmata või tagasi võetud ridadele midagi ei lisata: need väljad puuduvad neil,
 * nagu enne. Lugemise viga ei tohi loendit katki teha: siis jäävad read ilma arvuta.
 */
export async function withPreInquiryReplies(userId, items, { db = prisma } = {}) {
  const viewerId = String(userId || "").trim();
  const list = Array.isArray(items) ? items : [];
  const own = list.filter((item) => item && viewerId && String(item.authorId || "") === viewerId && item.sentAt && !item.recalledAt);
  if (!own.length) return list;
  let replies;
  try {
    replies = await readPreInquiryReplies(viewerId, own.map((item) => item.id), { db });
  } catch {
    return list;
  }
  const ownIds = new Set(own.map((item) => item.id));
  return list.map((item) => {
    if (!item || !ownIds.has(item.id)) return item;
    const reply = replies.get(item.id);
    const lastReplyAt = reply?.lastReplyAt || null;
    return {
      ...item,
      replyCount: reply?.replyCount || 0,
      lastReplyAt: lastReplyAt?.toISOString?.() || lastReplyAt
    };
  });
}
