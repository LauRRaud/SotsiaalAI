import {
  handleShareRoute,
  guardShareRequest,
  isNetworkWorker,
  readShareId,
  requireShareUser,
  shareError,
  shareJson,
  workerProjection
} from "@/lib/network/shareRoutes";
import { clientProjection, recipientProjection, updateNetworkShareDraft } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";
import { SharingViewKind, recordSharingView } from "@/lib/sharings/viewTrail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Üks jagamine. Kuju sõltub sellest, KES küsib — saaja ei saa kunagi töötaja
 * vaadet, ka mitte otsepäringuga oma ID peale.
 */
export async function GET(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  const guard = await guardShareRequest(req, auth, "DETAIL");
  if (!guard.ok) return shareError(guard.message, guard.status);

  const share = await prisma.networkShare.findFirst({ where: { id: shareId } });
  if (!share) return shareError("network_share.not_found", 404);

  if (share.workerId === auth.userId) {
    if (!isNetworkWorker(auth)) return shareError("network_share.not_found", 404);
    return shareJson({ ok: true, share: workerProjection(share), viewerRole: "worker" });
  }
  if (share.recipientUserId === auth.userId) {
    const view = recipientProjection(share, { viewerUserId: auth.userId });
    if (!view) return shareError("network_share.not_found", 404);
    /* „Kes on vaadanud": ka otse loetud sisu on saaja lugemine. Ei viska kunagi. */
    await recordSharingView({
      db: prisma,
      kind: SharingViewKind.NETWORK_SHARE,
      itemId: share.id,
      viewerUserId: auth.userId,
      sharerUserIds: [share.workerId, share.clientUserId]
    });
    return shareJson({ ok: true, share: view, viewerRole: "recipient" });
  }
  if (share.clientUserId && share.clientUserId === auth.userId) {
    const view = clientProjection(share, { viewerUserId: auth.userId });
    if (!view) return shareError("network_share.not_found", 404);
    return shareJson({ ok: true, viewerRole: "client", share: view });
  }
  // Mitteosaline ei saa teada isegi seda, et selline jagamine olemas on.
  return shareError("network_share.not_found", 404);
}

export async function PATCH(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  if (!isNetworkWorker(auth)) return shareError("api.common.forbidden", 403);
  const guard = await guardShareRequest(req, auth, "UPDATE", { mutation: true, resourceId: shareId });
  if (!guard.ok) return shareError(guard.message, guard.status);
  if (guard.replayedShare) return shareJson({ ok: true, share: workerProjection(guard.replayedShare), replayed: true });
  const body = await req.json().catch(() => ({}));

  return handleShareRoute(async () => {
    const share = await updateNetworkShareDraft({
      prisma,
      shareId,
      workerId: auth.userId,
      summaryText: body?.summaryText,
      purpose: body?.purpose,
      sharingBoundary: body?.sharingBoundary,
      participationEndsOn: body?.participationEndsOn,
      mutationKey: guard.mutationKey
    });
    return shareJson({ ok: true, share: workerProjection(share) });
  });
}
