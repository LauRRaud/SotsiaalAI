import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ROOM_READ, resolveRoomAccess } from "@/lib/rooms/accessGuard";
import { markNotificationSourceRead } from "@/lib/notifications";

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
    // Lugemismärge on LUGEMINE, mitte kirjutus (SOL-ROOM-01): ta ei muuda ühist ajalugu ega
    // koosseisu, ja arhiveeritud ruum peab jääma maha märgitavaks.
    const access = await resolveRoomAccess({
      userId: auth.userId,
      userRole: auth.userRole,
      roomId,
      intent: ROOM_READ,
      hasActiveSubscription
    });
    if (!access.ok) return errorJson(access.message, access.status);

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
    const memberLastReadAt = access.member?.lastReadAt || null;
    const nextLastReadAt =
      memberLastReadAt && memberLastReadAt > latestReadAt ? memberLastReadAt : latestReadAt;
    await prisma.$transaction(async (tx) => {
      await tx.roomMember.update({
        where: {
          roomId_userId: {
            roomId,
            userId: auth.userId
          }
        },
        data: { lastReadAt: nextLastReadAt }
      });
      await markNotificationSourceRead(auth.userId, {
        sourceType: "ROOM",
        sourceId: roomId
      }, { db: tx, now: nextLastReadAt });
    });
    return json({
      ok: true
    });
  } catch (err) {
    console.error("[room read] failed", err);
    return errorJson("api.rooms.read_update_failed", 500);
  }
}
