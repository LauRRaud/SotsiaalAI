import {
  guardShareRequest, handleShareRoute, readShareId, requireShareUser, shareError, shareJson
} from "@/lib/network/shareRoutes";
import { markShareOpened, recipientProjection } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Saaja avab. Avamine sulgeb tagasivõtmise akna. */
export async function POST(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  const guard = await guardShareRequest(req, auth, "OPEN", { mutation: true, resourceId: shareId });
  if (!guard.ok) return shareError(guard.message, guard.status);
  if (guard.replayedShare) {
    return shareJson({
      ok: true,
      share: recipientProjection(guard.replayedShare, { viewerUserId: auth.userId }),
      replayed: true
    });
  }
  return handleShareRoute(async () => {
    const share = await markShareOpened({
      prisma, shareId, recipientUserId: auth.userId, mutationKey: guard.mutationKey
    });
    return shareJson({ ok: true, share: recipientProjection(share, { viewerUserId: auth.userId }) });
  });
}
