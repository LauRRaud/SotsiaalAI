import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { subscribeRoom } from "@/lib/roomStream";
import { ROOM_READ, resolveRoomAccess } from "@/lib/rooms/accessGuard";
import { createRoomEventStream } from "@/lib/rooms/eventStream";
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
// Jagatud värav (SOL-ROOM-01). Voog on LUGEMINE, seega arhiveeritud ruumi ajalugu jääb
// kättesaadavaks; kirjutused sulgeb sama helper mujal.
function ensureAccess(userId, roomId, userRole) {
  return resolveRoomAccess({
    userId,
    userRole,
    roomId,
    intent: ROOM_READ,
    hasActiveSubscription
  });
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
  /* Audit T01: ligipääsu kontrollitakse enne IGA sündmuse väljasaatmist, mitte ainult
     ühenduse loomisel ja iga 20 sekundi järel. Ruumist lahkunu ei saa enam ühtegi
     uut sõnumit. Loogika ja selle kontrollid on `lib/rooms/eventStream.js`-is. */
  const stream = createRoomEventStream({
    subscribe: listener => subscribeRoom(roomId, listener),
    checkAccess: async () => (await ensureAccess(auth.userId, roomId, auth.userRole)).ok === true
  });
  return new NextResponse(stream, {
    status: 200,
    headers: sseHeaders()
  });
}
