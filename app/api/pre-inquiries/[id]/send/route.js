import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { sendExternalPreInquiry } from "@/lib/preInquiries";
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

  try {
    const params = await context?.params;
    const inquiry = await sendExternalPreInquiry(auth.userId, String(params?.id || "").trim());
    return json({
      ok: true,
      inquiry
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[pre-inquiries] external send failed", safeError(error));
    }
    return errorJson(error?.message || "pre_inquiries.errors.send_failed", status, locale);
  }
}
