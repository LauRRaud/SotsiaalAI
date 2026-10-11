import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { assistPreInquiry } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard";
import { resolvePrivacyDecision } from "@/lib/privacy/promptPreference";
import { localizePrivacyPayload, privacyLocaleFromRequest } from "@/lib/privacy/privacyTexts";
import { enforcePreInquiryRateLimit, preInquiryErrorJson } from "@/lib/preInquiryApiBoundary";

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

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }
  const limited = enforcePreInquiryRateLimit(request, { action: "assist", userId: auth.userId });
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    /* Kui inimene on hoiatuse konto seadetes välja lülitanud, on tema püsiv otsus „saada siiski". */
    const privacyDecision = await resolvePrivacyDecision(auth.userId, body?.privacyDecision);
    const privacy = evaluateTextPrivacy([body?.situation, body?.assistantMessage].filter(Boolean).join("\n\n"), {
      workflow: "pre_inquiry",
      privacyDecision
    });
    if (privacy.needsPrivacyConfirmation) {
      return json(localizePrivacyPayload(privacyConfirmationResponsePayload(privacy), privacyLocaleFromRequest(request)), 409);
    }
    const situationPrivacy = evaluateTextPrivacy(body?.situation, {
      workflow: "pre_inquiry",
      privacyDecision
    });
    const assistantPrivacy = evaluateTextPrivacy(body?.assistantMessage, {
      workflow: "pre_inquiry",
      privacyDecision
    });
    const result = await assistPreInquiry({
      ...body,
      situation: situationPrivacy.processedText || body?.situation,
      assistantMessage: assistantPrivacy.processedText || body?.assistantMessage
    });
    return json({
      ok: true,
      ...result
    });
  } catch (error) {
    console.error("[pre-inquiries] assist failed", safeError(error));
    return preInquiryErrorJson(error, locale, "pre_inquiries.errors.assist_failed");
  }
}
