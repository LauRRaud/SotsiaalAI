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
 * `/org/koduteenus/muutus/[signalId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teade „hooldajad märkasid muutust" kannab ainult märkamise rea ID-d. Asutus ja klient
 * loetakse realt ja pärast õiguskontrolli suunatakse hooldusjuht kliendi lehele, kus
 * märkamine on koos vastamise vormiga. Kes hooldusjuht ei ole, saab 404, sama vastuse
 * mis olematu rea puhul; kas ta just seda klienti näeb, otsustab kliendi leht ise.
 */
export default async function HomeCareChangeRedirectPage({ params }) {
  noStore();
  const { signalId } = await params;
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/muutus/${signalId}`);

  /* Organisatsioon loetakse realt, MITTE kasutaja sisendist. */
  const signal = await prisma.careChangeSignal.findUnique({
    where: { id: String(signalId) },
    select: { organizationId: true, clientId: true }
  });
  if (!signal) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: signal.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();
  if (!coordinatorScope(context)) notFound();

  redirect(`/org/${signal.organizationId}/koduteenus/kliendid/${signal.clientId}`);
}
