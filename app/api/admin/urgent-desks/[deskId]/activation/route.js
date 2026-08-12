import {
  deskAuthError,
  deskJson,
  handleDeskRoute,
  readDeskId,
  requireDeskAdmin
} from "@/lib/urgent/deskAdminRoutes";
import { setUrgentDeskActive } from "@/lib/urgent/deskAdmin";
import { adminDeskProjection } from "@/lib/urgent/desk";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Piirkonna avamine ja sulgemine.
 *
 * Avamine KEELDUB, kui laud ei ole muidu valmis — vastus kannab siis põhjuste
 * loendit. Muidu saaks tekkida „aktiivne" laud, mis inimesele kunagi ei avane,
 * ja admin arvaks, et piirkond on lahti.
 *
 * Sulgemine ei kontrolli midagi ega saa kunagi ebaõnnestuda: kinnipanek peab
 * alati töötama.
 */
export async function POST(request, { params }) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);
  const deskId = await readDeskId(params);
  const body = await request.json().catch(() => ({}));

  return handleDeskRoute(request, async () => {
    const desk = await setUrgentDeskActive({ prisma, deskId, isActive: body?.isActive === true, actorUserId: authz.userId });
    const activeMemberCount = await prisma.urgentDeskMember.count({
      where: { deskId: desk.id, isActive: true }
    });
    return deskJson({ ok: true, desk: adminDeskProjection(desk, { activeMemberCount }) });
  });
}
