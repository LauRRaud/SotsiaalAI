/**
 * Mida asutus pöörduja enda eelpöördumisega tegi, kui töö on lõppenud: lükkas pöördumise tagasi
 * või lõpetas töö, millal, ja selgitus, mille asutus pöördujale kirjutas.
 *
 * MIKS. Asutuse vastuvõtulaud lõpetab pöördumisega töö kahel viisil: „suletud" (töötaja on
 * pöördujaga tegelenud) ja „tagasi lükatud" (asutus ei võta pöördumist tööle). Pöörduja nägi
 * mõlemal juhul sama teadet ja oma pöördumise juures endiselt „vastu võetud" või „vastatud":
 * tagasilükkamist ega põhjust ta ei näinud. Inimene, kes abi ootab, peab teadma, et siit abi ei
 * tule, miks, ja et tal tuleb mujale pöörduda (omanik 11.10.2026).
 *
 * KELLELE. Ainult pöördumise autorile tema enda ridadel, nagu vastuste arv
 * (`lib/preInquiryReplies.js`). Saaja vaatesse ja teiste inimeste ridadele midagi ei lisata.
 * Selgitus on asutuse kirjutatud tekst PÖÖRDUJALE: tagasilükkamisel kohustuslik, sulgemisel
 * soovi korral (`transitionInboxItem` failis lib/org/inbox.js).
 *
 * MIDA EI TULE. Töötaja nime, asutuse sisemist seisu ega määramiste ajalugu siit ei saa. Töös
 * oleva pöördumise kohta ei tule midagi: väli on ainult lõpetatud tööl.
 */
import { OrganizationInboxSourceType, OrganizationInboxStatus } from "@/lib/org/constants";
import { prisma } from "@/lib/prisma";
import { PRE_INQUIRY_ROOM_ORIGIN_TYPES } from "@/lib/rooms/preInquiryRoom";

export const OrganizationOutcomeKind = Object.freeze({
  /** Asutus lõpetas töö (vastuvõtulaual „suletud"). */
  CLOSED: "closed",
  /** Asutus lükkas pöördumise tagasi (vastuvõtulaual „tagasi lükatud"). */
  DECLINED: "declined"
});

const KIND_BY_STATUS = Object.freeze({
  [OrganizationInboxStatus.CLOSED]: OrganizationOutcomeKind.CLOSED,
  [OrganizationInboxStatus.REJECTED]: OrganizationOutcomeKind.DECLINED
});

const cleanIds = (values) => [...new Set((Array.isArray(values) ? values : []).map((id) => String(id || "").trim()).filter(Boolean))];

/**
 * `Map(pöördumise id → { kind, at, note, hasRoom })`; pöördumist, millega töö ei ole lõppenud,
 * kaardil ei ole. `hasRoom`: kas pöördumisel on vestlusruum, mida pöörduja saab lugeda (tagasi
 * lükatud pöördumisel, mida keegi tööle ei võtnud, ruumi ei ole ja seda enam ka ei teki).
 */
export async function readOrganizationOutcomes(inquiryIds, { db = prisma } = {}) {
  const outcomes = new Map();
  const ids = cleanIds(inquiryIds);
  /* Tühi loend ei tohi päringusse jõuda: Prisma jätaks tingimuse vahele. */
  if (!ids.length) return outcomes;
  const rows = await db.organizationInboxItem.findMany({
    where: {
      sourceType: OrganizationInboxSourceType.PRE_INQUIRY,
      sourceId: { in: ids },
      status: { in: Object.keys(KIND_BY_STATUS) }
    },
    select: { sourceId: true, status: true, closedAt: true, closedReason: true }
  });
  if (!rows.length) return outcomes;
  const rooms = await db.room.findMany({
    where: { originType: { in: PRE_INQUIRY_ROOM_ORIGIN_TYPES }, originId: { in: rows.map((row) => row.sourceId) } },
    select: { originId: true }
  });
  const withRoom = new Set(rooms.map((room) => room.originId));
  for (const row of rows) {
    const kind = KIND_BY_STATUS[row.status];
    if (!kind) continue;
    outcomes.set(row.sourceId, {
      kind,
      at: row.closedAt || null,
      note: String(row.closedReason || "").trim(),
      hasRoom: withRoom.has(row.sourceId)
    });
  }
  return outcomes;
}

/**
 * Lisab pöörduja ENDA asutusele saadetud ridadele välja `organizationOutcome`, kui asutus on
 * tööga lõpetanud.
 *
 * `items` on juba `serializePreInquiry` kujul read. Saaja vaatesse (rida, mille autor on keegi
 * teine), saatmata, tagasi võetud ja nimelisele saajale läinud ridadele midagi ei lisata.
 * Lugemise viga ei tohi loendit katki teha: siis jäävad read ilma selle väljata.
 */
export async function withOrganizationOutcome(userId, items, { db = prisma } = {}) {
  const viewerId = String(userId || "").trim();
  const list = Array.isArray(items) ? items : [];
  const own = list.filter(
    (item) => item && viewerId && String(item.authorId || "") === viewerId && item.sentAt && !item.recalledAt && item.recipientOrganizationId
  );
  if (!own.length) return list;
  let outcomes;
  try {
    outcomes = await readOrganizationOutcomes(own.map((item) => item.id), { db });
  } catch {
    return list;
  }
  if (!outcomes.size) return list;
  const ownIds = new Set(own.map((item) => item.id));
  return list.map((item) => {
    const outcome = item && ownIds.has(item.id) ? outcomes.get(item.id) : null;
    if (!outcome) return item;
    return {
      ...item,
      organizationOutcome: { ...outcome, at: outcome.at?.toISOString?.() || outcome.at || null }
    };
  });
}
