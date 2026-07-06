import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasRoomBillingAccess } from "@/lib/rooms/access";
import { serializeRoomOrigin } from "@/lib/rooms/origin";
import { safeError } from "@/lib/privacy/safeError";

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

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status);
  try {
    const isAdmin = auth.userRole === "ADMIN";
    const userActiveSubscription = isAdmin ? true : await hasActiveSubscription(auth.userId);
    const memberships = await prisma.roomMember.findMany({
          where: {
            userId: auth.userId,
            leftAt: null
          },
          select: {
            roomId: true,
            role: true,
            billingSource: true,
            lastReadAt: true,
            room: {
              select: {
                id: true,
                title: true,
                description: true,
                originType: true,
                originId: true,
                originLabel: true,
                originMeta: true,
                helpMatch: {
                  select: {
                    id: true
                  }
                },
                messages: {
                  where: {
                    deletedAt: null
                  },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                  select: {
                    id: true,
                    content: true,
                    createdAt: true
                  }
                }
              }
            }
          },
          orderBy: { joinedAt: "asc" }
        });

    const rawMemberships = memberships;

    const normalizedMemberships = rawMemberships
      .map(m => ({
        ...m,
        roomId: String(m?.roomId || "").trim()
      }))
      .filter(m => {
        if (!m.roomId || !m?.room) return false;
        return hasRoomBillingAccess({
          userRole: auth.userRole,
          membership: m,
          hasActiveSubscription: userActiveSubscription,
          room: m.room
        }).ok;
      });

    if (!normalizedMemberships.length) {
      return json({
        ok: true,
        rooms: []
      });
    }

    const rooms = await Promise.all(
      normalizedMemberships.map(async m => {
        const canTrackUnread = true;
        const [memberCount, unreadCount] = await Promise.all([
          prisma.roomMember.count({
            where: {
              roomId: m.roomId,
              leftAt: null
            }
          }),
          canTrackUnread
            ? prisma.roomMessage.count({
                where: {
                  roomId: m.roomId,
                  deletedAt: null,
                  authorId: {
                    not: auth.userId
                  },
                  createdAt: {
                    gt: m.lastReadAt || new Date(0)
                  }
                }
              })
            : Promise.resolve(0)
        ]);

        const last = m.room.messages?.[0];
        return {
          id: m.roomId,
          title: m.room.title || null,
          description: m.room.description || "",
          role: m.role,
          isHelpMatchRoom: Boolean(m.room.helpMatch?.id),
          origin: serializeRoomOrigin(m.room),
          memberCount,
          lastMessage: last
            ? {
                id: last.id,
                content: last.content,
                createdAt: last.createdAt
              }
            : null,
          unreadCount
        };
      })
    );

    return json({
      ok: true,
      rooms
    });
  } catch (err) {
    console.error("[rooms GET] failed", safeError(err));
    return errorJson("rooms.error", 500);
  }
}
