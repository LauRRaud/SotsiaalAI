import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { evaluateTextPrivacy, privacyConfirmationResponsePayload } from "@/lib/privacy/privacyGuard";
import { resolvePrivacyDecision } from "@/lib/privacy/promptPreference";
import { localizePrivacyPayload, privacyLocaleFromRequest } from "@/lib/privacy/privacyTexts";
import { safeError } from "@/lib/privacy/safeError";

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

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const body = await request.json().catch(() => ({}));
    /* Kui inimene on hoiatuse konto seadetes välja lülitanud, on tema püsiv otsus privaatses
       töövoos „saada siiski"; avalikus töövoos küsitakse endiselt. */
    const result = evaluateTextPrivacy(body?.text, {
      workflow: body?.workflow,
      privacyDecision: await resolvePrivacyDecision(auth.userId, body?.privacyDecision)
    });

    if (result.needsPrivacyConfirmation) {
      return json(localizePrivacyPayload(privacyConfirmationResponsePayload(result), privacyLocaleFromRequest(request)), 409);
    }

    return json({
      ok: true,
      needsPrivacyConfirmation: false,
      workflow: result.workflow,
      text: result.processedText,
      redactedText: result.redactedText,
      categories: result.categories,
      findings: result.findings,
      actions: result.actions,
      allowOriginal: result.allowOriginal,
      appliedDecision: result.appliedDecision || null
    });
  } catch (error) {
    console.error("[privacy/check] failed", safeError(error));
    return errorJson("privacy.check_failed", 500, locale);
  }
}
