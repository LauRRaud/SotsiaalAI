import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest, publicErrorMessageKey, publicErrorStatus } from "@/lib/documents/server";
import { getVisiblePreInquiry } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { ensureRoomForPreInquiry, findOrganizationInquiryForWorker } from "@/lib/rooms/preInquiryRoom";
import { enforcePreInquiryRateLimit } from "@/lib/preInquiryApiBoundary";

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
  const limited = enforcePreInquiryRateLimit(request, { action: "mutate", userId: auth.userId });
  if (limited) return limited;

  try {
    const inquiryId = await readId(context);
    /* Asutuse vastuvõtulaua töötaja ei ole pöördumise nimeline saaja: teda tunneb ainult
       vastu võetud töömääramine. Kumbki lugemine on eelkontroll; otsuse teeb
       `ensureRoomForPreInquiry` luku all andmebaasist. */
    const inquiry = await getVisiblePreInquiry(auth.userId, inquiryId)
      || await findOrganizationInquiryForWorker(auth.userId, inquiryId);
    if (!inquiry) return errorJson("api.common.not_found", 404, locale);

    /* Asutuse laual selgub teine osapool alles luku all (töö vastu võtnud töötaja), seega
       siinne osapoolte loendus käib ainult nimelise saaja kohta. */
    if (!inquiry.recipientOrganizationId) {
      const isAuthor = inquiry.authorId === auth.userId;
      const isRecipient = inquiry.recipientOwnerId === auth.userId;
      if (!isAuthor && !isRecipient) {
        return errorJson("api.common.forbidden", 403, locale);
      }

      const participantIds = [auth.userId, inquiry.authorId, inquiry.recipientOwnerId]
        .filter(Boolean)
        .map((value) => String(value));
      if (new Set(participantIds).size < 2) {
        return errorJson("pre_inquiries.errors.room_requires_platform_recipient", 409, locale);
      }
    }

    const { room, created } = await ensureRoomForPreInquiry({ userId: auth.userId, inquiry });

    return json({
      ok: true,
      room
    }, created ? 201 : 200);
  } catch (error) {
    // Controlled pre-inquiry-room 409 that the public-key whitelist (api.*/
    // documents.*) does not cover — surfaced explicitly so it never becomes a 500.
    if (Number(error?.status) === 409 && [
      "pre_inquiries.errors.room_requires_platform_recipient",
      "pre_inquiries.errors.room_requires_acceptance",
      "pre_inquiries.errors.not_sent"
    ].includes(error?.message)) {
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
