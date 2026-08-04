import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { deskProjection, markUrgentRequestRead } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Laud märgib pöördumise loetuks.
 *
 * See on ainus koht, kus lugemisaja lubadus päriselt täitub — ja seepärast
 * peab ta olema TEADLIK toiming, mitte kuvamise kõrvalmõju. Automaatne
 * „loetud" nimekirja avamisel tähendaks, et laud täidab lubaduse ilma, et
 * keegi teksti tegelikult loeks.
 */
export async function POST(_req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);

  return handleUrgentRoute(async () => {
    const updated = await markUrgentRequestRead({ prisma, requestId, userId: auth.userId });
    return urgentJson({ ok: true, request: deskProjection(updated) });
  });
}
