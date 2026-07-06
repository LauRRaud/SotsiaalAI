import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
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

async function resolveRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

export async function PUT(_req, { params }) {
  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  try {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        helpMatch: {
          select: {
            id: true
          }
        }
      }
    });
    if (!room) return errorJson("api.rooms.not_found", 404);

    const member = await prisma.roomMember.findFirst({
      where: {
        roomId,
        userId: auth.userId,
        leftAt: null
      },
      select: {
        roomId: true,
        userId: true,
        role: true,
        billingSource: true,
        lastReadAt: true,
        leftAt: true
      }
    });
    if (!member) return errorJson("api.common.forbidden", 403);

    const userActive = auth.userRole === "ADMIN" ? true : await hasActiveSubscription(auth.userId);
    const billingAccess = hasRoomBillingAccess({
      userRole: auth.userRole,
      membership: member,
      hasActiveSubscription: userActive,
      room
    });
    if (!billingAccess.ok) {
      return errorJson("api.common.forbidden", 403);
    }

    const latest = await prisma.roomMessage.findFirst({
      where: {
        roomId,
        deletedAt: null
      },
      orderBy: {
        createdAt: "desc"
      },
      select: {
        createdAt: true
      }
    });
    const latestReadAt = latest?.createdAt || new Date();
    const nextLastReadAt =
      member.lastReadAt && member.lastReadAt > latestReadAt
        ? member.lastReadAt
        : latestReadAt;
    await prisma.roomMember.update({
      where: {
        roomId_userId: {
          roomId,
          userId: auth.userId
        }
      },
      data: {
        lastReadAt: nextLastReadAt
      }
    });
    return json({
      ok: true
    });
  } catch (err) {
    console.error("[room read] failed", err);
    return errorJson("api.rooms.read_update_failed", 500);
  }
}
