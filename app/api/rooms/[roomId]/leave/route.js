import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";

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
      userId: session.user.id
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

export async function POST(_req, { params }) {
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  try {
    const membership = await prisma.roomMember.findFirst({
      where: {
        roomId,
        userId: auth.userId,
        leftAt: null
      }
    });
    if (!membership) return errorJson("api.rooms.not_member", 404);
    if (membership.role === "OWNER") {
      return errorJson("api.rooms.owner_cannot_leave", 409);
    }

    await prisma.roomMember.update({
      where: {
        roomId_userId: {
          roomId,
          userId: auth.userId
        }
      },
      data: {
        leftAt: new Date()
      }
    });

    return json({
      ok: true
    });
  } catch (err) {
    console.error("[room leave] failed", err);
    return errorJson("api.rooms.leave_failed", 500);
  }
}
