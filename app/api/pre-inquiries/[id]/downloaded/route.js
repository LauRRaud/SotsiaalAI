import { getServerSession } from "next-auth";
import { authConfig } from "@/auth";
import { errorJson, json, localeFromRequest, publicErrorMessageKey, publicErrorStatus } from "@/lib/documents/server";
import { markPreInquiryDownloaded } from "@/lib/preInquiries";
import { safeError } from "@/lib/privacy/safeError";
import { enforcePreInquiryRateLimit } from "@/lib/preInquiryApiBoundary";

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

// A3: the author marks a saved pre-inquiry DOWNLOADED after downloading it for
// offline use. Ownership + allowed transitions are enforced server-side; a
// foreign record's existence is not leaked (404 vs 403).
export async function POST(request, context) {
  const locale = localeFromRequest(request);
  const auth = await requireUser();
  if (!auth.ok) {
    return errorJson(auth.message, auth.status, locale);
  }
  const limited = enforcePreInquiryRateLimit(request, { action: "mutate", userId: auth.userId });
  if (limited) return limited;

  try {
    const params = await context?.params;
    const body = await request.json().catch(() => ({}));
    // The client sends the SAVED snapshot's updatedAt so the server marks only the
    // exact version that was downloaded (version-safety; a stale snapshot -> 409).
    const expectedUpdatedAt = body?.expectedUpdatedAt ? String(body.expectedUpdatedAt) : null;
    const inquiry = await markPreInquiryDownloaded(auth.userId, String(params?.id || "").trim(), {
      expectedUpdatedAt
    });
    return json({
      ok: true,
      inquiry
    });
  } catch (error) {
    // Controlled version-conflict 409: a GENERIC message, surfaced explicitly
    // because its key is outside the api.*/documents.* public whitelist. It never
    // leaks WHY the snapshot is stale (semantics #9).
    if (Number(error?.status) === 409 && error?.message === "pre_inquiries.errors.download_conflict") {
      return errorJson("pre_inquiries.errors.download_conflict", 409, locale);
    }
    // Otherwise only whitelisted public keys (api.common.not_found / forbidden)
    // are surfaced with their status; anything else is a generic 500. No raw
    // error message is ever published.
    const status = publicErrorStatus(error, 500);
    if (status >= 500) {
      console.error("[pre-inquiries] mark downloaded failed", safeError(error));
      return errorJson("pre_inquiries.errors.save_failed", 500, locale);
    }
    return errorJson(publicErrorMessageKey(error, "pre_inquiries.errors.save_failed"), status, locale);
  }
}
