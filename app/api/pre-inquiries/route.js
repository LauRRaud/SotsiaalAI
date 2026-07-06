import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { createPreInquiry, listVisiblePreInquiries } from "@/lib/preInquiries";
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

export async function GET(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const inquiries = await listVisiblePreInquiries(auth.userId);
    return json({
      ok: true,
      inquiries
    });
  } catch (error) {
    console.error("[pre-inquiries] load failed", safeError(error));
    return errorJson("pre_inquiries.errors.load_failed", 500, locale);
  }
}

export async function POST(request) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const inquiry = await createPreInquiry(auth.userId, body);
    return json({
      ok: true,
      inquiry
    }, 201);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[pre-inquiries] save failed", safeError(error));
    }
    return errorJson(
      error?.message || "pre_inquiries.errors.save_failed",
      status,
      locale,
      error?.privacyPayload || {}
    );
  }
}
