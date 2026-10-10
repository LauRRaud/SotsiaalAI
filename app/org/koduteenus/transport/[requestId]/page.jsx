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
 * `/org/koduteenus/transport/[requestId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teade „hooldaja soovis kliendile transporti" kannab ainult soovi rea ID-d. Asutus ja klient
 * loetakse realt ja pärast õiguskontrolli suunatakse hooldusjuht kliendi lehele, kus soov on
 * koos vastamise nuppudega. Kes hooldusjuht ei ole, saab 404, sama vastuse mis olematu rea
 * puhul; kas ta just seda klienti näeb, otsustab kliendi leht ise.
 */
export default async function HomeCareTransportRedirectPage({ params }) {
  noStore();
  const { requestId } = await params;
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/transport/${requestId}`);

  /* Organisatsioon loetakse realt, MITTE kasutaja sisendist. */
  const transport = await prisma.careTransportRequest.findUnique({
    where: { id: String(requestId) },
    select: { organizationId: true, clientId: true }
  });
  if (!transport) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: transport.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();
  if (!coordinatorScope(context)) notFound();

  redirect(`/org/${transport.organizationId}/koduteenus/kliendid/${transport.clientId}`);
}
