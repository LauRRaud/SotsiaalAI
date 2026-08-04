import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { deskProjection, takeUrgentRequest } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** „Võtan." Vastutus läheb nimeliselt sellele töötajale. */
export async function POST(req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);
  const body = await req.json().catch(() => ({}));

  return handleUrgentRoute(async () => {
    const updated = await takeUrgentRequest({
      prisma,
      requestId,
      userId: auth.userId,
      note: body?.note || ""
    });
    return urgentJson({ ok: true, request: deskProjection(updated) });
  });
}
