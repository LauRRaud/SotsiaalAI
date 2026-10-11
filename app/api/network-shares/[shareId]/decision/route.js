import {
  guardShareRequest, handleShareRoute, readShareId, requireShareUser, shareError, shareJson
} from "@/lib/network/shareRoutes";
import { clientRespondToShare } from "@/lib/network/share";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * KLIENDI ENDA otsus, oma kontolt. Ainus rada, kus kinnitus saab meetodi
 * `IN_APP` — töötaja siia ei pääse ja väline klient samuti mitte.
 */
export async function POST(req, { params }) {
  const shareId = await readShareId(params);
  const auth = await requireShareUser();
  if (!auth.ok) return shareError(auth.message, auth.status);
  const guard = await guardShareRequest(req, auth, "DECIDE", { mutation: true, resourceId: shareId });
  if (!guard.ok) return shareError(guard.message, guard.status);
  if (guard.replayedShare) {
    return shareJson({ ok: true, share: { id: guard.replayedShare.id, status: guard.replayedShare.status }, replayed: true });
  }
  const body = await req.json().catch(() => ({}));

  return handleShareRoute(async () => {
    const share = await clientRespondToShare({
      prisma,
      shareId,
      clientUserId: auth.userId,
      decision: body?.decision,
      note: body?.note || "",
      /* Räsi, mille klient sai koos tekstiga: ta kinnitab SEDA teksti, mitte
         lihtsalt seda rida (SOL-NET-01). Kinnitamisel kohustuslik (audit T02):
         ilma räsita päring saab vastuseks 428 ja leht laadib teksti uuesti. */
      expectedContentHash: typeof body?.expectedContentHash === "string" ? body.expectedContentHash : null,
      mutationKey: guard.mutationKey
    });
    return shareJson({
      ok: true,
      share: {
        id: share.id,
        status: share.status,
        clientConfirmedAt: share.clientConfirmedAt,
        clientDeclinedAt: share.clientDeclinedAt
      }
    });
  });
}
