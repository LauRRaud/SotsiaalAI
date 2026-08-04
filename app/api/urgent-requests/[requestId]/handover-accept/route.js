import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { acceptUrgentHandover, deskProjection } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Vastuvõttev üksus kinnitab üleandmise.
 *
 * ALLES SIIN liigub juhtum uue laua kätte. Ilma selle kinnituseta oleks
 * „andsin edasi" sama mis „ei tegelenud" — Soome kogemuse nõue 3 ütleb otse,
 * et üleandmine vajab vastuvõtukinnitust.
 */
export async function POST(_req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);

  return handleUrgentRoute(async () => {
    const updated = await acceptUrgentHandover({ prisma, requestId, userId: auth.userId });
    return urgentJson({ ok: true, request: deskProjection(updated) });
  });
}
