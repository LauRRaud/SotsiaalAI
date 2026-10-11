/**
 * RUUMI ARHIIVIMÄRGE JA TEMA JÄLG ON ÜKS KIRJUTUS (SOL-ROOM-05).
 *
 * Ruum muutub ainult loetavaks ühel viisil: `archivedAt` saab väärtuse ja ligipääsuvärav
 * (`lib/rooms/accessGuard.js`) vastab sellest hetkest igale kirjutusele
 * `409 api.rooms.archived_readonly`. Teist „ainult loetava" liiki ei ole.
 *
 * Seda märget teeb kaks rada:
 *   - omanik arhiveerib ruumi ise (`PATCH /api/rooms/<roomId>`);
 *   - asutus lõpetab vastuvõtulaual töö ja pöördumise ruum jääb ainult loetavaks
 *     (`closePreInquiryRoomWithin`, `lib/rooms/preInquiryRoom.js`).
 *
 * Mõlemad kutsuvad seda funktsiooni OMA tehingus. Kirjutus on tingimuslik ja tema `count` on
 * kohtunik: kui keegi jõudis ette, on ruum ikka arhiveeritud, aga teist auditirida ei teki.
 *
 * MIDA SIIN EI OLE: kõne lõpetamist ega kokkuvõtete üleandmist. Kõne lõpetamine kutsub
 * välist teenust ja ei tohi olla tehingu sees; mõlema sammu järjekorra otsustab kutsuja.
 */

/** Miks ruum arhiveeriti, kui seda ei teinud omanik ise. Läheb auditirea `meta.reason` välja. */
export const ROOM_ARCHIVE_REASONS = Object.freeze({
  ORG_WORK_CLOSED: "ORG_WORK_CLOSED"
});

/**
 * @param room `{ id, title, originType }`
 * @returns {Promise<boolean>} tõene, kui just see kutse ruumi arhiveeris
 */
export async function markRoomArchivedWithin(tx, { room, actorUserId = null, now = new Date(), reason = null }) {
  const roomId = String(room?.id || "").trim();
  if (!roomId) return false;
  const marked = await tx.room.updateMany({
    where: { id: roomId, archivedAt: null },
    data: { archivedAt: now }
  });
  if (marked.count < 1) return false;
  if (tx.dataAuditLog?.create) {
    await tx.dataAuditLog.create({
      data: {
        actorUserId: actorUserId || null,
        action: "ROOM_ARCHIVED",
        resourceType: "Room",
        resourceId: roomId,
        meta: {
          title: room.title || null,
          originType: room.originType || null,
          ...(reason ? { reason } : {})
        }
      }
    });
  }
  return true;
}
