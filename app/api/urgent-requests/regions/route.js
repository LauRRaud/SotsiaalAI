import { handleUrgentRoute, requireUrgentUser, urgentError, urgentJson } from "@/lib/urgent/routes";
import { listOpenUrgentRegions } from "@/lib/urgent/regions";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Piirkonnad, kus kiireloomulise abipalve rada on avatud.
 *
 * Tühi loend EI ole viga — ta on funktsiooni vaikeseis. Kuni ükski partner ei
 * ole lauda seadistanud, ei ole ka valikut ega vormi, ja leht ütleb seda välja
 * selle asemel, et pakkuda nuppu, mis ei vii kuhugi.
 */
export async function GET() {
  const auth = await requireUrgentUser();
  if (!auth.ok) return urgentError(auth.message, auth.status);

  return handleUrgentRoute(async () => {
    const regions = await listOpenUrgentRegions({ prisma });
    return urgentJson({ ok: true, regions });
  });
}
