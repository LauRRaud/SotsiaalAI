import { requireKovAdminSession, json, errorJson } from "@/lib/admin/rag/kov/api";
import {
  resolveAdminIdentity,
  reviewSourcePackageSnapshot
} from "@/lib/admin/rag/sourcePackages/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, { params }) {
  const auth = await requireKovAdminSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || "").trim();
  const reviewNote = typeof body?.reviewNote === "string" ? body.reviewNote.slice(0, 1000) : undefined;
  const acceptedReasonCode = typeof body?.acceptedReasonCode === "string" ? body.acceptedReasonCode.slice(0, 120) : undefined;
  const acceptedDisposition = typeof body?.acceptedDisposition === "string" ? body.acceptedDisposition.slice(0, 120) : undefined;

  try {
    const item = await reviewSourcePackageSnapshot(id, action, {
      reviewedBy: resolveAdminIdentity(auth.session),
      reviewNote,
      acceptedReasonCode,
      acceptedDisposition
    });
    return json({ ok: true, item });
  } catch (error) {
    if (error?.code === "P2025") return errorJson("api.common.not_found", 404, auth.locale);
    if (error?.code === "UNSUPPORTED_ACTION") {
      return errorJson("api.common.bad_request", 400, auth.locale, { reason: "unsupported_action" });
    }
    if (error?.code === "UNSUPPORTED_ACCEPT_REASON") {
      return errorJson("api.common.bad_request", 400, auth.locale, { reason: "unsupported_accept_reason" });
    }
    throw error;
  }
}
