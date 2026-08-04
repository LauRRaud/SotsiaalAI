import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { authorProjection, deskProjection, viewUrgentRequest } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Üks pöördumine.
 *
 * Kaks vaatajat, kaks kuju. Laua töötaja avamine JÄTAB JÄLJE — KOV-lepingu p 8
 * nõuab, et iga vaatamine oleks seotud konkreetse inimese ja kellaajaga, ja
 * „ma ainult vaatasin" ei ole erand.
 */
export async function GET(_req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);

  return handleUrgentRoute(async () => {
    const row = await prisma.urgentRequest.findFirst({ where: { id: requestId } });
    if (!row) return urgentError("urgent_request.not_found", 404);

    if (row.authorId && row.authorId === auth.userId) {
      return urgentJson({ ok: true, role: "author", request: authorProjection(row) });
    }

    // Laua rada käib `viewUrgentRequest` kaudu: seal on nii ligipääsukontroll
    // kui vastutusjälg. Ilma selleta saaks lauda lugeda jälge jätmata.
    const seen = await viewUrgentRequest({ prisma, requestId, userId: auth.userId });
    return urgentJson({ ok: true, role: "desk", request: deskProjection(seen) });
  });
}
