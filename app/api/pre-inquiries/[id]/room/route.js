import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest, publicErrorMessageKey, publicErrorStatus } from "@/lib/documents/server";
import { getVisiblePreInquiry } from "@/lib/preInquiries";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/privacy/safeError";
import { ensureRoomForPreInquiry } from "@/lib/rooms/preInquiryRoom";

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

    const { room, created } = await ensureRoomForPreInquiry({
      userId: auth.userId,
      inquiry,
      participantIds: uniqueParticipantIds
    });

    if (created) {
      await prisma.preInquiry.update({
        where: { id: inquiry.id },
        data: {
          status: inquiry.status === "DRAFT" ? "READY" : inquiry.status
        }
      }).catch(() => null);
    }

    return json({
      ok: true,
      room
    }, created ? 201 : 200);
  } catch (error) {
    // Controlled pre-inquiry-room 409 that the public-key whitelist (api.*/
    // documents.*) does not cover — surfaced explicitly so it never becomes a 500.
    if (Number(error?.status) === 409 && error?.message === "pre_inquiries.errors.room_requires_platform_recipient") {
      return errorJson(error.message, 409, locale);
    }
    // Only whitelisted public error keys (api.*/documents.*) are surfaced with
    // their status — e.g. the helper's generic 403 (api.common.forbidden) / 404
    // (api.common.not_found). Anything else is a generic 500; no room existence
    // or raw error message is leaked.
    const status = publicErrorStatus(error, 500);
    if (status >= 500) {
      console.error("[pre-inquiries] room open failed", safeError(error));
      return errorJson("pre_inquiries.errors.room_failed", 500, locale);
    }
    return errorJson(publicErrorMessageKey(error, "pre_inquiries.errors.room_failed"), status, locale);
  }
}
