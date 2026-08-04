import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { authorProjection, convertUrgentRequestToPreInquiry } from "@/lib/urgent/request";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Esiuks → tuba: kiireloomulisest abipalvest saab eelpöördumise.
 *
 * Kaks piiri, mis on siin tahtlikud:
 *   - konversiooni teeb PÖÖRDUJA ise, mitte laud. Töötaja ei saa kellegi lugu
 *     tema eest edasi liigutada;
 *   - tulemus on MUSTAND. Konversioon ei saada midagi ära — see jääb inimese
 *     otsuseks, nagu iga teine saatmine platvormil.
 */
export async function POST(_req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);

  return handleUrgentRoute(async () => {
    const { request, preInquiry } = await convertUrgentRequestToPreInquiry({
      prisma,
      requestId,
      userId: auth.userId
    });
    return urgentJson({
      ok: true,
      request: authorProjection(request),
      preInquiryId: preInquiry.id
    }, 201);
  });
}
