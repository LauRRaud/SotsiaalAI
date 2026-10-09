import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import prisma from "@/lib/prisma";
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
 * `/org/koduteenus/paevad/[membershipId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teade „sinu käigud muutusid" kannab ainult töötaja enda liikmesuse ID-d. Asutus
 * loetakse liikmesuselt ja pärast mooduli kontrolli suunatakse töötaja koduteenuse
 * avalehele, kus on tema tänane päev ja järgmised päevad. Võõra või olematu
 * liikmesuse ID annab 404.
 */
export default async function HomeCareMyDaysRedirectPage({ params }) {
  noStore();
  const { membershipId } = await params;
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/paevad/${membershipId}`);

  /* Organisatsioon loetakse liikmesuselt, MITTE kasutaja sisendist; liikmesus peab olema vaataja enda oma. */
  const membership = await prisma.organizationMembership.findFirst({
    where: { id: String(membershipId), userId: auth.userId },
    select: { organizationId: true }
  });
  if (!membership) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: membership.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();

  redirect(`/org/${membership.organizationId}/koduteenus`);
}
