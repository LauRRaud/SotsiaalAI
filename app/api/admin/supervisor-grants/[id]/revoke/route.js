import { json } from "@/lib/documents/server";
import { revokeGrant } from "@/lib/supervision/grants";
import {
  requireSupervisionAdminAuth,
  supervisionErrorResponse,
  supervisionLocale
} from "@/lib/supervision/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request, context) {
  const locale = supervisionLocale(request);
  try {
    const auth = await requireSupervisionAdminAuth();
    const params = await context?.params;
    const grant = await revokeGrant({ actorUserId: auth.userId, grantId: String(params?.id || "").trim() });
    return json({ ok: true, grant });
  } catch (error) {
    return supervisionErrorResponse(error, locale, "[supervision] grant revoke failed", "supervision.errors.save_failed");
  }
}
