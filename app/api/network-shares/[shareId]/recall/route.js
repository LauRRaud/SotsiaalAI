import {
  guardShareRequest, handleShareRoute, isNetworkWorker, readShareId, requireShareUser,
  shareError, shareJson, workerProjection
} from "@/lib/network/shareRoutes";
import { recallNetworkShare } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Tagasivõtmine, ainult enne avamist. */
export async function POST(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  if (!isNetworkWorker(auth)) return shareError("api.common.forbidden", 403);
  const guard = await guardShareRequest(req, auth, "RECALL", { mutation: true, resourceId: shareId });
  if (!guard.ok) return shareError(guard.message, guard.status);
  if (guard.replayedShare) return shareJson({ ok: true, share: workerProjection(guard.replayedShare), replayed: true });
  return handleShareRoute(async () => {
    const share = await recallNetworkShare({ prisma, shareId, workerId: auth.userId, mutationKey: guard.mutationKey });
    return shareJson({ ok: true, share: workerProjection(share) });
  });
}
