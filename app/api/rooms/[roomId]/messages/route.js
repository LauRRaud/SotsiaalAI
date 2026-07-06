import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publishRoomEvent } from "@/lib/roomStream";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getRequestIpFromRequest } from "@/lib/request-ip";
import { hasRoomBillingAccess } from "@/lib/rooms/access";
import { serializeRoomOrigin } from "@/lib/rooms/origin";
import { safeError } from "@/lib/privacy/safeError";
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 50;
const RATE_LIMIT_WINDOW_MS = Number(process.env.ROOM_MESSAGES_POST_RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_POST = Number(process.env.ROOM_MESSAGES_POST_RATE_LIMIT_MAX || 20);

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

async function getMembership(userId, roomId) {
  return prisma.roomMember.findFirst({
    where: {
      userId,
      roomId,
      leftAt: null
    }
  });
}

async function getMemberDisplayNames(roomId, authorIds) {
  if (!authorIds.length) return new Map();
  const rows = await prisma.roomMember.findMany({
    where: {
      roomId,
      userId: {
        in: authorIds
      }
    },
    select: {
      userId: true,
      displayName: true
    }
  });
  return new Map(rows.map(m => [m.userId, m.displayName || ""]));
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
    status: 404,
    message: "api.rooms.not_found"
  };

  const member = await getMembership(userId, roomId);
  if (!member) return {
    ok: false,
    status: 403,
    message: "api.rooms.access_denied"
  };

  const userActive = await hasActiveSubscription(userId);
  const billingAccess = hasRoomBillingAccess({
    userRole,
    membership: member,
    hasActiveSubscription: userActive,
    room
  });
  if (billingAccess.ok) return {
    ok: true,
    member,
    billingSource: billingAccess.billingSource
  };
  return {
    ok: false,
    status: 403,
    message: "api.rooms.join_unavailable"
  };
}

function parseCursor(token) {
  if (!token) return null;
  const [ts, id] = token.split("_");
  const ms = Number(ts);
  if (!Number.isFinite(ms) || !id) return null;
  return {
    ts: new Date(ms),
    id
  };
}

function makeCursor(row) {
  if (!row) return null;
  const ms = row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime();
  if (!Number.isFinite(ms)) return null;
  return `${ms}_${row.id}`;
}

async function resolveRoomId(paramsLike) {
  const params = paramsLike instanceof Promise ? await paramsLike : paramsLike;
  return String(params?.roomId || "").trim();
}

export async function GET(req, { params }) {
  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const access = await ensureAccess(auth.userId, roomId, auth.userRole);
  if (!access.ok) return errorJson(access.message, access.status || 403);
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: {
      title: true,
      originType: true,
      originId: true,
      originLabel: true,
      originMeta: true,
      helpMatch: {
        select: {
          id: true
        }
      }
    }
  });
  if (!room) return errorJson("api.rooms.not_found", 404);

  const url = new URL(req.url);
  const limitParam = Number(url.searchParams.get("limit") || PAGE_SIZE);
  const limit = Math.max(1, Math.min(PAGE_SIZE, Number.isFinite(limitParam) ? limitParam : PAGE_SIZE));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  const where = {
    roomId,
    deletedAt: null
  };
  const take = limit + 1;
  const rows = await prisma.roomMessage.findMany({
    where: cursor
      ? {
          ...where,
          OR: [
            {
              createdAt: {
                lt: cursor.ts
              }
            },
            {
              createdAt: cursor.ts,
              id: {
                lt: cursor.id
              }
            }
          ]
        }
      : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      senderType: true,
      author: {
        select: {
          role: true,
          profile: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        }
      }
    }
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? makeCursor(page[page.length - 1]) : null;
  const authorIds = Array.from(new Set(page.map(m => m.authorId).filter(Boolean)));
  const displayNameMap = await getMemberDisplayNames(roomId, authorIds);

  return json({
    ok: true,
    roomTitle: room.title || "",
    roomRole: String(access.member?.role || auth.userRole || "").trim().toUpperCase(),
    isHelpMatchRoom: Boolean(room.helpMatch?.id),
    roomOrigin: serializeRoomOrigin(room),
    messages: page.map(m => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt,
      authorId: m.authorId,
      senderType: m.senderType || "USER",
      authorName:
        m.senderType === "ASSISTANT"
          ? ""
          : displayNameMap.get(m.authorId) || [m.author?.profile?.firstName, m.author?.profile?.lastName].filter(Boolean).join(" ") || "",
      authorRole: m.author?.role || "CLIENT"
    })),
    nextCursor
  });
}

export async function POST(req, { params }) {
  const roomId = await resolveRoomId(params);
  if (!roomId) return errorJson("api.common.missing_room_id", 400);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);

  const access = await ensureAccess(auth.userId, roomId, auth.userRole);
  if (!access.ok) return errorJson(access.message, access.status || 403);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return errorJson("api.common.invalid_json", 400);
  }
  const rawContent = String(payload?.content || "").trim();
  const privacy = evaluateTextPrivacy(rawContent, {
    workflow: "room_private",
    privacyDecision: payload?.privacyDecision
  });
  if (privacy.needsPrivacyConfirmation) {
    return json(privacyConfirmationResponsePayload(privacy), 409);
  }
  const content = String(privacy.processedText || rawContent).trim();
  if (!content) return errorJson("api.rooms.message_required", 400);

  const ip = getRequestIpFromRequest(req);
  const limiter = consumeRateLimit(`roommsg:${roomId}:${auth.userId}:${ip}`, RATE_LIMIT_POST, RATE_LIMIT_WINDOW_MS);
  if (!limiter.allowed) {
    return json(
      {
        ok: false,
        messageKey: "api.common.rate_limited",
        message: "api.common.rate_limited"
      },
      429
    );
  }

  try {
    const msg = await prisma.roomMessage.create({
      data: {
        roomId,
        authorId: auth.userId,
        content,
        senderType: "USER"
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        authorId: true,
        senderType: true,
        author: {
          select: {
            role: true,
            profile: {
              select: {
                firstName: true,
                lastName: true
              }
            }
          }
        }
      }
    });

    const memberDisplay = await prisma.roomMember.findFirst({
      where: {
        roomId,
        userId: auth.userId
      },
      select: {
        displayName: true
      }
    });

    const responsePayload = {
      ok: true,
      message: {
        ...msg,
        authorName: memberDisplay?.displayName || [msg.author?.profile?.firstName, msg.author?.profile?.lastName].filter(Boolean).join(" ") || "",
        authorRole: msg.author?.role || "CLIENT"
      }
    };
    try {
      publishRoomEvent(roomId, {
        type: "message",
        message: responsePayload.message
      });
    } catch {}
    return json(responsePayload);
  } catch (err) {
    console.error("[room message POST] failed", safeError(err));
    return errorJson("api.rooms.send_failed", 500);
  }
}
