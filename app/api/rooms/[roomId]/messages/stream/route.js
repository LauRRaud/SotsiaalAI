import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { subscribeRoom } from "@/lib/roomStream";
import { hasRoomBillingAccess } from "@/lib/rooms/access";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
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
      OR: [{
        validUntil: null
      }, {
        validUntil: {
          gt: now
        }
      }]
    },
    select: {
      id: true
    }
  });
  return Boolean(sub);
}
async function ensureAccess(userId, roomId, userRole) {
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
  if (!room) return {
    ok: false,
    status: 404
  };
  const member = await prisma.roomMember.findFirst({
    where: {
      userId,
      roomId,
      leftAt: null
    }
  });
  if (!member) return {
    ok: false,
    status: 403
  };
  const userActive = await hasActiveSubscription(userId);
  const billingAccess = hasRoomBillingAccess({
    userRole,
    membership: member,
    hasActiveSubscription: userActive,
    room
  });
  if (billingAccess.ok) return {
    ok: true
  };
  return {
    ok: false,
    status: 403
  };
}
function sseHeaders() {
  return {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  };
}

async function resolveRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

export async function GET(_req, {
  params
}) {
  const roomId = await resolveRoomId(params);
  if (!roomId) {
    return new NextResponse("api.common.missing_room_id", {
      status: 400
    });
  }
  const auth = await requireUser();
  if (!auth.ok) return new NextResponse(null, {
    status: auth.status
  });
  const access = await ensureAccess(auth.userId, roomId, auth.userRole);
  if (!access.ok) return new NextResponse(null, {
    status: access.status || 403
  });
  let cleanup = null;
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let cleaned = false;
      let closed = false;
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {}
      };
      const write = data => controller.enqueue(encoder.encode(data));
      const unsubscribe = subscribeRoom(roomId, evt => {
        if (cleaned) return;
        try {
          write(`data: ${JSON.stringify(evt)}\n\n`);
        } catch {
          doCleanup();
          safeClose();
        }
      });
      const heartbeat = setInterval(() => {
        if (cleaned) return;
        try {
          write(": keep-alive\n\n");
        } catch {
          doCleanup();
          safeClose();
        }
      }, 15000);
      const recheck = setInterval(async () => {
        try {
          const ok = await ensureAccess(auth.userId, roomId, auth.userRole);
          if (!ok.ok) {
            doCleanup();
            safeClose();
          }
        } catch {
          doCleanup();
          safeClose();
        }
      }, 20000);
      const doCleanup = () => {
        if (cleaned) return;
        cleaned = true;
        clearInterval(heartbeat);
        clearInterval(recheck);
        unsubscribe();
      };
      cleanup = doCleanup;
      try {
        write(": connected\n\n");
      } catch {
        doCleanup();
        safeClose();
      }
    },
    cancel() {
      cleanup?.();
    }
  });
  return new NextResponse(stream, {
    status: 200,
    headers: sseHeaders()
  });
}
