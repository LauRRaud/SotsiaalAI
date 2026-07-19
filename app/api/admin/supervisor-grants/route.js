import { json } from "@/lib/documents/server";
import { issueGrant, listGrants } from "@/lib/supervision/grants";
import {
  requireSupervisionAdminAuth,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const locale = supervisionLocale(request);
  try {
    await requireSupervisionAdminAuth();
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || null;
    const grants = await listGrants({ userId });
    return json({ ok: true, grants });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] grants list failed", "supervision.errors.load_failed");
  }
}

export async function POST(request) {
  const locale = supervisionLocale(request);
  try {
    const auth = await requireSupervisionAdminAuth();
    const body = await request.json().catch(() => ({}));
    const grant = await issueGrant({
      actorUserId: auth.userId,
      userId: body.userId,
      grantBasis: body.grantBasis,
      validUntil: body.validUntil ?? null
    });
    return json({ ok: true, grant }, 201);
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] grant issue failed", "supervision.errors.save_failed");
  }
}
