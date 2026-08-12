import {
  deskAuthError,
  deskJson,
  handleDeskRoute,
  requireDeskAdmin
} from "@/lib/urgent/deskAdminRoutes";
import { createUrgentDesk, listUrgentDesks } from "@/lib/urgent/deskAdmin";
import { adminDeskProjection } from "@/lib/urgent/desk";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Laudade register koos valmiduse ja takistuste põhjustega. */
export async function GET(request) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);

  return handleDeskRoute(request, async () => {
    const rows = await listUrgentDesks({ prisma });
    return deskJson({ ok: true, desks: rows });
  });
}

/**
 * Uus laud.
 *
 * Sünnib ALATI kinni — loomine ei ava piirkonda. Avamiseks on eraldi kaks
 * sammu (kinnitamine + sisselülitamine), sest kogemata avatud öine kanal on
 * täpselt see, mida see funktsioon ei tohi teha.
 */
export async function POST(request) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);
  const body = await request.json().catch(() => ({}));

  return handleDeskRoute(request, async () => {
    const desk = await createUrgentDesk({
      prisma,
      municipalityId: body?.municipalityId,
      recipientType: body?.recipientType || "KOV_CONTACT",
      data: body || {},
      // SOL-URG-12: tegija läheb ALATI kaasa — ilma temata ei kirjutata midagi.
      actorUserId: authz.userId
    });
    return deskJson({ ok: true, desk: adminDeskProjection(desk, { activeMemberCount: 0 }) }, 201);
  });
}
