import { prisma } from "@/lib/prisma";
import { NOTIFICATION_EVENT_TYPES, createNotificationEvent } from "@/lib/notifications";
import { canShareMeetingSummaryRole } from "./meetingSummaryShare";

/* T20 COLLAB-P2 — kohtumise kokkuvõtte kinnitusring (analüüs ptk 5, klass 9).
 *
 * O-CO-2 = (a): ring on VALIKULINE — jagaja otsustab jagamise hetkel, kas küsib
 * osalejatelt kinnitust. O-CO-5 = (c): klient/pöörduja on kokkuvõtte ADRESSAAT,
 * mitte ringi osaleja — vastata saavad ainult professionaalirollid (sama
 * komplekt, mis tohib kokkuvõtet jagada). Sihtolek (b) jääb lahti: ring elab
 * jagamise fakti (RoomSharedSummary) küljes, mitte sõnumi küljes, nii et
 * hilisem "kinnitatud kiht kliendile" ei nõua mudelivahetust.
 *
 * Kaks kõva reeglit:
 * 1) Vana kinnitus EI JÄÄ uue sisu külge — kui jagaja postitab sama artefakti
 *    uue sisuga, kustuvad varasemad vastused ja aktiivne ring taasavaneb.
 * 2) Teavitus ei tohi kunagi kukutada jagamist ega vastust — iga saaja on
 *    eraldi try/catch'is (T12 E7 leping) ja verifitseeritakse ka kirjutamise
 *    hetkel (createNotificationEvent verifyRecipient). */

const NOTE_MAX_LENGTH = 4000;

export const SUMMARY_APPROVAL_STATUSES = Object.freeze(["APPROVED", "CORRECTION"]);

/** O-CO-5 (c): ringis vastavad ainult professionaalirollid. */
export function canRespondToSummaryApprovalRole(role) {
  return canShareMeetingSummaryRole(role);
}

function approvalError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

async function notifyEligibleParticipants(db, { summary, roomId, now }) {
  if (!db?.notificationEvent?.create || !db?.roomMember?.findMany) return { skipped: 1 };
  const members = await db.roomMember.findMany({
    where: { roomId, leftAt: null, userId: { not: summary.sharedByUserId } },
    select: { userId: true, user: { select: { role: true } } }
  });
  const counters = { created: 0, existing: 0, failed: 0 };
  for (const member of members || []) {
    if (!canRespondToSummaryApprovalRole(member?.user?.role)) continue;
    try {
      const result = await createNotificationEvent(
        {
          userId: member.userId,
          type: NOTIFICATION_EVENT_TYPES.ROOM_SUMMARY_APPROVAL_REQUESTED,
          sourceId: summary.id,
          targetId: roomId,
          /* Iga ringi avamine (sh sisu muutumise järgne taasavamine) on uus
           * teavitus — suffix kannab avamishetke. */
          dedupeSuffix: `req-${now.getTime()}`,
          emailPolicy: "NONE"
        },
        { db, now }
      );
      counters[result.created ? "created" : "existing"] += 1;
    } catch {
      counters.failed += 1;
    }
  }
  return counters;
}

/**
 * Rakendub PÄRAST recordSharedRoomSummary upsert'i. Võrdleb jagamise-eelse
 * seisuga (prior): kui sisu muutus, kustutab vananenud vastused; avab ringi,
 * kui jagaja seda küsis või kui aktiivne ring vajab uue sisu tõttu taasavamist.
 * Ei viska — jagamine ise on juba õnnestunud.
 */
export async function applySummaryApprovalPolicy({
  db = prisma,
  roomId,
  artifactId,
  prior = null,
  requestApproval = false,
  now = new Date()
} = {}) {
  if (!roomId || !artifactId || !db?.roomSharedSummary?.findFirst) {
    return { ringOpened: false, approvalsCleared: false };
  }
  try {
    const summary = await db.roomSharedSummary.findFirst({
      where: { roomId, artifactId },
      select: { id: true, content: true, sharedByUserId: true, approvalRequestedAt: true }
    });
    if (!summary) return { ringOpened: false, approvalsCleared: false };

    const contentChanged = Boolean(prior) && prior.content !== summary.content;
    let approvalsCleared = false;
    if (contentChanged && db.roomSummaryApproval?.deleteMany) {
      /* Kõva reegel 1: kinnitus käis VANA teksti kohta. */
      const cleared = await db.roomSummaryApproval.deleteMany({
        where: { roomSharedSummaryId: summary.id }
      });
      approvalsCleared = (cleared?.count || 0) > 0;
    }

    const ringWasActive = Boolean(summary.approvalRequestedAt);
    const shouldOpen = requestApproval || (ringWasActive && contentChanged);
    if (!shouldOpen) return { ringOpened: false, approvalsCleared };

    await db.roomSharedSummary.update({
      where: { id: summary.id },
      data: { approvalRequestedAt: now }
    });
    await notifyEligibleParticipants(db, { summary, roomId, now });
    return { ringOpened: true, approvalsCleared };
  } catch (error) {
    console.error("[summary approval] policy failed", error);
    return { ringOpened: false, approvalsCleared: false, failed: true };
  }
}

/**
 * Osaleja vastus: "kinnitan" või "mul on parandus" (+ paranduse sisu autorile).
 * Vastuse muutmine on lubatud (upsert) — kehtib viimane seis.
 *
 * @throws 404 kui kokkuvõtet pole selles ruumis; 409 kui ringi ei ole avatud
 *   või jagamine on tagasi võetud (sõnum kustutatud); 403 kui vastaja ei ole
 *   ruumi aktiivne liige, ei ole professionaalirollis või on jagaja ise;
 *   400 kui staatus/parandus on vigane.
 */
export async function respondToSummaryApproval({
  db = prisma,
  roomId,
  summaryId,
  userId,
  userRole,
  status,
  note,
  now = new Date()
} = {}) {
  const room = normalizeId(roomId);
  const id = normalizeId(summaryId);
  const responderId = normalizeId(userId);
  if (!room || !id || !responderId) throw approvalError("api.common.not_found", 404);

  const normalizedStatus = String(status || "").trim().toUpperCase();
  if (!SUMMARY_APPROVAL_STATUSES.includes(normalizedStatus)) {
    throw approvalError("api.rooms.summary_response_invalid", 400);
  }
  const normalizedNote =
    normalizedStatus === "CORRECTION" ? String(note || "").trim().slice(0, NOTE_MAX_LENGTH) || null : null;

  const summary = await db.roomSharedSummary.findFirst({
    where: { id, roomId: room },
    select: {
      id: true,
      messageId: true,
      sharedByUserId: true,
      approvalRequestedAt: true
    }
  });
  if (!summary) throw approvalError("api.common.not_found", 404);
  if (!summary.approvalRequestedAt) throw approvalError("api.rooms.summary_ring_not_open", 409);
  if (summary.sharedByUserId === responderId) {
    throw approvalError("api.common.forbidden", 403);
  }
  if (!canRespondToSummaryApprovalRole(userRole)) {
    throw approvalError("api.common.forbidden", 403);
  }

  const membership = await db.roomMember.findFirst({
    where: { roomId: room, userId: responderId, leftAt: null },
    select: { id: true }
  });
  if (!membership) throw approvalError("api.rooms.access_denied", 403);

  /* Kustutatud sõnum = tagasi võetud jagamine (summaryHandover fail-closed
   * pretsedent) — tagasi võetud kokkuvõtet ei saa kinnitada. */
  if (summary.messageId && db.roomMessage?.findFirst) {
    const message = await db.roomMessage.findFirst({
      where: { id: summary.messageId },
      select: { deletedAt: true }
    });
    if (!message || message.deletedAt) {
      throw approvalError("api.rooms.summary_share_withdrawn", 409);
    }
  }

  const approval = await db.roomSummaryApproval.upsert({
    where: {
      roomSharedSummaryId_userId: { roomSharedSummaryId: summary.id, userId: responderId }
    },
    create: {
      roomSharedSummaryId: summary.id,
      userId: responderId,
      status: normalizedStatus,
      note: normalizedNote
    },
    update: { status: normalizedStatus, note: normalizedNote },
    select: { id: true, status: true, note: true, updatedAt: true }
  });

  /* Kõva reegel 2: teavitus jagajale ei tohi vastust kukutada. */
  try {
    await createNotificationEvent(
      {
        userId: summary.sharedByUserId,
        type: NOTIFICATION_EVENT_TYPES.ROOM_SUMMARY_APPROVAL_RESPONSE,
        sourceId: summary.id,
        targetId: room,
        dedupeSuffix: `resp-${responderId}-${normalizedStatus}`,
        emailPolicy: "NONE"
      },
      { db, now }
    );
  } catch {}

  return approval;
}

/**
 * Kinnitusringi seis /vestlus ruumivaate jaoks. Ainult aktiivse ringiga
 * kokkuvõtted. Üksikvastused (kes + parandus) on nähtavad AINULT jagajale;
 * teised näevad koondloendust ja enda vastust.
 */
export async function listRoomSummaryApprovalState({
  db = prisma,
  roomId,
  viewerId,
  viewerRole
} = {}) {
  const room = normalizeId(roomId);
  const viewer = normalizeId(viewerId);
  if (!room || !viewer || !db?.roomSharedSummary?.findMany) return [];

  const summaries = await db.roomSharedSummary.findMany({
    where: { roomId: room, approvalRequestedAt: { not: null } },
    select: {
      id: true,
      artifactId: true,
      messageId: true,
      title: true,
      sharedByUserId: true,
      approvalRequestedAt: true,
      approvals: {
        select: { userId: true, status: true, note: true, updatedAt: true }
      }
    },
    orderBy: { sharedAt: "asc" },
    take: 50
  });
  if (!summaries.length) return [];

  const memberRows = await db.roomMember.findMany({
    where: { roomId: room, leftAt: null },
    select: { userId: true, displayName: true, user: { select: { role: true } } }
  });
  const displayNames = new Map(
    (memberRows || []).map((m) => [m.userId, m.displayName || ""])
  );
  const professionalIds = new Set(
    (memberRows || [])
      .filter((m) => canRespondToSummaryApprovalRole(m?.user?.role))
      .map((m) => m.userId)
  );

  return summaries.map((summary) => {
    const isSharer = summary.sharedByUserId === viewer;
    const mine = summary.approvals.find((a) => a.userId === viewer) || null;
    const approved = summary.approvals.filter((a) => a.status === "APPROVED").length;
    const correction = summary.approvals.filter((a) => a.status === "CORRECTION").length;
    const eligible = [...professionalIds].filter((uid) => uid !== summary.sharedByUserId).length;
    return {
      id: summary.id,
      artifactId: summary.artifactId,
      messageId: summary.messageId,
      title: summary.title || null,
      sharedByUserId: summary.sharedByUserId,
      approvalRequestedAt: summary.approvalRequestedAt,
      isSharer,
      counts: { approved, correction, eligible },
      myStatus: mine?.status || null,
      canRespond:
        !isSharer &&
        professionalIds.has(viewer) &&
        canRespondToSummaryApprovalRole(viewerRole),
      responses: isSharer
        ? summary.approvals.map((a) => ({
            userId: a.userId,
            displayName: displayNames.get(a.userId) || "",
            status: a.status,
            note: a.note || null,
            updatedAt: a.updatedAt
          }))
        : []
    };
  });
}
