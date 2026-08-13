import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { reopenPreInquiry } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { enforcePreInquiryRateLimit, preInquiryErrorJson } from "@/lib/preInquiryApiBoundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return errorJson("api.common.unauthorized", 401, locale);
  const limited = enforcePreInquiryRateLimit(request, { action: "mutate", userId });
  if (limited) return limited;

  try {
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    const inquiry = await reopenPreInquiry(userId, String(params?.id || "").trim(), {
      expectedUpdatedAt: body?.expectedUpdatedAt
    });
    return json({ ok: true, inquiry });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[pre-inquiries] reopen failed", safeError(error));
    return preInquiryErrorJson(error, locale, "pre_inquiries.errors.reopen_failed");
  }
}
