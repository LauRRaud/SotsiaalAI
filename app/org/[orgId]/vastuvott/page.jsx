import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import OrgInboxClient from "@/components/org/OrgInboxClient";
import { isOrgInboxEnabled } from "@/lib/org/flags";
import { listInboxItemPage } from "@/lib/org/inbox";
import { resolveOrgAccessContext } from "@/lib/org/accessContext";

import { requireOrgPageContext } from "../../_serverContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;
export const metadata = {
  title: "Organisatsiooni vastuvõtt - SotsiaalAI",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Vastuvõtulaud. Värav on MOODUL, mitte capability — määratud töötajal ei ole
 * `INBOX_COORDINATOR`-it, aga ta peab oma tööd nägema. Loend ise on serveris
 * skoobitud: õiguseta liige näeb tühja lauda.
 */
export default async function OrgInboxPage({ params }) {
  noStore();
  const { orgId } = await params;
  if (!isOrgInboxEnabled()) notFound();

  const auth = await requireOrgPageContext(orgId, `/org/${orgId}/vastuvott`);
  if (!(auth.context.activeModules || []).includes("KOV_INTAKE")) notFound();

  /* Loend vajab TÄIS-konteksti (üksuste puu skoobiarvutuseks), mitte
     kliendiprojektsiooni — seepärast lahendame konteksti siin uuesti. */
  const fullContext = await resolveOrgAccessContext({
    userId: auth.userId,
    requestedOrganizationId: orgId,
    isPlatformAdmin: Boolean(auth.roleState?.isAdmin),
    productRole: auth.roleState?.effectiveRole
  });
  const page = await listInboxItemPage(fullContext);

  return <OrgInboxClient context={auth.context} initialPage={page} />;
}
