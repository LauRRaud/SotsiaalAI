import {
  handleShareRoute, readShareId, requireShareUser, shareError, shareJson, workerProjection
} from "@/lib/network/shareRoutes";
import { submitToClient } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Töötaja saadab mustandi kliendile ülevaatamiseks. */
export async function POST(_req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  return handleShareRoute(async () => {
    const share = await submitToClient({ prisma, shareId, workerId: auth.userId });
    return shareJson({ ok: true, share: workerProjection(share) });
  });
}
