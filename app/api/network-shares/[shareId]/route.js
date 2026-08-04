import {
  handleShareRoute,
  readShareId,
  requireShareUser,
  shareError,
  shareJson,
  workerProjection
} from "@/lib/network/shareRoutes";
import { recipientProjection, updateNetworkShareDraft } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Üks jagamine. Kuju sõltub sellest, KES küsib — saaja ei saa kunagi töötaja
 * vaadet, ka mitte otsepäringuga oma ID peale.
 */
export async function GET(_req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);

  const share = await prisma.networkShare.findFirst({ where: { id: shareId } });
  if (!share) return shareError("network_share.not_found", 404);

  if (share.workerId === auth.userId) {
    return shareJson({ ok: true, share: workerProjection(share), viewerRole: "worker" });
  }
  if (share.recipientUserId === auth.userId) {
    const view = recipientProjection(share, { viewerUserId: auth.userId });
    if (!view) return shareError("network_share.not_found", 404);
    return shareJson({ ok: true, share: view, viewerRole: "recipient" });
  }
  if (share.clientUserId && share.clientUserId === auth.userId) {
    return shareJson({
      ok: true,
      viewerRole: "client",
      share: {
        id: share.id,
        summaryText: share.summaryText,
        purpose: share.purpose,
        sharingBoundary: share.sharingBoundary,
        participationEndsOn: share.participationEndsOn,
        status: share.status,
        clientConfirmedAt: share.clientConfirmedAt,
        clientDeclinedAt: share.clientDeclinedAt,
        sentAt: share.sentAt,
        roomId: share.roomId
      }
    });
  }
  // Mitteosaline ei saa teada isegi seda, et selline jagamine olemas on.
  return shareError("network_share.not_found", 404);
}

export async function PATCH(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  const body = await req.json().catch(() => ({}));

  return handleShareRoute(async () => {
    const share = await updateNetworkShareDraft({
      prisma,
      shareId,
      workerId: auth.userId,
      summaryText: body?.summaryText,
      purpose: body?.purpose,
      sharingBoundary: body?.sharingBoundary,
      participationEndsOn: body?.participationEndsOn
    });
    return shareJson({ ok: true, share: workerProjection(share) });
  });
}
