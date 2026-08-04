import {
  deskAuthError,
  deskJson,
  handleDeskRoute,
  readDeskId,
  requireDeskAdmin
} from "@/lib/urgent/deskAdminRoutes";
import { addUrgentDeskMember, removeUrgentDeskMember } from "@/lib/urgent/deskAdmin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Mehitaja lisamine. Ilma mehitajata laud ei avane. */
export async function POST(request, { params }) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);
  const deskId = await readDeskId(params);
  const body = await request.json().catch(() => ({}));

  return handleDeskRoute(request, async () => {
    const member = await addUrgentDeskMember({ prisma, deskId, userId: body?.userId });
    return deskJson({ ok: true, member: { id: member.id, userId: member.userId, isActive: member.isActive } }, 201);
  });
}

/**
 * Mehitaja eemaldamine.
 *
 * Kirje jääb alles passiivsena: vastutusjälg viitab inimesele, kes kunagi laua
 * taga istus, ja see jälg peab jääma loetavaks ka pärast tema lahkumist.
 */
export async function DELETE(request, { params }) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);
  const deskId = await readDeskId(params);
  const body = await request.json().catch(() => ({}));

  return handleDeskRoute(request, async () => {
    const member = await removeUrgentDeskMember({ prisma, deskId, userId: body?.userId });
    return deskJson({ ok: true, member: { id: member.id, userId: member.userId, isActive: member.isActive } });
  });
}
