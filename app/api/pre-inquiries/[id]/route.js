import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import {
  getVisiblePreInquiry,
  serializePreInquiry,
  updatePreInquiry
} from "@/lib/preInquiries";
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

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function GET(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const inquiry = await getVisiblePreInquiry(auth.userId, await readId(context));
    if (!inquiry) {
      return errorJson("api.common.not_found", 404, locale);
    }
    return json({
      ok: true,
      inquiry: serializePreInquiry(inquiry)
    });
  } catch (error) {
    console.error("[pre-inquiries] detail load failed", safeError(error));
    return errorJson("pre_inquiries.errors.load_failed", 500, locale);
  }
}

export async function PATCH(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const inquiry = await updatePreInquiry(auth.userId, await readId(context), body);
    return json({
      ok: true,
      inquiry
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[pre-inquiries] update failed", safeError(error));
    }
    return errorJson(
      error?.message || "pre_inquiries.errors.save_failed",
      status,
      locale,
      error?.privacyPayload || {}
    );
  }
}
