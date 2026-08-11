import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { transferRoomOwnership } from "@/lib/rooms/ownership";
import { notifyRoomOwnershipTransferred } from "@/lib/rooms/lifecycleNotifications";

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
    // Kogu otsus käib ruumipõhise nõuandeluku sees ja jälg sünnib samas tehingus
    // (SOL-ROOM-04, SOL-ROOM-05). Varem loeti sihtmärgi aktiivsust ENNE tehingut ja
    // audit kirjutati PÄRAST teda.
    const outcome = await transferRoomOwnership({
      db: prisma,
      roomId,
      actorUserId: auth.userId,
      targetUserId
    }).catch((error) => {
      if (error?.roomTransferConflict) {
        return { ok: false, status: 409, message: "api.rooms.transfer_conflict" };
      }
      throw error;
    });
    if (!outcome.ok) return errorJson(outcome.message, outcome.status);

    /* T20 P3 (O-CO-3 b): üleminek on osalejatele nähtav — uus omanik ja liikmed
       saavad teate. Ei viska kunagi; vahetus ise on juba tehtud. */
    await notifyRoomOwnershipTransferred({
      roomId,
      previousOwnerId: auth.userId,
      newOwnerId: targetUserId
    });

    return json({ ok: true, ownerId: targetUserId });
  } catch (err) {
    console.error("[room transfer] failed", err);
    return errorJson("api.rooms.transfer_failed", 500);
  }
}
