import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { recallPreInquiry } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { enforcePreInquiryRateLimit } from "@/lib/preInquiryApiBoundary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_ERRORS = new Set([
  "api.common.not_found",
  "pre_inquiries.errors.external_cannot_be_recalled",
  "pre_inquiries.errors.already_opened",
  "pre_inquiries.errors.not_recallable",
  "pre_inquiries.errors.recall_conflict"
]);

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function POST(request, context) {
  const locale = localeFromRequest(request);
  const session = await getServerSession(authConfig).catch(() => null);
  const userId = String(session?.user?.id || "").trim();
  if (!userId) return errorJson("api.common.unauthorized", 401, locale);
  const limited = enforcePreInquiryRateLimit(request, { action: "mutate", userId });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const inquiry = await recallPreInquiry(userId, await readId(context), {
      expectedUpdatedAt: body?.expectedUpdatedAt
    });
    return json({ ok: true, inquiry });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[pre-inquiries] recall failed", safeError(error));
    const messageKey = status < 500 && PUBLIC_ERRORS.has(error?.message)
      ? error.message
      : "pre_inquiries.errors.recall_failed";
    return errorJson(messageKey, status, locale);
  }
}
