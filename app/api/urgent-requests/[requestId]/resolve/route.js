import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { deskProjection, resolveUrgentRequest } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Laud lõpetab töö.
 *
 * NB tootepiir: „lahendatud" tähendab siin, et LAUA töö on tehtud — mitte et
 * inimese olukord on lahenenud. Ametlik kandja on pärast üleandmist KOV-i oma
 * ja platvorm ei väida midagi selle kohta, mis edasi juhtus.
 */
export async function POST(req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);
  const body = await req.json().catch(() => ({}));

  return handleUrgentRoute(async () => {
    const updated = await resolveUrgentRequest({
      prisma,
      requestId,
      userId: auth.userId,
      note: body?.note || ""
    });
    return urgentJson({ ok: true, request: deskProjection(updated) });
  });
}
