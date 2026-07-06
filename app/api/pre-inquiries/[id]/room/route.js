import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { getVisiblePreInquiry } from "@/lib/preInquiries";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { ROOM_ORIGIN_TYPES, buildRoomOrigin } from "@/lib/rooms/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireUser() {
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized"
    };
  }
  return {
    ok: true,
    userId
  };
}

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

function buildRoomTitle(inquiry) {
  const topic = String(inquiry?.topic || "").trim();
  if (topic) return `Eelpoordumine: ${topic.slice(0, 72)}`;
  const authorEmail = String(inquiry?.author?.email || "").trim();
  if (authorEmail) return `Eelpoordumine: ${authorEmail}`;
  return "Eelpoordumine";
}

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const inquiry = await getVisiblePreInquiry(auth.userId, await readId(context));
    if (!inquiry) return errorJson("api.common.not_found", 404, locale);

    const isAuthor = inquiry.authorId === auth.userId;
    const isRecipient = inquiry.recipientOwnerId === auth.userId;
    if (!isAuthor && !isRecipient) {
      return errorJson("api.common.forbidden", 403, locale);
    }

    const participantIds = [auth.userId, inquiry.authorId, inquiry.recipientOwnerId]
      .filter(Boolean)
      .map((value) => String(value));
    const uniqueParticipantIds = [...new Set(participantIds)];
    if (uniqueParticipantIds.length < 2) {
      return errorJson("pre_inquiries.errors.room_requires_platform_recipient", 409, locale);
    }

    const marker = `preInquiry:${inquiry.id}`;
    const existingRoom = await prisma.room.findFirst({
      where: {
        description: {
          contains: marker
        },
        members: {
          some: {
            userId: auth.userId,
            leftAt: null
          }
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    if (existingRoom) {
      return json({
        ok: true,
        room: existingRoom
      });
    }

    const room = await prisma.room.create({
      data: {
        ownerId: auth.userId,
        title: buildRoomTitle(inquiry),
        description: `${marker}\nSotsiaalAI eelpoordumise vestlusruum.`,
        ...buildRoomOrigin({
          originType: inquiry.recipientType === "SERVICE_PROVIDER"
            ? ROOM_ORIGIN_TYPES.SERVICE_PROVIDER_INQUIRY
            : ROOM_ORIGIN_TYPES.PRE_INQUIRY,
          originId: inquiry.id,
          originMeta: {
            recipientType: inquiry.recipientType || "",
            selectedRecipientName: inquiry.selectedRecipientName || ""
          }
        }),
        members: {
          create: uniqueParticipantIds.map((userId) => ({
            userId,
            role: userId === auth.userId ? "OWNER" : "MEMBER",
            billingSource: "SELF"
          }))
        }
      },
      select: {
        id: true,
        title: true
      }
    });

    await prisma.preInquiry.update({
      where: { id: inquiry.id },
      data: {
        status: inquiry.status === "DRAFT" ? "READY" : inquiry.status
      }
    }).catch(() => null);

    return json({
      ok: true,
      room
    }, 201);
  } catch (error) {
    console.error("[pre-inquiries] room open failed", safeError(error));
    return errorJson("pre_inquiries.errors.room_failed", 500, locale);
  }
}
