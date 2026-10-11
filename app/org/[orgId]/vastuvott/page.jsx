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
  title: "Organisatsiooni vastuvõtt - Sotsiaal.pro",
  robots: { index: false, follow: false, nocache: true }
};

/**
 * Vastuvõtulaud. Värav on MOODUL, mitte capability — määratud töötajal ei ole
 * `INBOX_COORDINATOR`-it, aga ta peab oma tööd nägema. Loend ise on serveris
 * skoobitud: õiguseta liige näeb tühja lauda.
 */
export default async function OrgInboxPage({ params, searchParams }) {
  noStore();
  const { orgId } = await params;
  const query = (await searchParams) || {};
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
  /* Lõpetatud pöördumiste rühm on koordinaatori vaade: töötaja näeb laual ainult talle
     määratud tööd ja lõpetatud tööl vastutajat ei ole, seega oleks rühm talle alati tühi.
     `?lopetatud=1` avab kohe selle rühma (sinna viib lõpetatud kirje „Tagasi loendisse"). */
  const showFinished = (fullContext.capabilities || []).some((grant) => grant.capability === "INBOX_COORDINATOR");
  const initialGroup = showFinished && query.lopetatud === "1" ? "finished" : "open";
  const page = await listInboxItemPage(fullContext, { closedOnly: initialGroup === "finished" });

  /* `key`: teise rühma aadressile minnes algab loend uuesti (olek on rühma kohta). */
  return <OrgInboxClient key={initialGroup} context={auth.context} initialPage={page} initialGroup={initialGroup} showFinished={showFinished} />;
}
