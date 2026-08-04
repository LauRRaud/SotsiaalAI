import { handleUrgentRoute, requireUrgentUser, urgentError, urgentJson } from "@/lib/urgent/routes";
import { loadDeskQueue } from "@/lib/urgent/deskQueue";
import { listMyUrgentDesks } from "@/lib/urgent/myDesks";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Vastuvõtu koondvaade: kiireloomulised abipalved ja eelpöördumised ühes
 * ajajärjestuses.
 *
 * `deskId`-ta päring tagastab selle inimese lauad. Nii ei pea klient teadma
 * laua ID-d ette ega saa teda ka ära arvata — laudade nimekiri tuleb
 * liikmelisusest, mitte päringust.
 */
export async function GET(req) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  const url = new URL(req.url);
  const deskId = String(url.searchParams.get("deskId") || "").trim();

  return handleUrgentRoute(async () => {
    if (!deskId) {
      const desks = await listMyUrgentDesks({ prisma, userId: auth.userId });
      return urgentJson({ ok: true, desks, queue: null });
    }
    const queue = await loadDeskQueue({ prisma, userId: auth.userId, deskId });
    return urgentJson({ ok: true, queue });
  });
}
