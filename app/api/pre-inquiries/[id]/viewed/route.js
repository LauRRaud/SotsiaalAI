import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { recordPreInquiryView } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { enforcePreInquiryRateLimit, preInquiryErrorJson, publicPreInquiryError } from "@/lib/preInquiryApiBoundary";

/**
 * „Kes on vaadanud" (funktsioonikaart F13): saaja leht teatab, et ta avas juba vastuvõetud
 * pöördumise. Pöördumise tekst tuleb saajale loendiga kaasa, nii et ilma selle teateta ei
 * näeks server hilisemaid lugemisi. Vastus ei ütle, kas rida tekkis: pöörduja näeb oma
 * lehel „Minu jagamised" ainult päevade arvu ja viimast päeva.
 */

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
  const limited = enforcePreInquiryRateLimit(request, { action: "view", userId: auth.userId });
  if (limited) return limited;

  try {
    await recordPreInquiryView(auth.userId, await readId(context));
    return json({ ok: true });
  } catch (error) {
    if (publicPreInquiryError(error).status >= 500) {
      console.error("[pre-inquiries] view signal failed", safeError(error));
    }
    return preInquiryErrorJson(error, locale, "pre_inquiries.errors.save_failed");
  }
}
