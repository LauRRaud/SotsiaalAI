import { deskAuthError, deskJson, handleDeskRoute, requireDeskAdmin } from "@/lib/urgent/deskAdminRoutes";
import { buildUrgentRequestAggregate } from "@/lib/urgent/aggregate";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * SK-V1 E6 koond: mitu ise-deklareeritud kiireloomulist pöördumist, mis
 * kellaajal, mis piirkonnas — ilma sisuta.
 *
 * Lävi tuleb konstandist. `minimumGroupSize` päringus saab teda ainult TÕSTA;
 * langetamise katse ei jõua domeenikihist läbi. Seda kontrollib test, mitte
 * hea tahe.
 */
export async function GET(request) {
  const authz = await requireDeskAdmin();
  if (!authz.ok) return deskAuthError(authz, request);

  return handleDeskRoute(request, async () => {
    const aggregate = await buildUrgentRequestAggregate({
      db: prisma,
      minimumGroupSize: new URL(request.url).searchParams.get("minimumGroupSize")
    });
    return deskJson({ ok: true, aggregate });
  });
}
