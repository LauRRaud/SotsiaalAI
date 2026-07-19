import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createRoomCallService } from "@/lib/calls/roomRoutes";
import { ROOM_ORIGIN_TYPES } from "@/lib/rooms/origin";
import { copyRoomSummariesToParticipants } from "@/lib/rooms/summaryHandover";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

async function resolveRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

export async function DELETE(_req, { params }) {
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId }
    });
    if (!room) return errorJson("api.rooms.not_found", 404);

    if (room.ownerId !== auth.userId) {
      return errorJson("api.common.forbidden", 403);
    }

    // E4 (audit 16 K2): voo-põhist ruumi (HELP_MATCH / PRE_INQUIRY /
    // SERVICE_PROVIDER_INQUIRY) ei tohi omanik ühepoolselt kustutada — ühine
    // ajalugu ei kustu ühe poole klõpsust. Ainult MANUAL_INVITE ruumi saab
    // kustutada; muidu 409 + „arhiveeri" (PATCH action=archive) alternatiiv.
    if (String(room.originType || "") !== ROOM_ORIGIN_TYPES.MANUAL_INVITE) {
      return errorJson("api.rooms.delete_stream_room_forbidden", 409, { canArchive: true });
    }

    // E1: lõpeta enne kustutust kõik aktiivsed kõned (koristab osalejad,
    // sõnavõtusoovid, salvestuse/egress). CallSession.roomId on SetNull — ilma
    // selleta jääks käiv kõne igaveseks ACTIVE-ks ja egress orvuks (audit 16 K1).
    // Kui koristus ebaõnnestub, EI kustuta (aus 500 + retry), et mitte orvustada.
    try {
      const callService = createRoomCallService();
      await callService.endActiveRoomCall({ roomId, actorUserId: auth.userId });
    } catch (callErr) {
      console.error("[room delete] active call cleanup failed", callErr);
      return errorJson("api.rooms.delete_failed", 500);
    }

    /* E7 osa 1: kokkuvõtte privaatkoopiad tehakse ENNE hävitamist (copy-first,
       sama muster mis T16 kustutusvoos). Kui üleandmine ebaõnnestub, EI kustuta
       — vaikselt kaotatud kokkuvõte oleks halvem kui aus 500 + kordus. */
    try {
      await copyRoomSummariesToParticipants({ roomId });
    } catch (summaryErr) {
      console.error("[room delete] summary handover failed", summaryErr);
      return errorJson("api.rooms.delete_failed", 500);
    }

    // E1: auditijälg ENNE hävitamist (audit 16 K4).
    const [memberCount, messageCount] = await Promise.all([
      prisma.roomMember.count({ where: { roomId } }),
      prisma.roomMessage.count({ where: { roomId } })
    ]);
    if (prisma.dataAuditLog?.create) {
      await prisma.dataAuditLog.create({
        data: {
          actorUserId: auth.userId,
          action: "ROOM_DELETED",
          resourceType: "Room",
          resourceId: roomId,
          meta: {
            title: room.title || null,
            originType: room.originType || null,
            memberCount,
            messageCount
          }
        }
      });
    }

    await prisma.room.delete({
      where: { id: roomId }
    });

    return json({
      ok: true
    });
  } catch (err) {
    console.error("[room delete] failed", err);
    return errorJson("api.rooms.delete_failed", 500);
  }
}

// E4 (audit 16 K2): voo-ruumi „arhiveeri" — soft-arhiiv, mis lõpetab aktiivsed
// kõned, aga SÄILITAB sõnumid ja ühise ajaloo (erinevalt kustutusest). Ainult
// omanik; idempotentne; tingimuslik kirjutus (ei kaota arhiveerijat race'is).
export async function PATCH(req, { params }) {
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);

  let body;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (String(body?.action || "").trim() !== "archive") {
    return errorJson("api.common.invalid_request", 400);
  }

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return errorJson("api.rooms.not_found", 404);
    if (room.ownerId !== auth.userId) return errorJson("api.common.forbidden", 403);
    if (room.archivedAt) return json({ ok: true, archivedAt: room.archivedAt });

    // Lõpeta aktiivsed kõned (koristab osalejad/salvestuse), aga ära kustuta ruumi.
    try {
      await createRoomCallService().endActiveRoomCall({ roomId, actorUserId: auth.userId });
    } catch (callErr) {
      console.error("[room archive] active call cleanup failed", callErr);
      return errorJson("api.rooms.archive_failed", 500);
    }

    /* E7 osa 1: ka arhiveerimine on ruumi lõpp — kokkuvõte antakse üle enne
       arhiivi märkimist. Idempotentne, seega hilisem kustutus ei korda koopiat. */
    try {
      await copyRoomSummariesToParticipants({ roomId });
    } catch (summaryErr) {
      console.error("[room archive] summary handover failed", summaryErr);
      return errorJson("api.rooms.archive_failed", 500);
    }

    const now = new Date();
    const updated = await prisma.room.updateMany({
      where: { id: roomId, archivedAt: null },
      data: { archivedAt: now }
    });
    if (updated.count > 0 && prisma.dataAuditLog?.create) {
      await prisma.dataAuditLog.create({
        data: {
          actorUserId: auth.userId,
          action: "ROOM_ARCHIVED",
          resourceType: "Room",
          resourceId: roomId,
          meta: { title: room.title || null, originType: room.originType || null }
        }
      });
    }
    return json({ ok: true, archivedAt: now });
  } catch (err) {
    console.error("[room archive] failed", err);
    return errorJson("api.rooms.archive_failed", 500);
  }
}
