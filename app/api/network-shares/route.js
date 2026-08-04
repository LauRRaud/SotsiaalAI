import {
  handleShareRoute,
  hasFrameworkAcceptance,
  isNetworkWorker,
  requireShareUser,
  shareError,
  shareJson,
  workerProjection
} from "@/lib/network/shareRoutes";
import { createNetworkShare, recipientProjection } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Töötaja koostab uue võrgustikujagamise mustandi.
 *
 * Raamlepingu kontroll antakse siit pordina edasi — domeenikiht kutsub teda
 * AINULT välise kliendi rajal. Nii ei blokeeri O-CO-6 värav seda, kus ta ei
 * kohaldu.
 */
export async function POST(req) {
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  if (!isNetworkWorker(auth)) return shareError("api.common.forbidden", 403);

  const body = await req.json().catch(() => ({}));

  return handleShareRoute(async () => {
    const share = await createNetworkShare({
      prisma,
      workerId: auth.userId,
      sourcePreInquiryId: body?.sourcePreInquiryId,
      // `clientUserId` EI tule päringu kehast: domeenikiht tuletab kliendi
      // lähte-eelpöördumise autorist. Kui liides tohiks kliendi ise nimetada,
      // saaks kokkuvõtte kogemata siduda vale inimesega.
      clientDisplayName: body?.clientDisplayName || "",
      clientExternalRef: body?.clientExternalRef || "",
      recipientUserId: body?.recipientUserId,
      summaryText: body?.summaryText,
      purpose: body?.purpose,
      sharingBoundary: body?.sharingBoundary,
      participationEndsOn: body?.participationEndsOn,
      hasFrameworkAcceptance
    });
    return shareJson({ ok: true, share: workerProjection(share) }, 201);
  });
}

/**
 * Nimekiri vaataja rolli järgi. Sama päring annab KOLM ERI KUJU — saaja ei näe
 * kunagi töötaja vaadet, ka mitte nimekirjas.
 */
export async function GET(req) {
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);

  const url = new URL(req.url);
  const role = String(url.searchParams.get("role") || "worker").toLowerCase();

  if (role === "recipient") {
    const rows = await prisma.networkShare.findMany({
      where: { recipientUserId: auth.userId, status: { in: ["SENT", "OPENED", "RESPONDED"] } },
      orderBy: { sentAt: "desc" },
      take: 100
    });
    return shareJson({
      ok: true,
      shares: rows.map((row) => recipientProjection(row, { viewerUserId: auth.userId })).filter(Boolean)
    });
  }

  if (role === "client") {
    const rows = await prisma.networkShare.findMany({
      where: { clientUserId: auth.userId },
      orderBy: { updatedAt: "desc" },
      take: 100
    });
    // Klient näeb TÄPSELT seda, mille kohta ta otsustab: kokkuvõtet, eesmärki,
    // jagamispiiri ja lõppu. Töötaja siseseid välju siin ei ole.
    return shareJson({
      ok: true,
      shares: rows.map((row) => ({
        id: row.id,
        summaryText: row.summaryText,
        purpose: row.purpose,
        sharingBoundary: row.sharingBoundary,
        participationEndsOn: row.participationEndsOn,
        status: row.status,
        clientConfirmedAt: row.clientConfirmedAt,
        clientDeclinedAt: row.clientDeclinedAt,
        sentAt: row.sentAt,
        roomId: row.roomId
      }))
    });
  }

  if (!isNetworkWorker(auth)) return shareError("api.common.forbidden", 403);
  const rows = await prisma.networkShare.findMany({
    where: { workerId: auth.userId },
    orderBy: { updatedAt: "desc" },
    take: 100
  });
  return shareJson({ ok: true, shares: rows.map(workerProjection) });
}
