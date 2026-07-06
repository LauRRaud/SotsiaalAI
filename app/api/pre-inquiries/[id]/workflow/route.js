import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest } from "@/lib/documents/server";
import { updatePreInquiryReceiverWorkflow } from "@/lib/preInquiries";
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

async function readId(context) {
  const params = await context?.params;
  return String(params?.id || "").trim();
}

export async function PATCH(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) return errorJson(auth.message, auth.status, locale);

  try {
    const body = await request.json().catch(() => ({}));
    const inquiry = await updatePreInquiryReceiverWorkflow(auth.userId, await readId(context), body);
    return json({
      ok: true,
      inquiry
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) {
      console.error("[pre-inquiries] workflow update failed", safeError(error));
    }
    return errorJson(error?.message || "pre_inquiries.errors.workflow_save_failed", status, locale);
  }
}
