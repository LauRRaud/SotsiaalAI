import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { declineUrgentRequest, deskProjection } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * „Ei jõua." — kohustuslik rada, mitte hea tahte küsimus (KOV-lepingu p 4).
 *
 * Põhjus on nõutav domeenikihis. Keeldumine ilma põhjuseta oleks vaikus teise
 * nime all, ja inimene ei saaks teada, kas ta ootab edasi või peab mujale
 * minema.
 */
export async function POST(req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);
  const body = await req.json().catch(() => ({}));

  return handleUrgentRoute(async () => {
    const updated = await declineUrgentRequest({
      prisma,
      requestId,
      userId: auth.userId,
      reason: body?.reason
    });
    return urgentJson({ ok: true, request: deskProjection(updated) });
  });
}
