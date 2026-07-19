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
  return json({ ok: false, messageKey, message: messageKey, ...extras }, status);
}

async function requireUser() {
  try {
    const session = await getServerSession(authConfig);
    if (!session?.user?.id) return { ok: false, status: 401, message: "api.common.unauthorized" };
    return { ok: true, userId: session.user.id };
  } catch {
    return { ok: false, status: 401, message: "api.common.unauthorized" };
  }
}

async function resolveRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

// E4 (audit 16 K6): omanikuvahetus. OWNER annab ruumi üle valitud aktiivsele
// liikmele (MODERATOR/MEMBER) enne lahkumist — ruum ei jää orvuks. Tingimuslik
// kirjutus tagab, et paralleelne vahetus ei kaota omanikku (TOCTOU-kindel).
export async function POST(req, { params }) {
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
  const targetUserId = String(body?.targetUserId || "").trim();
  if (!targetUserId || targetUserId === auth.userId) {
    return errorJson("api.rooms.transfer_target_required", 400);
  }

  try {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return errorJson("api.rooms.not_found", 404);
    if (room.ownerId !== auth.userId) return errorJson("api.common.forbidden", 403);
    if (room.archivedAt) return errorJson("api.rooms.archived_readonly", 409);

    // Sihtmärk peab olema ruumi aktiivne liige.
    const target = await prisma.roomMember.findFirst({
      where: { roomId, userId: targetUserId, leftAt: null }
    });
    if (!target) return errorJson("api.rooms.transfer_target_not_member", 404);

    // Atomaarne omanikuvahetus: ruumi ownerId + mõlema liikme roll ühes tehingus.
    // Ilma selleta jätaks protsessi katkemine kirjutuste vahel omandi ja rollid
    // vastuollu (vana omanik võiks säilitada kutseõiguse, sest requireRoomRole
    // aktsepteerib roomMember.role==OWNER). Tingimuslik kirjutus tehingu sees
    // hoiab TOCTOU-kindluse: vaheta ainult siis, kui ruum kuulub veel algatajale.
    const outcome = await prisma.$transaction(async (tx) => {
      const moved = await tx.room.updateMany({
        where: { id: roomId, ownerId: auth.userId },
        data: { ownerId: targetUserId }
      });
      if (moved.count < 1) return { conflict: true };

      // Rollivahetus: uus omanik → OWNER, vana omanik jääb liikmeks (MODERATOR).
      await tx.roomMember.updateMany({
        where: { roomId, userId: targetUserId },
        data: { role: "OWNER" }
      });
      await tx.roomMember.updateMany({
        where: { roomId, userId: auth.userId },
        data: { role: "MODERATOR" }
      });
      return { conflict: false };
    });
    if (outcome.conflict) return errorJson("api.rooms.transfer_conflict", 409);

    if (prisma.dataAuditLog?.create) {
      await prisma.dataAuditLog.create({
        data: {
          actorUserId: auth.userId,
          targetUserId,
          action: "ROOM_OWNERSHIP_TRANSFERRED",
          resourceType: "Room",
          resourceId: roomId,
          meta: { title: room.title || null }
        }
      });
    }

    return json({ ok: true, ownerId: targetUserId });
  } catch (err) {
    console.error("[room transfer] failed", err);
    return errorJson("api.rooms.transfer_failed", 500);
  }
}
