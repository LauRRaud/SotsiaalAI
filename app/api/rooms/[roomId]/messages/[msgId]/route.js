import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { hasRoomBillingAccess } from "@/lib/rooms/access";

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
      role: session.user.role
    };
  } catch {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }
}

async function canDelete(userId, roomId, authorId, userRole) {
  if (userRole === "OWNER" || userRole === "MODERATOR") return true;
  return userRole === "MEMBER" && userId === authorId;
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

async function resolveRouteParams(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return {
    roomId: String(params?.roomId || "").trim(),
    msgId: String(params?.msgId || "").trim()
  };
}

export async function DELETE(_req, { params }) {
  const { roomId, msgId } = await resolveRouteParams(params);
  if (!roomId || !msgId) return errorJson("api.rooms.missing_room_id_or_msg_id", 400);

  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  try {
    const membership = await prisma.roomMember.findFirst({
            where: {
              roomId,
              userId: auth.userId,
              leftAt: null
            }
          });
    if (!membership) return errorJson("api.common.forbidden", 403);

    const [room, userActive] = await Promise.all([
      prisma.room.findUnique({
        where: { id: roomId },
        select: {
          id: true,
          helpMatch: {
            select: {
              id: true
            }
          }
        }
      }),
      auth.role === "ADMIN" ? Promise.resolve(true) : hasActiveSubscription(auth.userId)
    ]);
    if (!room) return errorJson("api.rooms.not_found", 404);
    const billingAccess = hasRoomBillingAccess({
      userRole: auth.role,
      membership,
      hasActiveSubscription: userActive,
      room
    });
    if (!billingAccess.ok) return errorJson("api.common.forbidden", 403);

    const message = await prisma.roomMessage.findFirst({
      where: {
        id: msgId,
        roomId
      },
      select: {
        id: true,
        authorId: true,
        deletedAt: true
      }
    });
    if (!message) return errorJson("api.rooms.message_not_found", 404);

    if (message.deletedAt) {
      return json({
        ok: true,
        id: msgId,
        deleted: true
      });
    }

    const allowed = await canDelete(auth.userId, roomId, message.authorId, membership.role);
    if (!allowed) return errorJson("api.common.forbidden", 403);

    await prisma.roomMessage.update({
      where: { id: msgId },
      data: {
        deletedAt: new Date()
      }
    });
    try {
      publishRoomEvent(roomId, {
        type: "delete",
        id: msgId
      });
    } catch {}
    return json({
      ok: true,
      id: msgId,
      deleted: true
    });
  } catch (err) {
    console.error("[room message delete] failed", err);
    return errorJson("api.rooms.delete_message_failed", 500);
  }
}
