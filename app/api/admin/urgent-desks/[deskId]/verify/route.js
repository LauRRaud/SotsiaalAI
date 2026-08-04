import {
  deskAuthError,
  deskJson,
  handleDeskRoute,
  readDeskId,
  requireDeskAdmin
} from "@/lib/urgent/deskAdminRoutes";
import { verifyUrgentDesk } from "@/lib/urgent/deskAdmin";
import { adminDeskProjection } from "@/lib/urgent/desk";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Partner kinnitab, et tingimused kehtivad täna.
 *
 * Kinnitus on ajatempel, mitte linnuke: ta aegub ja teda peab saama uuendada
 * ilma teksti muutmata. Automatiseeritud korje võib muutust MÄRGATA, aga
 * kiireloomulise raja tingimused kinnitab inimene.
 */
export async function POST(request, { params }) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);
  const deskId = await readDeskId(params);

  return handleDeskRoute(request, async () => {
    const desk = await verifyUrgentDesk({ prisma, deskId });
    const activeMemberCount = await prisma.urgentDeskMember.count({
      where: { deskId: desk.id, isActive: true }
    });
    return deskJson({ ok: true, desk: adminDeskProjection(desk, { activeMemberCount }) });
  });
}
