import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { sendPreInquiryCorrection } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const PUBLIC_ERRORS = new Set([
  "api.common.not_found",
  "pre_inquiries.errors.recalled_cannot_be_corrected",
  "pre_inquiries.errors.external_cannot_be_corrected",
  "pre_inquiries.errors.correction_requires_open",
  "pre_inquiries.errors.correction_conflict",
  "pre_inquiries.errors.not_sent",
  "pre_inquiries.errors.situation_required",
  "pre_inquiries.errors.correction_required",
  "privacy.confirmation_required"
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

  try {
    const body = await request.json().catch(() => ({}));
    const result = await sendPreInquiryCorrection(userId, await readId(context), body);
    return json({ ok: true, ...result }, result.created ? 201 : 200);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("[pre-inquiries] correction failed", safeError(error));
    const messageKey = status < 500 && PUBLIC_ERRORS.has(error?.message)
      ? error.message
      : "pre_inquiries.errors.correction_failed";
    return errorJson(messageKey, status, locale, error?.privacyPayload || {});
  }
}
