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
 * `/org/koduteenus/raagime/[requestId]` — TEAVITUSE SIHTKOHT, mitte vaade.
 *
 * Teade „töötaja soovib rääkida" kannab ainult soovi rea ID-d. Asutus loetakse realt ja pärast
 * õiguskontrolli suunatakse hooldusjuht tähtaegade lehele, kus lahtised soovid on nimekirjas
 * koos nupuga „Räägitud". Kes hooldusjuht ei ole, saab 404, sama vastuse mis olematu rea puhul.
 */
export default async function HomeCareTalkRedirectPage({ params }) {
  noStore();
  const { requestId } = await params;
  if (!isHomeCareEnabled()) notFound();

  const auth = await requireOrgSession(`/org/koduteenus/raagime/${requestId}`);

  /* Organisatsioon loetakse realt, MITTE kasutaja sisendist. */
  const talk = await prisma.careTalkRequest.findUnique({ where: { id: String(requestId) }, select: { organizationId: true } });
  if (!talk) notFound();

  let context;
  try {
    context = await resolveOrgAccessContext({
      userId: auth.userId,
      requestedOrganizationId: talk.organizationId,
      isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
      productRole: auth.roleState?.effectiveRole
    });
  } catch {
    notFound();
  }
  if (!(context.activeModules || []).includes(HOME_CARE_MODULE)) notFound();
  if (!coordinatorScope(context)) notFound();

  redirect(`/org/${talk.organizationId}/koduteenus/tahtajad`);
}
