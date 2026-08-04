import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { authorProjection, recallUrgentRequest } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Inimene võtab oma pöördumise tagasi.
 *
 * Sama piir mis eelpöördumisel: kuni vastuvõtja ei ole lugenud, saab tagasi
 * võtta. Loetud teksti ei saa lugemata teha ja platvorm ei teeskle vastupidist.
 */
export async function POST(_req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);

  return handleUrgentRoute(async () => {
    const updated = await recallUrgentRequest({ prisma, requestId, userId: auth.userId });
    return urgentJson({ ok: true, request: authorProjection(updated) });
  });
}
