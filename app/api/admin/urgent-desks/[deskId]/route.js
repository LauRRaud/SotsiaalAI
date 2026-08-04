import {
  deskAuthError,
  deskJson,
  handleDeskRoute,
  readDeskId,
  requireDeskAdmin
} from "@/lib/urgent/deskAdminRoutes";
import { updateUrgentDesk } from "@/lib/urgent/deskAdmin";
import { adminDeskProjection } from "@/lib/urgent/desk";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Tingimuste muutmine.
 *
 * NB vastus võib tulla tagasi seisus `ready: false` ka siis, kui laud oli enne
 * lahti: iga muudatus kinnitust kandvas väljas tühistab kinnituse ja sulgeb
 * laua. See ei ole viga, vaid reegel — vana kinnitus ei kata uut teksti.
 */
export async function PATCH(request, { params }) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);
  const deskId = await readDeskId(params);
  const body = await request.json().catch(() => ({}));

  return handleDeskRoute(request, async () => {
    const desk = await updateUrgentDesk({ prisma, deskId, data: body || {} });
    const activeMemberCount = await prisma.urgentDeskMember.count({
      where: { deskId: desk.id, isActive: true }
    });
    return deskJson({ ok: true, desk: adminDeskProjection(desk, { activeMemberCount }) });
  });
}
