import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { confirmExternalPreInquirySent } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { enforcePreInquiryRateLimit, preInquiryErrorJson, publicPreInquiryError } from "@/lib/preInquiryApiBoundary";

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
    session,
    userId
  };
}

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }
  const limited = enforcePreInquiryRateLimit(request, { action: "send", userId: auth.userId });
  if (limited) return limited;

  try {
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const inquiry = await confirmExternalPreInquirySent(auth.userId, String(params?.id || "").trim(), {
      expectedUpdatedAt: body?.expectedUpdatedAt
    });
    return json({
      ok: true,
      inquiry
    });
  } catch (error) {
    if (publicPreInquiryError(error).status >= 500) {
      console.error("[pre-inquiries] external send failed", safeError(error));
    }
    return preInquiryErrorJson(error, locale, "pre_inquiries.errors.send_failed");
  }
}
