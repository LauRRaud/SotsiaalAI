import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ROOM_READ, ROOM_WRITE, resolveRoomAccess } from "@/lib/rooms/accessGuard";
import { serializeRoomOrigin } from "@/lib/rooms/origin";
import { resolveShareableMeetingSummary } from "@/lib/rooms/meetingSummaryShare";
import { recordSharedRoomSummary } from "@/lib/rooms/summaryHandover";
import { applySummaryApprovalPolicy, listRoomSummaryApprovalState } from "@/lib/rooms/summaryApproval";
import { logDocumentsAudit } from "@/lib/documents/audit";
import { safeError } from "@/lib/privacy/safeError";
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard";
import { markHelpMatchContactedByRoom } from "@/lib/help/matches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;
const RATE_LIMIT_WINDOW_MS = Number(process.env.ROOM_MESSAGES_POST_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_POST = Number(process.env.ROOM_MESSAGES_POST_RATE_LIMIT_MAX || 20);
// E3 (audit 18 K2): kasutaja-tipitud sõnumi pikkuspiir, et vabatekst ei maanduks
// piiramatult DB-sse. Jagatud summeeringu (FINAL artefakt) sisu jääb piirist välja.
const MAX_MESSAGE_LENGTH = Number(process.env.ROOM_MESSAGE_MAX_LENGTH || 4000);
// T20 P1: ka jagatud FINAL-kokkuvõte vajab lage — varem oli piiramatu. ~32k on
// aus ülempiir (mitu A4), mis ei blokeeri päris kokkuvõtteid.
const MAX_SHARED_SUMMARY_LENGTH = Number(process.env.ROOM_SHARED_SUMMARY_MAX_LENGTH || 32_000);

function json(data, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0"
    }
  });
}

function errorJson(messageKey, status, extras = {}) {
  return json({
    ok: false,
    messageKey,
    message: messageKey,
    ...extras
  }, status);
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
    return {
      ok: true,
      userId: session.user.id,
      userRole: session.user.role
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }
}

async function hasActiveSubscription(userId) {
  if (!userId) return false;
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [
        { validUntil: null },
        {
          validUntil: {
            gt: now
          }
        }
      ]
    },
    select: {
      id: true
    }
  });
  return Boolean(sub);
}

async function getMemberDisplayNames(roomId, authorIds) {
  if (!authorIds.length) return new Map();
  const rows = await prisma.roomMember.findMany({
    where: {
      roomId,
      userId: {
        in: authorIds
      }
    },
    select: {
      userId: true,
      displayName: true
    }
  });
  return new Map(rows.map(m => [m.userId, m.displayName || ""]));
}

// Värav on jagatud (SOL-ROOM-01): lugemine tohib arhiveeritud ruumis toimuda, kirjutus mitte.
// Varem valis siinne koopia ruumist ainult `id` ja `helpMatch`, seega `archivedAt` ei jõudnud
// otsuseni kunagi ja lõpetatud ruumi sai otse API kaudu edasi kirjutada.
function ensureAccess(userId, roomId, userRole, intent) {
  return resolveRoomAccess({
    userId,
    userRole,
    roomId,
    intent,
    hasActiveSubscription
  });
}

function parseCursor(token) {
  if (!token) return null;
  const [ts, id] = token.split("_");
  const ms = Number(ts);
  if (!Number.isFinite(ms) || !id) return null;
  return {
    ts: new Date(ms),
    id
  };
}

function makeCursor(row) {
  if (!row) return null;
  const ms = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
  if (!Number.isFinite(ms)) return null;
  return `${ms}_${row.id}`;
}

async function resolveRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

export async function GET(req, { params }) {
  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  // E3 (audit 18 K1): püünis hoiab {ok, messageKey} lepingu ka DB-tõrkel 500-l,
  // muidu tagastaks Next.js geneerilise HTML-500 ja klient ei oska seda lugeda.
  try {
  // Ajaloo lugemine on arhiveeritud ruumis LUBATUD — see on lepingu osa, mitte lünk.
  const access = await ensureAccess(auth.userId, roomId, auth.userRole, ROOM_READ);
  if (!access.ok) return errorJson(access.message, access.status || 403);
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      title: true,
      originType: true,
      originId: true,
      originLabel: true,
      originMeta: true,
      helpMatch: {
        select: {
          id: true
        }
      }
    }
  });
  if (!room) return errorJson("api.rooms.not_found", 404);

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || PAGE_SIZE);
  const limit = Math.max(1, Math.min(PAGE_SIZE, Number.isFinite(limitParam) ? limitParam : PAGE_SIZE));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const where = {
    roomId,
    deletedAt: null
  };
  const take = limit + 1;
  const rows = await prisma.roomMessage.findMany({
    where: cursor
      ? {
          ...where,
          OR: [
            {
              createdAt: {
                lt: cursor.ts
              }
            },
            {
              createdAt: cursor.ts,
              id: {
                lt: cursor.id
              }
            }
          ]
        }
      : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      senderType: true,
      author: {
        select: {
          role: true,
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? makeCursor(page[page.length - 1]) : null;
  const authorIds = Array.from(new Set(page.map(m => m.authorId).filter(Boolean)));
  const displayNameMap = await getMemberDisplayNames(roomId, authorIds);

  /* T20 P2: aktiivsete kinnitusringide seis sama päringu küljes — klient ei
     tee eraldi ringi-päringut. Üksikvastused on nähtavad ainult jagajale. */
  let summaryApprovals = [];
  try {
    summaryApprovals = await listRoomSummaryApprovalState({
      roomId,
      viewerId: auth.userId,
      viewerRole: auth.userRole
    });
  } catch {}

  return json({
    ok: true,
    roomTitle: room.title || "",
    roomRole: String(access.member?.role || auth.userRole || "").trim().toUpperCase(),
    isHelpMatchRoom: Boolean(room.helpMatch?.id),
    roomOrigin: serializeRoomOrigin(room),
    summaryApprovals,
    messages: page.map(m => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      authorId: m.authorId,
      senderType: m.senderType || "USER",
      authorName:
        m.senderType === "ASSISTANT"
          ? ""
          : displayNameMap.get(m.authorId) || [m.author?.profile?.firstName, m.author?.profile?.lastName].filter(Boolean).join(" ") || "",
      authorRole: m.author?.role || "CLIENT"
    })),
    nextCursor
  });
  } catch (err) {
    console.error("[room messages GET] failed", safeError(err));
    return errorJson("api.rooms.messages_failed", 500);
  }
}

export async function POST(req, { params }) {
  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const access = await ensureAccess(auth.userId, roomId, auth.userRole, ROOM_WRITE);
  if (!access.ok) return errorJson(access.message, access.status || 403);

  // E3 (audit 18 K3/K4): väravab ENNE kallist tööd (JSON-parse, privaatsuskontroll,
  // summeeringu-lookup). Võti = autenditud userId + roomId; võltsitavat IP-d EI
  // kasutata, et ratast ei saaks IP-rotatsiooniga mööda hiilida.
  const limiter = consumeRateLimit(`roommsg:${roomId}:${auth.userId}`, RATE_LIMIT_POST, RATE_LIMIT_WINDOW_MS);
  if (!limiter.allowed) {
    return json({ ok: false, messageKey: "api.common.rate_limited", message: "api.common.rate_limited" }, 429);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return errorJson("api.common.invalid_json", 400);
  }
  // U10: sharing a confirmed meeting summary posts the specialist-owned FINAL
  // MEETING_SUMMARY artifact's content into the room; otherwise a plain message.
  let rawContent;
  let sharedSummary = null;
  const artifactId = String(payload?.summaryArtifactId || "").trim();
  if (artifactId) {
    try {
      sharedSummary = await resolveShareableMeetingSummary(auth.userId, artifactId, {
        role: auth.userRole
      });
      // T20 P1: ka jagatud kokkuvõttel on lagi — varem läks piiramatult DB-sse.
      if (sharedSummary.content.length > MAX_SHARED_SUMMARY_LENGTH) {
        return errorJson("api.rooms.summary_too_long", 413);
      }
      // T20 P1: artefakti tiitel sõnumi päisesse — ruumis peab olema näha,
      // MIS dokumenti jagati, mitte ainult selle sisu.
      rawContent = sharedSummary.title
        ? `${sharedSummary.title}\n\n${sharedSummary.content}`
        : sharedSummary.content;
    } catch (shareError) {
      return errorJson(shareError?.message || "api.rooms.summary_share_failed", Number(shareError?.status) || 500);
    }
  } else {
    rawContent = String(payload?.content || "").trim();
    if (rawContent.length > MAX_MESSAGE_LENGTH) return errorJson("api.rooms.message_too_long", 413);
  }
  const privacy = evaluateTextPrivacy(rawContent, {
    workflow: "room_private",
    privacyDecision: payload?.privacyDecision
  });
  if (privacy.needsPrivacyConfirmation) {
    return json(privacyConfirmationResponsePayload(privacy), 409);
  }
  const content = String(privacy.processedText || rawContent).trim();
  if (!content) return errorJson("api.rooms.message_required", 400);

  try {
    /* SOL-ROOM-06: sõnum ja jagamise kandja sünnivad ÜHES tehingus. Varem loodi sõnum
       esimesena ja `recordSharedRoomSummary` neelas oma vea — kõik nägid ruumis
       kokkuvõtet, aga ruumi lõppedes ei saanud keegi privaatkoopiat, sest üleandmine
       loeb ainult `RoomSharedSummary` ridu. Nüüd on kas mõlemad või mitte kumbki. */
    const msg = await prisma.$transaction(async (tx) => {
      const created = await tx.roomMessage.create({
      data: {
        roomId,
        authorId: auth.userId,
        content,
        senderType: "USER"
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        authorId: true,
        senderType: true,
        author: {
          select: {
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
      });

      if (sharedSummary) {
        await recordSharedRoomSummary({
          db: tx,
          roomId,
          summary: sharedSummary,
          messageId: created.id,
          sharedByUserId: auth.userId
        });
      }
      await markHelpMatchContactedByRoom({ roomId }, tx);
      return created;
    });

    const memberDisplay = await prisma.roomMember.findFirst({
      where: {
        roomId,
        userId: auth.userId
      },
      select: {
        displayName: true
      }
    });

    /* T12 E7: jagatud kokkuvõte seotakse ruumiga, et ruumi lõppedes saaks iga
       osaleja sellest privaatse koopia. Sisu salvestatakse snapshot'ina —
       artefakti hilisem muutmine ei kirjuta ümber seda, mida ruumis nähti. */
    let approvalOutcome = null;
    if (sharedSummary) {
      /* T20 P2: sisu-muutuse tuvastus vajab jagamise-EELSET snapshot'i —
         vana kinnitus ei tohi jääda uue teksti külge. */
      let priorShare = null;
      try {
        priorShare = await prisma.roomSharedSummary.findFirst({
          where: { roomId, artifactId: sharedSummary.id },
          select: { content: true }
        });
      } catch {}
      /* T20 P2 (O-CO-2 = a): jagaja võib küsida osalejatelt kinnitusringi.
         Ei viska — jagamine ise on juba õnnestunud ja kandja on tehingus kirjas.
         SOL-ROOM-06: aga tema ebaõnnestumine ei tohi ka VAIKIDA — jagaja saab
         vastuses ausa osalise seisu. */
      approvalOutcome = await applySummaryApprovalPolicy({
        roomId,
        artifactId: sharedSummary.id,
        prior: priorShare,
        requestApproval: payload?.requestSummaryApproval === true
      });
      /* T20 P1: jagamine saab artefakti auditijälje (RUUM-A0 8 K2 auk).
         logDocumentsAudit ei viska kunagi. */
      await logDocumentsAudit("artifact.shared", {
        userId: auth.userId,
        artifactId: sharedSummary.id,
        roomId,
        messageId: msg.id
      });
    }

    const responsePayload = {
      ok: true,
      ...(sharedSummary
        ? {
            summaryShare: {
              recorded: true,
              approvalRequested: approvalOutcome?.ringOpened === true,
              approvalFailed: approvalOutcome?.failed === true
            }
          }
        : {}),
      message: {
        ...msg,
        authorName: memberDisplay?.displayName || [msg.author?.profile?.firstName, msg.author?.profile?.lastName].filter(Boolean).join(" ") || "",
        authorRole: msg.author?.role || "CLIENT"
      }
    };
    try {
      publishRoomEvent(roomId, {
        type: "message",
        message: responsePayload.message
      });
    } catch {}
    return json(responsePayload);
  } catch (err) {
    console.error("[room message POST] failed", safeError(err));
    return errorJson("api.rooms.send_failed", 500);
  }
}
