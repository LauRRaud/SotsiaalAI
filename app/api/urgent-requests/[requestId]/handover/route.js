import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { deskProjection, handOverUrgentRequest } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Vahetuse ja üksuse üleandmine (Soome kogemuse nõue 3).
 *
 * Öine juhtum peab jõudma hommikul õige piirkondliku üksuseni koos
 * tegevuslooga. Üleandmine ÜKSI ei liiguta vastutust — kuni vastuvõttev laud
 * ei ole kinnitanud, vastutab endine. Kinnitus käib eraldi marsruudi kaudu.
 */
export async function POST(req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);
  const body = await req.json().catch(() => ({}));

  return handleUrgentRoute(async () => {
    const updated = await handOverUrgentRequest({
      prisma,
      requestId,
      userId: auth.userId,
      targetDeskId: body?.targetDeskId,
      note: body?.note || ""
    });
    return urgentJson({ ok: true, request: deskProjection(updated) });
  });
}
