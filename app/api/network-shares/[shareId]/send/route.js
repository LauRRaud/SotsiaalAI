import {
  createRoomPort, handleShareRoute, readShareId, requireShareUser, shareError, shareJson, workerProjection
} from "@/lib/network/shareRoutes";
import { sendNetworkShare } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Saatmine. Nõuab kliendi kinnitust ja avab ruumi. */
export async function POST(_req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  return handleShareRoute(async () => {
    const share = await sendNetworkShare({
      prisma,
      shareId,
      workerId: auth.userId,
      createRoom: createRoomPort()
    });
    return shareJson({ ok: true, share: workerProjection(share) });
  });
}
