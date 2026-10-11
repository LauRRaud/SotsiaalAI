import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";
import { coordinatorScope } from "@/lib/homeCare/access";
import { HOME_CARE_MODULE } from "@/lib/homeCare/constants";
import { isHomeCareEnabled } from "@/lib/homeCare/flags";
import { resolveOrgAccessContext } from "@/lib/org/accessContext";

import { requireOrgSession } from "../../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Koduteenus - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * `/org/koduteenus/takistus/[obstacleId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teade „hooldaja teatas takistusest" kannab ainult teate rea ID-d. Asutus ja päev
 * loetakse realt ja pärast õiguskontrolli suunatakse hooldusjuht selle päeva plaani,
 * kus teade on koos töötaja tegemata käikudega. Kes hooldusjuht ei ole, saab 404, sama
 * vastuse mis olematu rea puhul.
 */
export default async function HomeCareObstacleRedirectPage({ params }) {
  noStore();
  const { obstacleId } = await params;
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/takistus/${obstacleId}`);

  /* Organisatsioon loetakse realt, MITTE kasutaja sisendist. */
  const obstacle = await prisma.careObstacle.findUnique({
    where: { id: String(obstacleId) },
    select: { organizationId: true, day: true }
  });
  if (!obstacle) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: obstacle.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();
  if (!coordinatorScope(context)) notFound();

  redirect(`/org/${obstacle.organizationId}/koduteenus/paev?paev=${encodeURIComponent(obstacle.day)}`);
}
