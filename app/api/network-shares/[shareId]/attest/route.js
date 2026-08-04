import {
  handleShareRoute, readShareId, requireShareUser, shareError, shareJson, workerProjection
} from "@/lib/network/shareRoutes";
import { attestClientDecision } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Töötaja kannab VÄLISE kliendi otsuse üle (näost näkku, telefonis, kirjalikult).
 *
 * Kontoga kliendi eest see rada ei tööta — domeenikiht keeldub. Ülekantud
 * kinnitus jääb kirjes eristatavaks ja seda ei tohi esitada kliendi enda
 * vajutusena.
 */
export async function POST(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  const body = await req.json().catch(() => ({}));

  return handleShareRoute(async () => {
    const share = await attestClientDecision({
      prisma,
      shareId,
      workerId: auth.userId,
      decision: body?.decision,
      method: body?.method,
      note: body?.note || ""
    });
    return shareJson({ ok: true, share: workerProjection(share) });
  });
}
