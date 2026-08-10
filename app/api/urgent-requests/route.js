import {
  handleUrgentRoute,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import {
  authorProjection,
  createUrgentRequest,
  deskProjection,
  isDeskStaff
} from "@/lib/urgent/request";
import { selectDeskRequests } from "@/lib/urgent/deskQueue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Inimene saadab kiireloomulise abipalve.
 *
 * Nupuvajutus ON nõusolek (leping 3.4) — eraldi linnukest ei ole, sest inimene
 * ise palub info edasi saata. Serveripoolne kriisilukk ja laua valmiduskontroll
 * elavad domeenikihis; siin ei tohi kumbagi dubleerida, muidu lähevad nad ühel
 * päeval lahku.
 *
 * `municipalityId` tuleb kehast, aga LAUD tuletatakse serveris — klient ei saa
 * valida, kellele pöördumine läheb.
 */
export async function POST(req) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  const body = await req.json().catch(() => ({}));

  return handleUrgentRoute(async () => {
    const request = await createUrgentRequest({
      prisma,
      authorId: auth.userId,
      municipalityId: body?.municipalityId,
      recipientType: body?.recipientType || undefined,
      situationVerbatim: body?.situationVerbatim,
      contactName: body?.contactName,
      contactPhone: body?.contactPhone,
      safetyAnswer: body?.safetyAnswer === true,
      assistantStructured: body?.assistantStructured || ""
    });
    return urgentJson({ ok: true, request: authorProjection(request) }, 201);
  });
}

/**
 * Nimekiri vaataja rolli järgi. Sama päring annab KAKS ERI KUJU: pöörduja ei
 * näe kunagi laua vaadet ja laud ei näe pöörduja tagasivõtunuppu.
 */
export async function GET(req) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  const url = new URL(req.url);
  const role = String(url.searchParams.get("role") || "author").toLowerCase();

  if (role === "desk") {
    const deskId = String(url.searchParams.get("deskId") || "").trim();
    if (!deskId) return urgentError("urgent_request.desk_required", 400);
    // Ligipääs käib laua liikmelisusest, mitte rollist. Sotsiaaltöötaja roll ei
    // ava võõra valla lauda.
    const staff = await isDeskStaff(prisma, { deskId, userId: auth.userId });
    if (!staff) return urgentError("api.common.forbidden", 403);

    /* SOL-URG-01: valik tuleb jagatud kohast. Siin oli varem `take: 200` oma
       koopia, mis peitis 201. abipalve täpselt samamoodi nagu laua järjekord. */
    const page = await selectDeskRequests({
      prisma,
      deskId,
      historyOffset: Number.parseInt(url.searchParams.get("historyOffset") || "0", 10) || 0
    });
    return urgentJson({
      ok: true,
      requests: page.rows.map(deskProjection),
      activeTruncated: page.activeTruncated,
      historyOffset: page.historyOffset,
      historyPageSize: page.historyPageSize,
      historyTotal: page.historyTotal,
      hasMoreHistory: page.hasMoreHistory
    });
  }

  const rows = await prisma.urgentRequest.findMany({
    where: { authorId: auth.userId },
    orderBy: { sentAt: "desc" },
    take: 100
  });
  return urgentJson({ ok: true, requests: rows.map(authorProjection) });
}
