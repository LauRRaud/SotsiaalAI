import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createRoomCallService } from "@/lib/calls/roomRoutes";

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
