import {
  handleUrgentRoute,
  readRequestId,
  requireUrgentUser,
  urgentError,
  urgentJson
} from "@/lib/urgent/routes";
import { loadRequestTrail } from "@/lib/urgent/deskQueue";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Isikuline vastutusjälg (KOV-lepingu p 8).
 *
 * Read ütlevad, KES mida millal tegi — mitte mida ta luges. Nii saab üleandmisel
 * näidata tegevuslugu ilma, et tegevusloo lugemine ise oleks sisu lugemine.
 *
 * Jälge tohib lugeda praegune laud VÕI see laud, kellele juhtum on üle antud:
 * vastuvõttev üksus peab enne kinnitamist nägema, mis juba tehtud on.
 */
export async function GET(_req, { params }) {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);
  const requestId = await readRequestId(params);

  return handleUrgentRoute(async () => {
    const trail = await loadRequestTrail({ prisma, userId: auth.userId, requestId });
    return urgentJson({ ok: true, trail });
  });
}
