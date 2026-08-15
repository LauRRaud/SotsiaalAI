import {
  handleShareRoute,
  guardShareRequest,
  hasFrameworkAcceptance,
  isNetworkWorker,
  requireShareUser,
  shareError,
  shareJson,
  workerProjection
} from "@/lib/network/shareRoutes";
import {
  clientProjection,
  createNetworkShare,
  listNetworkShares,
  recipientInboxProjection
} from "@/lib/network/share";
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
  const guard = await guardShareRequest(req, auth, "CREATE", { mutation: true });
  if (!guard.ok) return shareError(guard.message, guard.status);
  if (guard.replayedShare) return shareJson({ ok: true, share: workerProjection(guard.replayedShare), replayed: true });

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
      // Kasuta ainult kasutajaliideses juba valitud läbipaistmatut ID-d. E-posti
      // siin kasutajaks lahendamine muudaks vastuse konto olemasolu oraakliks.
      recipientUserId: body?.recipientUserId,
      summaryText: body?.summaryText,
      purpose: body?.purpose,
      sharingBoundary: body?.sharingBoundary,
      participationEndsOn: body?.participationEndsOn,
      hasFrameworkAcceptance,
      mutationKey: guard.mutationKey
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
  if (!["worker", "client", "recipient"].includes(role)) return shareError("network_share.invalid_role", 400);
  if (role === "worker" && !isNetworkWorker(auth)) return shareError("api.common.forbidden", 403);
  const guard = await guardShareRequest(req, auth, `LIST_${role.toUpperCase()}`);
  if (!guard.ok) return shareError(guard.message, guard.status);
  const sourcePreInquiryId = String(url.searchParams.get("sourcePreInquiryId") || "").trim() || null;
  const status = String(url.searchParams.get("status") || "").trim() || null;
  const page = await listNetworkShares({
    prisma,
    viewerUserId: auth.userId,
    role,
    sourcePreInquiryId,
    status,
    cursor: url.searchParams.get("cursor"),
    limit: url.searchParams.get("limit")
  });

  if (role === "recipient") {
    const now = new Date();
    return shareJson({
      ok: true,
      shares: page.rows.map((row) => recipientInboxProjection(row, {
        viewerUserId: auth.userId,
        now
      })).filter(Boolean),
      nextCursor: page.nextCursor
    });
  }

  if (role === "client") {
    return shareJson({
      ok: true,
      shares: page.rows.map((row) => clientProjection(row, { viewerUserId: auth.userId })).filter(Boolean),
      nextCursor: page.nextCursor
    });
  }

  return shareJson({ ok: true, shares: page.rows.map(workerProjection), nextCursor: page.nextCursor });
}
